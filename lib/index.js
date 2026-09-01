import './types.js';
import { Config } from './config.js';
import { agentCreatedContext, agentDisposedContext, agentErrorContext, agentStatusContext, classifySessionEvent, clearTurnTracking, hookMatches, matchFilters, sessionCreatedContext, sessionDisposedContext, } from './events.js';
import { eventLabel } from './context.js';
import { createHookRunner } from './runner.js';
import { fireNotify } from './notify.js';
import { createHistorySink } from './history.js';
import { createFeishuSetupManager } from './feishu-session.js';
import { registerHookRoutes } from './server.js';
export const name = 'dsh-hooks';
/**
 * Count live agents still running in one session's descendant subagent tree.
 *
 * Lineage comes from the durable session tree (`subagents.listDescendants`,
 * driven by the session header `parentSession`): a subagent's runtime owner
 * in the agents registry is the subagent manager's host-level scope, not the
 * parent agent, so ownership chains (`agents.isOwnedBy`) cannot find children.
 * Only agents whose live status is `running` count — a settled/idle
 * continuable child no longer suppresses the turn/end notification. Returns 0
 * when the session has no live agent or the services are unavailable.
 *
 * The live-registry scan is strictly a fallback for when listing is
 * unavailable (service absent or listing threw): a successful empty listing
 * stays empty, so ordinary subagent-free turns don't pay an O(registry) scan.
 */
export async function countRunningSubagents(agents, subagents, sessionId) {
    if (sessionId === undefined || agents.get(sessionId) === undefined)
        return 0;
    let ids = [];
    let listed = false;
    if (subagents !== undefined) {
        try {
            ids = (await subagents.listDescendants(sessionId))
                .map((row) => row.id)
                .filter((id) => typeof id === 'string' && id !== sessionId);
            listed = true;
        }
        catch {
            // listing unavailable — fall back to the live-registry child scan below
        }
    }
    if (!listed) {
        const owner = agents.get(sessionId);
        if (owner === undefined)
            return 0;
        ids = agents
            .list()
            .filter((candidate) => candidate !== owner && agents.isOwnedBy(candidate.id, owner))
            .map((candidate) => candidate.id);
    }
    let count = 0;
    for (const id of ids) {
        const agent = agents.get(id);
        if (agent !== undefined && agent.status === 'running')
            count++;
    }
    return count;
}
// Dependency on the session service: `session/event` only exists once a
// SessionStore is composed, and this plugin consumes the durable firehose.
export const inject = ['sessions'];
export { Config };
export { hookMatches, matchFilters } from './events.js';
export { createHistorySink } from './history.js';
/**
 * Model-facing announcement, installed only when the system-prompt service
 * exists (web profile). Tells agents the plugin exists and how to cooperate.
 */
export const DSH_HOOKS_GUIDANCE = '本机已安装 dsh-hooks 插件（DeepSeek Harness 配置驱动生命周期 hooks）：可在 profile 的 cordis.patch.yml 声明「事件 → 命令/通知」的 hook（turn/start、turn/end、step/end、tool/call、tool/result、user/message、approval/asked、session/title、session/created、session/disposed、agent/created、agent/disposed、agent/error、agent/status 共 14 类事件），支持 when 原因过滤、match 字段正则过滤、stdin JSON 输入、opt-in 重试、内置 webhook/desktop 通知渠道；执行历史记录于 ~/.dsh/dsh-hooks/history.jsonl；`dsh-hooks dry-run <event>` 可模拟事件验证配置。用户提到「hooks / 钩子 / 生命周期 / 通知配置」时即指本插件，请据此协作。';
export function apply(ctx, config = {}) {
    const hooks = config.hooks ?? [];
    const history = createHistorySink(config.history ?? undefined);
    const runner = createHookRunner((line) => ctx.logger?.info(line), (record) => history.record(record));
    // Web-profile extras: /dsh-hooks routes (incl. the Feishu connect flow)
    // and the agent announcement. Both services are optional — CLI/headless
    // profiles provide neither, and the plugin keeps working there untouched.
    const webServer = ctx.get('webServer', false);
    if (webServer !== undefined) {
        const feishu = createFeishuSetupManager();
        ctx.effect(() => {
            const unregister = registerHookRoutes(webServer, { hooks, history, runner, feishu: { manager: feishu } });
            return () => {
                unregister();
                // Abort an in-flight QR scan so it never outlives the plugin.
                feishu.dispose();
            };
        }, 'dsh-hooks: /dsh-hooks routes');
    }
    const systemPrompt = ctx.get('systemPrompt', false);
    if (systemPrompt !== undefined) {
        ctx.effect(() => systemPrompt.section({ name: 'plugin:dsh-hooks', order: 200, text: DSH_HOOKS_GUIDANCE }), 'dsh-hooks: prompt section');
    }
    const runMatching = (ctxValue, reasonKind) => {
        for (const hook of hooks) {
            if (!hookMatches(hook, ctxValue.event, reasonKind))
                continue;
            if (!matchFilters(hook.match, ctxValue))
                continue;
            if (hook.notify) {
                void fireNotify(hook.notify, ctxValue, (record) => history.record(record));
                continue;
            }
            if (hook.run) {
                runner.run(hook, ctxValue);
                continue;
            }
            console.warn(`[dsh-hooks] hook 既没有 run 也没有 notify，已跳过：${eventLabel(ctxValue)}`);
        }
    };
    // turn/end: fill the live running-subagent count before dispatching hooks,
    // so a hook can tell "work handed off to still-running subagents" apart from
    // "the turn finished for real". The services are read lazily at event time —
    // at plugin apply time the agents/subagents rows may not be composed yet.
    let warnedAgentsUnavailable = false;
    const matchAfterSubagentCount = async (ctxValue, reasonKind) => {
        const agents = ctx.get('agents', false);
        if (agents === undefined) {
            // Warn once, not on every turn/end: profiles without the agents service
            // would otherwise spam the log on each turn boundary.
            if (!warnedAgentsUnavailable) {
                warnedAgentsUnavailable = true;
                ctx.logger?.warn?.('[dsh-hooks] agents service unavailable at turn/end — runningSubagents stays 0');
            }
        }
        else {
            const subagents = ctx.get('subagents', false);
            try {
                ctxValue.runningSubagents = await countRunningSubagents(agents, subagents, ctxValue.sessionId);
            }
            catch (error) {
                ctx.logger?.warn?.('[dsh-hooks] failed to count running subagents: %s', String(error));
            }
        }
        runMatching(ctxValue, reasonKind);
    };
    // Durable session firehose: turn boundaries, steps, tool calls, messages,
    // titles, and approval requests.
    ctx.on('session/event', (session, event) => {
        const classified = classifySessionEvent(session, event);
        if (classified === undefined)
            return;
        const reasonKind = extractReasonKind(event);
        if (classified.event !== 'turn/end') {
            runMatching(classified, reasonKind);
            return;
        }
        // Dispatch is deferred past the async count; guard the fire-and-forget
        // promise so a synchronous throw inside dispatch surfaces as a log line
        // instead of an unhandled rejection.
        void matchAfterSubagentCount(classified, reasonKind).catch((error) => {
            ctx.logger?.warn?.('[dsh-hooks] turn/end dispatch failed: %s', String(error));
        });
    });
    // Session lifecycle (published by the session store, not the firehose).
    ctx.on('session/created', (session) => {
        runMatching(sessionCreatedContext(session));
    });
    ctx.on('session/disposed', (session) => {
        runMatching(sessionDisposedContext(session));
    });
    // Agent lifecycle events.
    ctx.on('agent/created', (payload) => {
        runMatching(agentCreatedContext(payload.agent));
    });
    ctx.on('agent/disposed', (payload) => {
        runMatching(agentDisposedContext(payload.agent));
    });
    ctx.on('agent/error', (payload) => {
        runMatching(agentErrorContext(payload.agent, payload.turn, payload.error));
    });
    ctx.on('agent/status', (payload) => {
        runMatching(agentStatusContext(payload.agent, payload.status));
    });
    ctx.effect(() => () => {
        runner.dispose();
    });
}
/** Extract the `turn/end` reason kind from a session event, when present. */
function extractReasonKind(event) {
    if (typeof event !== 'object' || event === null)
        return undefined;
    const e = event;
    if (e.type !== 'turn/end')
        return undefined;
    return typeof e.data?.reason?.kind === 'string' ? e.data.reason.kind : undefined;
}
// Referenced only for tree-shaking clarity of the module contract; exported
// for tests that need deterministic bookkeeping.
export const _internals = { clearTurnTracking, countRunningSubagents };

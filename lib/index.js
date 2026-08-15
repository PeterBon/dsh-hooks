import './types.js';
import { Config } from './config.js';
import { agentCreatedContext, agentDisposedContext, agentErrorContext, agentStatusContext, classifySessionEvent, clearTurnTracking, hookMatches, } from './events.js';
import { createHookRunner } from './runner.js';
export const name = 'dsh-hooks';
// Dependency on the session service: `session/event` only exists once a
// SessionStore is composed, and this plugin consumes the durable firehose.
export const inject = ['sessions'];
export { Config };
export function apply(ctx, config = {}) {
    const hooks = config.hooks ?? [];
    const runner = createHookRunner((line) => ctx.logger?.info(line));
    const runMatching = (ctxValue, reasonKind) => {
        for (const hook of hooks) {
            if (!hookMatches(hook, ctxValue.event, reasonKind))
                continue;
            runner.run(hook, ctxValue);
        }
    };
    // Durable session firehose: turn boundaries and approval requests.
    ctx.on('session/event', (session, event) => {
        const classified = classifySessionEvent(session, event);
        if (classified === undefined)
            return;
        const reasonKind = extractReasonKind(event);
        runMatching(classified, reasonKind);
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
// Referenced only for tree-shaking clarity of the module contract; clearTurnTracking
// is exported for tests that need deterministic duration bookkeeping.
export const _internals = { clearTurnTracking };

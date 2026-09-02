import type { Context } from '@deepseek-ai/cordis';
import './types.js';
import { Config } from './config.js';
import { clearTurnTracking } from './events.js';
export declare const name = "dsh-hooks";
/** Minimal structural contract of the optional `agents` service. */
interface AgentsLike {
    get(id: string): {
        id: string;
        status: string;
    } | undefined;
    list(): Array<{
        id: string;
        status: string;
    }>;
    isOwnedBy(id: string, owner: {
        id: string;
    }): boolean;
}
/** Minimal structural contract of the optional `subagents` service. */
interface SubagentsLike {
    listDescendants(rootSessionId: string): Promise<Array<{
        id?: string;
    }>>;
}
/** Snapshot of one session's subagent tree: live-running plus total descendants. */
export interface SubagentTreeStats {
    /** Descendants whose live agent status is `running`. */
    running: number;
    /** Total descendants in the durable tree (running, idle, or settled). */
    total: number;
}
/**
 * Inspect one session's descendant subagent tree.
 *
 * Lineage comes from the durable session tree (`subagents.listDescendants`,
 * driven by the session header `parentSession`): a subagent's runtime owner
 * in the agents registry is the subagent manager's host-level scope, not the
 * parent agent, so ownership chains (`agents.isOwnedBy`) cannot find children.
 * Only agents whose live status is `running` count as running — a settled/idle
 * continuable child does not. Returns `{ running: 0, total: 0 }` when the
 * session has no live agent or the services are unavailable.
 *
 * The live-registry scan is strictly a fallback for when listing is
 * unavailable (service absent or listing threw): a successful empty listing
 * stays empty, so ordinary subagent-free turns don't pay an O(registry) scan.
 */
export declare function inspectSubagentTree(agents: AgentsLike, subagents: SubagentsLike | undefined, sessionId: string | undefined): Promise<SubagentTreeStats>;
/**
 * Count live agents still running in one session's descendant subagent tree
 * (the `running` half of {@link inspectSubagentTree}).
 */
export declare function countRunningSubagents(agents: AgentsLike, subagents: SubagentsLike | undefined, sessionId: string | undefined): Promise<number>;
export declare const inject: readonly ['sessions'];
export { Config };
export { hookMatches, matchFilters } from './events.js';
export { createHistorySink } from './history.js';
/**
 * Model-facing announcement, installed only when the system-prompt service
 * exists (web profile). Tells agents the plugin exists and how to cooperate.
 */
export declare const DSH_HOOKS_GUIDANCE = "\u672C\u673A\u5DF2\u5B89\u88C5 dsh-hooks \u63D2\u4EF6\uFF08DeepSeek Harness \u914D\u7F6E\u9A71\u52A8\u751F\u547D\u5468\u671F hooks\uFF09\uFF1A\u53EF\u5728 profile \u7684 cordis.patch.yml \u58F0\u660E\u300C\u4E8B\u4EF6 \u2192 \u547D\u4EE4/\u901A\u77E5\u300D\u7684 hook\uFF08turn/start\u3001turn/end\u3001tree/settled\u3001step/end\u3001tool/call\u3001tool/result\u3001user/message\u3001approval/asked\u3001approval/decided\u3001session/title\u3001session/created\u3001session/disposed\u3001agent/created\u3001agent/disposed\u3001agent/error\u3001agent/status\u3001hook/failed \u5171 17 \u7C7B\u4E8B\u4EF6\uFF09\uFF0C\u652F\u6301 when \u539F\u56E0\u8FC7\u6EE4\u3001match \u5B57\u6BB5\u6B63\u5219/\u6570\u503C\u6BD4\u8F83\u8FC7\u6EE4\uFF08\u5982 '>10000'\uFF09\u3001stdin JSON \u8F93\u5165\u3001opt-in \u91CD\u8BD5\u3001\u6267\u884C\u9009\u9879\uFF08enabled \u505C\u7528 / cwd \u5DE5\u4F5C\u76EE\u5F55 / maxConcurrent + debounceMs \u9632\u9AD8\u9891\u98CE\u66B4\uFF09\u3001\u5185\u7F6E webhook/desktop \u901A\u77E5\u6E20\u9053\uFF1B\u6267\u884C\u5386\u53F2\u8BB0\u5F55\u4E8E ~/.dsh/dsh-hooks/history.jsonl\uFF1B`dsh-hooks dry-run <event>` \u53EF\u6A21\u62DF\u4E8B\u4EF6\u9A8C\u8BC1\u914D\u7F6E\u3002\u7528\u6237\u63D0\u5230\u300Chooks / \u94A9\u5B50 / \u751F\u547D\u5468\u671F / \u901A\u77E5\u914D\u7F6E\u300D\u65F6\u5373\u6307\u672C\u63D2\u4EF6\uFF0C\u8BF7\u636E\u6B64\u534F\u4F5C\u3002";
export declare function apply(ctx: Context, config?: Config): void;
export declare const _internals: {
    clearTurnTracking: typeof clearTurnTracking;
    countRunningSubagents: typeof countRunningSubagents;
    inspectSubagentTree: typeof inspectSubagentTree;
};

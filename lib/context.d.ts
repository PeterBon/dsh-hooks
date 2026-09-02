/**
 * Hook execution context: a flat string map rendered into environment
 * variables and `{{var}}` placeholders. Never carries non-string values —
 * the runner owns serialization boundaries.
 */
export interface HookContext {
    event: string;
    sessionId?: string;
    /**
     * Readable session title (the latest `session/title` log event, or a
     * first-prompt fallback), when the session log offers one.
     */
    sessionName?: string;
    /** Absolute working directory of the session, when known. */
    cwd?: string;
    turn?: number;
    /** Step number of the turn (step and tool events). */
    step?: number;
    reason?: string;
    tool?: string;
    callId?: string;
    /** Raw tool-call arguments JSON as the model produced it (tool/call). */
    toolArgs?: string;
    /** Tool failure identity (`name`/`code`) when a tool result errored. */
    toolError?: string;
    /** Producer source kind: user message source, title source, etc. */
    source?: string;
    durationMs?: number;
    status?: string;
    error?: string;
    /** Event content snapshot: turn assistant text, tool result text, … */
    content?: string;
    /**
     * Wall-clock tool execution time, ms (tool/result only; undefined when the
     * pairing tool/call was never seen, e.g. after a plugin restart).
     */
    toolDurationMs?: number;
    /** Aggregated token usage of the turn (turn/end), when reported. */
    usageInputTokens?: number;
    usageOutputTokens?: number;
    usageCacheReadTokens?: number;
    usageCacheWriteTokens?: number;
    usageReasoningTokens?: number;
    /**
     * Number of live subagents still running under this session at `turn/end`
     * (0 = none). Always present on `turn/end`; the plugin fills the real count
     * from the agents/subagents services when they are available.
     */
    runningSubagents?: number;
    /** Subagent lineage: the parent session id (session header `parentSession`). */
    parentSessionId?: string;
    /** Whether the session was created as a subagent child (header `origin`). */
    subagent?: boolean;
    /** Delegation depth from the session header; 0 = top-level session. */
    delegationDepth?: number;
    /** Session creation time, epoch ms (session header `createdAt`). */
    sessionCreatedAt?: number;
    /** Agent preset id that composed the session's agent (header `agentPreset`). */
    agentPreset?: string;
    /** Approval audit id, pairing `approval/asked` with `approval/decided`. */
    approvalId?: string;
    /** Approval decision outcome (approval/decided). */
    approvalOutcome?: string;
    /** Total subagents in the settled tree (tree/settled). */
    totalSubagents?: number;
    /** Parent turn/end → tree settle duration, ms (tree/settled). */
    treeDurationMs?: number;
    /** Identity summary of the hook that failed consecutively (hook/failed). */
    hookFailedHook?: string;
    /** Consecutive failure count when the alert fired (hook/failed). */
    hookFailures?: number;
    timestamp: string;
}
export declare function toEnv(ctx: HookContext): Record<string, string>;
/** Render `{{DSH_HOOK_*}}` placeholders from the context map. */
export declare function renderTemplate(template: string, ctx: HookContext): string;
/** Human-readable label for an event, used in runner logs. */
export declare function eventLabel(ctx: HookContext): string;

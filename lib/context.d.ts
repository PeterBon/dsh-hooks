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
    /** Aggregated token usage of the turn (turn/end), when reported. */
    usageInputTokens?: number;
    usageOutputTokens?: number;
    usageCacheReadTokens?: number;
    usageCacheWriteTokens?: number;
    usageReasoningTokens?: number;
    timestamp: string;
}
export declare function toEnv(ctx: HookContext): Record<string, string>;
/** Render `{{DSH_HOOK_*}}` placeholders from the context map. */
export declare function renderTemplate(template: string, ctx: HookContext): string;
/** Human-readable label for an event, used in runner logs. */
export declare function eventLabel(ctx: HookContext): string;

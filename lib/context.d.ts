/**
 * Hook execution context: a flat string map rendered into environment
 * variables and `{{var}}` placeholders. Never carries non-string values —
 * the runner owns serialization boundaries.
 */
export interface HookContext {
    event: string;
    sessionId?: string;
    /** Absolute working directory of the session, when known. */
    cwd?: string;
    turn?: number;
    reason?: string;
    tool?: string;
    callId?: string;
    durationMs?: number;
    status?: string;
    error?: string;
    timestamp: string;
}
export declare function toEnv(ctx: HookContext): Record<string, string>;
/** Render `{{DSH_HOOK_*}}` placeholders from the context map. */
export declare function renderTemplate(template: string, ctx: HookContext): string;
/** Human-readable label for an event, used in runner logs. */
export declare function eventLabel(ctx: HookContext): string;

/** Hookable event kinds. v1 is emit-only: no waterfall/interception events. */
export declare const HOOK_EVENTS: readonly ["turn/start", "turn/end", "approval/asked", "agent/created", "agent/disposed", "agent/error", "agent/status"];
export type HookEvent = (typeof HOOK_EVENTS)[number];
/** `turn/end` reason kinds (from @deepseek-ai/dsh-session TurnEndReasonMap). */
export declare const TURN_END_REASONS: readonly ["completed", "error", "aborted", "blocked", "max-tokens", "interrupted"];
export type TurnEndReasonKind = (typeof TURN_END_REASONS)[number];
/** One declared hook: a matching event runs `run` through the platform shell. */
export interface HookSpec {
    /** Event that triggers the hook. */
    on: HookEvent;
    /**
     * Optional filter. For `turn/end` it matches the reason kind
     * (`completed`, `error`, …). Ignored for other events.
     */
    when?: TurnEndReasonKind;
    /** Command to spawn through the platform shell. */
    run: string;
    /** Per-hook timeout in milliseconds. Defaults to 10000. */
    timeoutMs?: number;
}
export interface Config {
    hooks?: HookSpec[];
}
export declare const Config: {
    (data?: Config | null): Config;
    meta: {
        description?: string | Record<string, string>;
    };
};

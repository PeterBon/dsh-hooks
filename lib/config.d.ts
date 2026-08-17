/** Hookable event kinds. v1 is emit-only: no waterfall/interception events. */
export declare const HOOK_EVENTS: readonly ['turn/start', 'turn/end', 'step/end', 'tool/call', 'tool/result', 'user/message', 'approval/asked', 'session/title', 'session/created', 'session/disposed', 'agent/created', 'agent/disposed', 'agent/error', 'agent/status'];
export type HookEvent = (typeof HOOK_EVENTS)[number];
/** `turn/end` reason kinds (from @deepseek-ai/dsh-session TurnEndReasonMap). */
export declare const TURN_END_REASONS: readonly ['completed', 'error', 'aborted', 'blocked', 'max-tokens', 'interrupted'];
export type TurnEndReasonKind = (typeof TURN_END_REASONS)[number];
/**
 * Built-in notification: send the hook context through a channel declared
 * in config, no external script required. Mutually exclusive with `run` —
 * a hook declares exactly one of the two.
 */
export interface NotifySpec {
    /** Channel to send through. */
    channel: 'webhook' | 'desktop';
    /** webhook: the target URL (falls back to the `DSH_HOOKS_WEBHOOK_URL` env var). */
    url?: string;
    /** webhook: post a Slack-style `{ text }` one-line summary instead of the full context document. */
    slack?: boolean;
}
/** One declared hook: a matching event runs `run` (or sends `notify`). */
export interface HookSpec {
    /** Event that triggers the hook. */
    on: HookEvent;
    /**
     * Optional filter. For `turn/end` it matches the reason kind
     * (`completed`, `error`, …). Ignored for other events.
     */
    when?: TurnEndReasonKind;
    /**
     * Optional field → regex filters: every declared regex must match the
     * context's field value for the hook to run. Fields are `HookContext`
     * keys (`tool`, `sessionName`, `sessionId`, `error`, `source`, `cwd`,
     * `content`, …); a field absent from the context never matches.
     */
    match?: Record<string, RegExp>;
    /**
     * Command to spawn through the platform shell. Exactly one of `run` and
     * `notify` must be declared.
     */
    run?: string;
    /** Built-in notification channel. Exactly one of `run` and `notify` must be declared. */
    notify?: NotifySpec | null;
    /**
     * How the context reaches the command. `env` (default) passes the
     * `DSH_HOOK_*` variables only; `stdin` additionally writes the full
     * context as one JSON document to the command's stdin.
     */
    input?: 'env' | 'stdin';
    /** Per-hook timeout in milliseconds. Defaults to 10000. */
    timeoutMs?: number;
    /**
     * Retry count for non-zero exit codes (default 0: fire-and-forget,
     * never retried). Spawn failures and timeouts are never retried.
     */
    retries?: number;
    /** Base delay between retries in milliseconds; doubles per attempt. Defaults to 500. */
    retryDelayMs?: number;
}
/** Execution-history settings: in-memory ring buffer + optional JSONL log. */
export interface HistoryConfig {
    /** Persist records to disk. Defaults to true. */
    enabled?: boolean;
    /** JSONL file path. Defaults to ~/.dsh/dsh-hooks/history.jsonl (0600). */
    path?: string;
    /** In-memory ring buffer size. Defaults to 500. */
    max?: number;
}
export interface Config {
    hooks?: HookSpec[];
    history?: HistoryConfig | null;
}
export declare const Config: {
    (data?: Config | null): Config;
    meta: {
        description?: string | Record<string, string>;
    };
};

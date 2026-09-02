/** Hookable event kinds. v1 is emit-only: no waterfall/interception events. */
export declare const HOOK_EVENTS: readonly ['turn/start', 'turn/end', 'tree/settled', 'step/end', 'tool/call', 'tool/result', 'user/message', 'approval/asked', 'approval/decided', 'session/title', 'session/created', 'session/disposed', 'agent/created', 'agent/disposed', 'agent/error', 'agent/status', 'hook/failed'];
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
/**
 * Numeric comparison filter for `match`: every declared op must hold for
 * the (numeric) context field. Declared in YAML as an object (`{ gt: 10000 }`)
 * or as an equivalent string (`'>10000'`); both compare against the field's
 * number value, never its string form.
 */
export interface NumericMatch {
    gt?: number;
    gte?: number;
    lt?: number;
    lte?: number;
    eq?: number;
}
/** One hook: a matching event runs `run` (or sends `notify`). */
export interface HookSpec {
    /** Event that triggers the hook. */
    on: HookEvent;
    /**
     * Optional filter. For `turn/end` it matches the reason kind
     * (`completed`, `error`, …). Ignored for other events.
     */
    when?: TurnEndReasonKind;
    /**
     * Optional field → filter map: every declared filter must match the
     * context's field value for the hook to run. Values are regexes (tested
     * against the String-coerced field) or numeric comparisons (`{ gt: 10000 }`
     * / `'>10000'`, numbers only). Fields are `HookContext` keys (`tool`,
     * `sessionName`, `sessionId`, `error`, `source`, `cwd`, `content`, `turn`,
     * `durationMs`, `runningSubagents`, …); a field absent from the context
     * never matches.
     */
    match?: Record<string, RegExp | NumericMatch>;
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
    /**
     * Disable this hook without deleting it: the declaration stays in config,
     * dispatch skips it silently (never counted as a failure). Defaults to true.
     */
    enabled?: boolean;
    /**
     * Working directory for the spawned command. `'session'` runs in the
     * session's cwd (the project the agent works on); any other value must be
     * an absolute path. Defaults to the plugin process directory.
     */
    cwd?: 'session' | string;
    /**
     * Maximum number of concurrently running processes for this hook.
     * Triggers beyond the limit are dropped (recorded as `skipped`). Defaults
     * to unlimited; `0` also means unlimited.
     */
    maxConcurrent?: number;
    /**
     * Debounce window in milliseconds for high-frequency events (step/end,
     * tool/*, …): triggers inside the window collapse into one trailing
     * execution carrying the latest context. Defaults to 0 (disabled).
     */
    debounceMs?: number;
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
    /**
     * Consecutive failure count (spawn-failed / exit-nonzero / timeout /
     * send-failed; one logical run counts once, internal retries included)
     * that emits the synthetic `hook/failed` event. Defaults to 3; values
     * below 1 are clamped to 1.
     */
    failedAlertThreshold?: number;
}
export declare const Config: {
    (data?: Config | null): Config;
    meta: {
        description?: string | Record<string, string>;
    };
};

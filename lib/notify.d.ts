import type { HookContext } from './context.js';
import type { NotifySpec } from './config.js';
import type { HookRunRecord } from './history.js';
export interface NotifyResult {
    ok: boolean;
    error?: string;
}
export type NotifyRecord = (record: Omit<HookRunRecord, 'ts'>) => void;
/**
 * Retry policy for the built-in notify channels — the same two knobs the
 * `run` channel takes, resolved from the hook declaration by the caller.
 */
export interface NotifyRetryOptions {
    /** Retries after the first attempt. Defaults to 0 (one attempt, never retried). */
    retries?: number;
    /** Base delay between retries in milliseconds; doubles per attempt. Defaults to 500. */
    retryDelayMs?: number;
    /** Retry progress lines (defaults to `console.warn`). */
    log?: (line: string) => void;
}
/** Fetch timeout for webhook sends (ms). */
export declare const NOTIFY_TIMEOUT_MS = 10000;
/**
 * HTTP statuses worth retrying: rate limiting, request timeout, and
 * server-side failures (a cold endpoint answering 502/503 is the classic
 * case). Any other 4xx means the request itself is wrong — retrying it can
 * only waste time.
 */
export declare function isRetryableStatus(status: number): boolean;
/** One-line summary for Slack-style and desktop notifications. */
export declare function summarizeContext(ctx: HookContext): string;
/** Structured JSON document for the webhook channel (present fields only). */
export declare function webhookPayload(ctx: HookContext): Record<string, unknown>;
/**
 * POST the context to a webhook endpoint, honouring the hook's
 * `retries` / `retryDelayMs` exactly like the `run` channel: up to
 * `retries` extra attempts after the first one, with the delay doubling per
 * attempt. Retryable failures are transport errors (connection reset,
 * timeout) and HTTP 408/429/5xx. The URL comes from `spec.url` or the
 * `DSH_HOOKS_WEBHOOK_URL` environment variable.
 */
export declare function sendWebhook(spec: NotifySpec, ctx: HookContext, env?: NodeJS.ProcessEnv, retry?: NotifyRetryOptions): Promise<NotifyResult>;
/**
 * Desktop balloon/toast notification. The summary travels through an
 * environment variable (Windows PowerShell) or argv (macOS/Linux), never
 * through shell-string interpolation.
 */
export declare function sendDesktop(spec: NotifySpec, ctx: HookContext): Promise<NotifyResult>;
/**
 * Fire a built-in notification; failures only warn and surface in the result.
 * `retry` carries the hook's `retries` / `retryDelayMs` — honoured by the
 * webhook channel; the desktop channel is a local spawn and never retries.
 */
export declare function fireNotify(spec: NotifySpec, ctx: HookContext, record?: NotifyRecord, retry?: NotifyRetryOptions): Promise<NotifyResult>;

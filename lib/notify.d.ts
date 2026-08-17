import type { HookContext } from './context.js';
import type { NotifySpec } from './config.js';
export interface NotifyResult {
    ok: boolean;
    error?: string;
}
/** Fetch timeout for webhook sends (ms). */
export declare const NOTIFY_TIMEOUT_MS = 10000;
/** One-line summary for Slack-style and desktop notifications. */
export declare function summarizeContext(ctx: HookContext): string;
/** Structured JSON document for the webhook channel (present fields only). */
export declare function webhookPayload(ctx: HookContext): Record<string, unknown>;
/**
 * POST the context to a webhook endpoint. One retry on transport failure
 * (webhook endpoints often drop the first request when cold). The URL comes
 * from `spec.url` or the `DSH_HOOKS_WEBHOOK_URL` environment variable.
 */
export declare function sendWebhook(spec: NotifySpec, ctx: HookContext, env?: NodeJS.ProcessEnv): Promise<NotifyResult>;
/**
 * Desktop balloon/toast notification. The summary travels through an
 * environment variable (Windows PowerShell) or argv (macOS/Linux), never
 * through shell-string interpolation.
 */
export declare function sendDesktop(spec: NotifySpec, ctx: HookContext): Promise<NotifyResult>;
/** Fire a built-in notification; failures only warn. */
export declare function fireNotify(spec: NotifySpec, ctx: HookContext): Promise<void>;

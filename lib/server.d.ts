/**
 * /dsh-hooks/* HTTP routes for the web profile: status (incl. the hook
 * list and live runner stats), execution history, a dry-run-style test
 * trigger, notify-channel quick tests, the hook-list editor (writes back
 * to the profile's cordis.patch.yml with a backup), and the Feishu connect
 * flow (QR setup / cancel / config / test card / disconnect). Registered
 * only when the shared webserver service exists (web profile) — CLI/headless
 * environments never see them. Loopback-only by default, with JSON envelopes; POSTs
 * require an explicit application/json content-type (CSRF hardening, same
 * posture as dsh-aionui-panel).
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { HookSpec } from './config.js';
import type { HistorySink } from './history.js';
import { type HookRunner } from './runner.js';
import { type FeishuSetupManager } from './feishu-session.js';
import { runFeishuTest } from './feishu.js';
/** Minimal structural shape of the shared web server (dsh-host-webserver). */
export interface WebServerLike {
    register(spec: {
        kind: 'prefix' | 'exact';
        path: string;
        handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
    }): () => void;
}
/** Plugin version, read from package.json (this package ships its own). */
export declare function pluginVersion(): string;
/** DSH_HOOKS_ALLOWED_IPS: unset/empty = loopback; * = any; otherwise comma-separated IPs. */
export declare function isLoopbackRequest(req: IncomingMessage): boolean;
export interface FeishuRouteDeps {
    /** QR-scan session manager (one in-flight flow at a time). */
    manager: FeishuSetupManager;
    /** Test-card sender, injectable for tests. */
    runTest?: typeof runFeishuTest;
    /** Credential file the status route summarizes. */
    configPath?: string;
}
export interface HookRoutesOptions {
    hooks: readonly HookSpec[];
    history: HistorySink;
    version?: string;
    feishu?: FeishuRouteDeps;
    /** Live runner counters for the diagnostics badge. */
    runner?: Pick<HookRunner, 'stats'>;
    /** Profile → patch-file resolver, injectable so tests never touch the real home. */
    resolvePatchFile?: (profile: string) => string;
}
/** Sanitized per-hook description for the settings panel (regex sources, no RegExp objects). */
export declare function describeHooks(hooks: readonly HookSpec[]): {
    index: number;
    on: "agent/created" | "agent/disposed" | "agent/error" | "agent/status" | "approval/asked" | "approval/decided" | "session/created" | "session/disposed" | "session/title" | "step/end" | "tool/call" | "tool/result" | "turn/end" | "turn/start" | "user/message";
    when: "aborted" | "blocked" | "completed" | "error" | "interrupted" | "max-tokens" | undefined;
    match: {
        [k: string]: string;
    } | undefined;
    run: string | undefined;
    notify: {
        channel: "desktop" | "webhook";
        url: string | undefined;
        slack: boolean | undefined;
    } | undefined;
    input: "env" | "stdin" | undefined;
    timeoutMs: number | undefined;
    retries: number | undefined;
    retryDelayMs: number | undefined;
}[];
/** Create the /dsh-hooks route handler (exported for tests). */
export declare function createHookHandler(options: HookRoutesOptions): (req: IncomingMessage, res: ServerResponse) => Promise<void>;
/** Register the /dsh-hooks prefix route on the shared web server. */
export declare function registerHookRoutes(webServer: WebServerLike, options: HookRoutesOptions): () => void;

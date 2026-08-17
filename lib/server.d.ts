/**
 * /dsh-hooks/* HTTP routes for the web profile: status, execution history,
 * and a dry-run-style test trigger. Registered only when the shared
 * webserver service exists (web profile) — CLI/headless environments never
 * see them. Loopback-only with JSON envelopes; POSTs require an explicit
 * application/json content-type (CSRF hardening, same posture as
 * dsh-aionui-panel).
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { HookSpec } from './config.js';
import type { HistorySink } from './history.js';
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
/** Loopback fence: never let a LAN client reach /dsh-hooks operations. */
export declare function isLoopbackRequest(req: IncomingMessage): boolean;
export interface HookRoutesOptions {
    hooks: readonly HookSpec[];
    history: HistorySink;
    version?: string;
}
/** Create the /dsh-hooks route handler (exported for tests). */
export declare function createHookHandler(options: HookRoutesOptions): (req: IncomingMessage, res: ServerResponse) => Promise<void>;
/** Register the /dsh-hooks prefix route on the shared web server. */
export declare function registerHookRoutes(webServer: WebServerLike, options: HookRoutesOptions): () => void;

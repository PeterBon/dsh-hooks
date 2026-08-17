import { type ChildProcess } from 'node:child_process';
import type { HookContext } from './context.js';
import type { HookSpec } from './config.js';
export interface RunOutcome {
    ok: boolean;
    reason: 'ran' | 'timeout' | 'spawn-failed' | 'skipped';
    detail?: string;
}
/** Track in-flight hook runs so a missing parent never outlives teardown. */
export interface HookRunner {
    run(spec: HookSpec, ctx: HookContext): RunOutcome;
    dispose(): void;
}
export declare const DEFAULT_TIMEOUT_MS = 10000;
export declare const DEFAULT_RETRY_DELAY_MS = 500;
/**
 * Terminate a spawned hook process. With `shell: true` on Windows the direct
 * child is cmd.exe — killing only the shell orphans the actual hook command
 * (e.g. `node notify-feishu.mjs`), so kill the whole tree first. The direct
 * kill stays as the fallback (and the only path off Windows).
 */
export declare function terminate(child: ChildProcess): void;
/**
 * Fire-and-forget command runner. Emissions are irreversible side effects:
 * failures only warn, never block the agent loop. Context travels through
 * environment variables (no data interpolation into the shell string);
 * `{{var}}` placeholders are substituted from the same map for explicit
 * templating by the user. `input: 'stdin'` additionally writes the full
 * context as one JSON document to stdin, and `retries` re-spawns commands
 * whose exit code is non-zero (with exponential backoff, in the background).
 */
export declare function createHookRunner(log?: (line: string) => void): HookRunner;

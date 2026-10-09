import { type ChildProcess } from 'node:child_process';
import type { HookContext } from './context.js';
import type { HookSpec } from './config.js';
import type { HookRunRecord } from './history.js';
export interface RunOutcome {
    ok: boolean;
    reason: 'ran' | 'timeout' | 'spawn-failed' | 'skipped';
    detail?: string;
}
/** Track in-flight hook runs so a missing parent never outlives teardown. */
export interface HookRunner {
    run(spec: HookSpec, ctx: HookContext, recordOverride?: RunRecord, limiter?: RunLimiter): RunOutcome;
    /** Live counters for the web-panel diagnostics. */
    stats(): HookRunnerStats;
    dispose(): void;
}
export interface HookRunnerStats {
    /** Spawned children still running (waiting for their exit). */
    inFlight: number;
    /** Retry timers scheduled in the background. */
    pendingRetries: number;
}
export type RunRecord = (record: Omit<HookRunRecord, 'ts'>) => void;
/**
 * Per-hook concurrency gate: runs carrying the same `id` share one cap.
 * Accepted runs occupy a slot until the logical run reaches a terminal
 * outcome (retries keep the slot), so a retrying hook still counts.
 */
export interface RunLimiter {
    id: string;
    max: number;
}
export declare const DEFAULT_TIMEOUT_MS = 10000;
export declare const DEFAULT_RETRY_DELAY_MS = 500;
/**
 * Ceiling for the exponential retry backoff. Without it `retryDelayMs * 2 ** n`
 * grows into minutes (`retries: 10` at the 500 ms default waits ~256 s for its
 * last attempt), which keeps a logical run — and its `maxConcurrent` slot —
 * alive long after the triggering event and makes the history timeline
 * unreadable.
 */
export declare const MAX_RETRY_DELAY_MS = 30000;
/** Backoff before one retry attempt: base doubling, capped at {@link MAX_RETRY_DELAY_MS}. */
export declare function retryDelayFor(baseDelayMs: number, attempt: number): number;
/**
 * Trim captured stdout/stderr to `maxBytes` of real UTF-8 text, cutting on a
 * character boundary (a half-written multi-byte sequence would otherwise show
 * up as U+FFFD in the failure diagnostic). Exported for tests.
 */
export declare function capCaptureText(text: string, maxBytes?: number): string;
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
 * `cwd` moves the spawn into the session/project directory, and an optional
 * `limiter` caps concurrent runs per identity.
 */
export declare function createHookRunner(log?: (line: string) => void, record?: RunRecord): HookRunner;

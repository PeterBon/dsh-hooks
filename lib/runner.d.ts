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
/**
 * Fire-and-forget command runner. Emissions are irreversible side effects:
 * failures only warn, never retried, never block the agent loop.
 * Context travels through environment variables (no data interpolation into
 * the shell string); `{{var}}` placeholders are substituted from the same
 * map for explicit templating by the user.
 */
export declare function createHookRunner(log?: (line: string) => void): HookRunner;

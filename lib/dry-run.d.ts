import { type HookSpec, type TurnEndReasonKind } from './config.js';
import type { HookContext } from './context.js';
/** Profile patch file for a profile name. */
export declare function patchFilePath(profile: string): string;
/**
 * Load and normalize the dsh-hooks config block from a profile's
 * cordis.patch.yml. Runs the block through the Config schema so match
 * regexes compile and invalid entries fail loudly.
 */
export declare function loadHooks(profile: string, paths?: {
    patchFile?: string;
}): {
    hooks: HookSpec[];
    source: string;
};
/**
 * Resolve the JSONL path a profile's dsh-hooks config writes history to
 * (`config.history.path`, else the plugin default). Deliberately lenient:
 * `tail` must keep working while the config file is missing or mid-edit.
 */
export declare function loadHistoryPath(profile: string, paths?: {
    patchFile?: string;
}): string;
/**
 * Numeric context fields a simulated event may override — the ones a `match`
 * comparison can meaningfully target. Strings keep their dedicated CLI flag /
 * tester input (`--tool`, `--session-name`, …) and the mock defaults.
 */
export declare const MOCK_NUMERIC_FIELDS: readonly ['turn', 'step', 'durationMs', 'toolDurationMs', 'runningSubagents', 'totalSubagents', 'treeDurationMs', 'usageTurns', 'usageSessions', 'usageInputTokens', 'usageOutputTokens', 'usageCacheReadTokens', 'usageCacheWriteTokens', 'usageReasoningTokens'];
export type MockNumericField = (typeof MOCK_NUMERIC_FIELDS)[number];
export interface MockFieldsResult {
    ctx: HookContext;
    /** Keys that were dropped: unknown field names or non-finite numbers. */
    ignored: string[];
}
/**
 * Apply explicit numeric overrides to a simulated context. Values must be
 * finite numbers; anything else (unknown field, string, NaN) is reported in
 * `ignored` instead of being silently coerced — a tester must never "pass"
 * because a filter was fed the wrong type.
 */
export declare function applyMockFields(ctx: HookContext, fields: Record<string, unknown> | undefined): MockFieldsResult;
/** A synthetic context for the simulated event, overridable per field. */
export declare function mockContext(event: string, overrides?: Partial<HookContext>): HookContext;
export interface DryRunLine {
    /** 1-based hook index in the config. */
    index: number;
    matched: boolean;
    /** Short reason the hook was skipped (empty when matched). */
    why: string;
    /** One-line hook description. */
    summary: string;
}
/** One-line hook description for report rows. */
export declare function describeHook(hook: HookSpec): string;
/** Evaluate every hook against the simulated event/context. */
export declare function evaluateHooks(hooks: readonly HookSpec[], event: string, ctx: HookContext, reasonKind?: TurnEndReasonKind): DryRunLine[];
export interface DryRunOptions {
    profile?: string;
    event: string;
    reason?: TurnEndReasonKind;
    tool?: string;
    sessionName?: string;
    /** Explicit numeric context overrides (see {@link MOCK_NUMERIC_FIELDS}). */
    fields?: Record<string, unknown>;
    /** Actually run the matching hooks (real side effects!). */
    execute?: boolean;
    print?: (line: string) => void;
    paths?: {
        patchFile?: string;
    };
}
/** Full dry-run report; optionally executes the matching hooks. */
export declare function runDryRun(options: DryRunOptions): Promise<{
    matched: number;
    total: number;
}>;

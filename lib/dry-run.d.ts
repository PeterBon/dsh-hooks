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

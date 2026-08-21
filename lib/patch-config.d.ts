/** Wire shape for one hook as the settings panel sends it (string regexes). */
export interface HookWireSpec {
    on: string;
    when?: string;
    match?: Record<string, string>;
    run?: string;
    notify?: {
        channel: 'webhook' | 'desktop';
        url?: string;
        slack?: boolean;
    } | null;
    input?: 'env' | 'stdin';
    timeoutMs?: number;
    retries?: number;
    retryDelayMs?: number;
}
/** Parse a patch list; throws a user-facing error on malformed YAML. */
export declare function parsePatchText(text: string): unknown[];
/**
 * Validate the wire hooks before they ever touch a file. Returns a
 * user-facing error message, or null when every hook is valid.
 */
export declare function validateHookWire(hooks: HookWireSpec[]): string | null;
/**
 * Replace the dsh-hooks block's hooks in a patch list. Other entries and
 * other config of the dsh-hooks entry (e.g. `history`) stay untouched; a
 * missing dsh-hooks entry is appended.
 */
export declare function patchTextWithHooks(existingText: string, hooks: HookWireSpec[]): string;
/** Timestamped backup path for a patch file. */
export declare function backupPathFor(patchFile: string, now?: Date): string;
export interface WriteHooksResult {
    patchFile: string;
    backupPath: string;
    hookCount: number;
}
/**
 * Validate and persist the hook list into a profile's cordis.patch.yml.
 * The previous content is backed up beside the file first.
 */
export declare function writeHooksConfig(patchFile: string, hooks: HookWireSpec[]): WriteHooksResult;
/**
 * Drop every hook whose `run` references the given script (the stable
 * notify-feishu.mjs copy), used by the Feishu disconnect flow. Other
 * entries and config stay untouched.
 */
export declare function removeScriptHooks(patchFile: string, scriptMarker: string): void;

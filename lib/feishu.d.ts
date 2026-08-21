import type { registerApp } from '@larksuiteoapi/node-sdk';
/** Feishu config dir: credentials + the stable copy of the notify script. */
export declare const FEISHU_CONFIG_DIR: string;
export declare const FEISHU_CONFIG_PATH: string;
/** Card content truncation length written by setup (notify script default). */
export declare const FEISHU_RESULT_MAX_CHARS_DEFAULT = 300;
/** UI-accepted truncation range (characters). */
export declare const FEISHU_RESULT_MAX_CHARS_MIN = 50;
export declare const FEISHU_RESULT_MAX_CHARS_MAX = 5000;
/** Injectable file paths, so tests (and the web routes) stay off the real home. */
export interface FeishuSetupPaths {
    /** Credential file (default ~/.dsh/dsh-hooks/feishu-config.json). */
    configPath?: string;
    /** Profile patch file (default ~/.dsh/profiles/<profile>/cordis.patch.yml). */
    patchFile?: string;
    /** Stable notify-script location the hooks reference. */
    notifyScript?: string;
}
export interface FeishuQRCodeInfo {
    url: string;
    /** Seconds until the QR authorization expires. */
    expireIn: number;
}
export interface RunFeishuSetupOptions {
    /** Profile whose cordis.patch.yml receives the dsh-hooks config block. */
    profile?: string;
    /** Overrides the real registerApp (tests). */
    registerAppFn?: typeof registerApp;
    print?: (line: string) => void;
    printErr?: (line: string) => void;
    /** Called when the QR authorization is ready (CLI prints it; web renders it). */
    onQRCodeReady?: (qr: FeishuQRCodeInfo) => void | Promise<void>;
    /** Abort the scan wait (web cancel). */
    signal?: AbortSignal;
    /** Card content truncation length written into the credential file. */
    resultMaxChars?: number;
    paths?: FeishuSetupPaths;
}
export interface FeishuSetupResult {
    appId: string;
    ownerOpenId: string;
}
/** Profile patch file for a profile name. */
export declare function patchPath(profile: string): string;
/** Which hooks the setup installs into the profile. */
export declare function setupHooks(scriptPath: string): ({
    on: string;
    when: string;
    run: string;
    timeoutMs: number;
} | {
    when?: undefined;
    on: string;
    run: string;
    timeoutMs: number;
})[];
/** Absolute path of the shipped notify script (works from both lib/ and src/). */
export declare function notifyScriptPath(): string;
/**
 * Resolve the stable notify-script location hooks should reference. The npx
 * cache (where the CLI often runs from) is ephemeral, so the setup copies the
 * zero-dependency script next to feishu-config.json:
 * ~/.dsh/dsh-hooks/notify-feishu.mjs. Re-copies on every setup so the stable
 * copy tracks the installed version.
 */
export declare function stableScriptPath(paths?: FeishuSetupPaths): string;
/**
 * Write the credential file with 0600 perms (owner-only): secrets stay out of
 * the repo and argv.
 */
export declare function writeConfig(configPath: string, { appId, appSecret, targetType, targetId, resultMaxChars }: {
    appId: string;
    appSecret: string;
    targetType?: string;
    targetId: string;
    resultMaxChars?: number;
}): void;
/**
 * Merge the dsh-hooks config block into a profile's cordis.patch.yml:
 * existing dsh-hooks entries keep unrelated config and get their hooks
 * replaced with `setupHooks`; other entries stay untouched. Idempotent.
 */
export declare function mergePatchYaml(existingText: string, { scriptPath }: {
    scriptPath: string;
}): string;
/**
 * Full setup flow: registerApp (QR scan creates the Feishu app), write
 * credentials + the stable notify script, merge the card hooks into the
 * profile patch, and send a welcome card to the scanning user.
 */
export declare function runFeishuSetup(options?: RunFeishuSetupOptions): Promise<FeishuSetupResult>;
export interface RunFeishuTestOptions {
    print?: (line: string) => void;
    paths?: FeishuSetupPaths;
}
/** Test the stored credentials and send a test card to the configured target. */
export declare function runFeishuTest(options?: RunFeishuTestOptions): Promise<string>;
/** Mask an identifier for display: `cli_a1b2…9012`. Never shows the secret. */
export declare function maskId(value: string | null): string | null;
/** Readable connection summary for the settings UI (credentials never leave this module). */
export interface FeishuSummary {
    configured: boolean;
    appId: string | null;
    targetKind: string | null;
    target: string | null;
    /** Card content truncation length (from the credential file, or the default). */
    resultMaxChars: number;
    /** Sample card content truncated at `resultMaxChars` (editor preview). */
    preview: string;
}
/** Truncate the preview sample the way the notify script truncates content. */
export declare function truncatePreview(text: string, max: number): string;
/**
 * Inspect the credential file for a display-only summary. The app secret is
 * read for presence only and never enters any returned value.
 */
export declare function readFeishuSummary(configPath?: string): FeishuSummary;
/** Delete the credential file; returns whether it existed. */
export declare function deleteFeishuConfig(configPath?: string): boolean;
/**
 * Update the card truncation length in an existing credential file, keeping
 * every other field (credentials, target) untouched. Throws a user-facing
 * error for invalid input or a missing/unparsable file.
 */
export declare function updateFeishuResultMaxChars(configPath: string | undefined, value: number): number;

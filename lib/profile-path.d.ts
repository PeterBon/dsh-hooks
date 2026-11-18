/** Absolute path of the profiles directory (`~/.dsh/profiles`). */
export declare function profilesRoot(): string;
/** Whether a string may be used as a profile name. */
export declare function isProfileNameValid(profile: string): boolean;
/**
 * Existing profiles that can be written to, sorted by name. A directory counts
 * as a profile when it carries a composed `cordis.yml` or a user patch
 * `cordis.patch.yml`; `node_modules` and other stray directories are excluded.
 * The running profile is always included, even when its directory has not been
 * materialized yet. Read errors degrade to "only the running profile".
 */
export declare function listProfiles(running?: string, root?: string): string[];
/**
 * Best-effort name of the profile this process runs inside.
 *
 * `DSH_PROFILE` is the obvious source, but the Desktop host launches the
 * runtime as `…/dsh-desktop-host/lib/index.js <app> <profileDir> …` without
 * exporting that variable, so the profile directory on argv must be read too —
 * otherwise the settings panel defaults to `web` on every desktop profile.
 * Returns an empty string when the profile cannot be determined.
 */
export declare function detectRunningProfile(argv?: readonly string[], env?: NodeJS.ProcessEnv): string;
/**
 * Validate a profile name, returning it unchanged.
 * @throws Error naming the offending value when the name is not one segment.
 */
export declare function assertProfileName(profile: string): string;
/**
 * Absolute `cordis.patch.yml` path of a profile.
 *
 * Validates the name and re-checks that the resolved file is still inside the
 * profiles root — the second check is redundant while {@link PROFILE_NAME}
 * holds, and exists so that weakening the pattern cannot go unnoticed.
 *
 * @throws Error when the name is invalid or the path escapes the profiles root.
 */
export declare function profilePatchFile(profile: string): string;

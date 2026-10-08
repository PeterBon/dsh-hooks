/** Absolute path of the profiles directory (`~/.dsh/profiles`). */
export declare function profilesRoot(): string;
/** Whether a string may be used as a profile name. */
export declare function isProfileNameValid(profile: string): boolean;
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

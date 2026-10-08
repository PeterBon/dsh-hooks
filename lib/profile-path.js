/**
 * Profile-name containment: every path the plugin derives from a user-supplied
 * profile name is built here, and every name is validated first.
 *
 * Why this module exists: `POST /dsh-hooks/hooks/save`, `/dsh-hooks/feishu/setup`
 * and `/dsh-hooks/feishu/disconnect` all take a `profile` straight from the
 * request body and turn it into `~/.dsh/profiles/<profile>/cordis.patch.yml`.
 * An unvalidated `profile` of `../../..` therefore escapes the profiles root
 * and lets a caller overwrite a `cordis.patch.yml` in any *existing* directory
 * — including another profile, whose hooks (arbitrary shell commands) would run
 * the next time that profile boots.
 *
 * The rule: a profile name is one path segment. Allowlist it, then re-check the
 * resolved path still lives under the profiles root, so a future edit that
 * loosens the pattern cannot silently reopen the hole.
 */
import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';
/**
 * Conservative single-segment allowlist: starts alphanumeric, then letters,
 * digits, dot, underscore, dash. Deliberately excludes path separators, drive
 * colons, whitespace, and a leading dot (so `.` / `..` / dotfiles are out).
 */
const PROFILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
/** Absolute path of the profiles directory (`~/.dsh/profiles`). */
export function profilesRoot() {
    return join(homedir(), '.dsh', 'profiles');
}
/** Whether a string may be used as a profile name. */
export function isProfileNameValid(profile) {
    return PROFILE_NAME.test(profile);
}
/**
 * Validate a profile name, returning it unchanged.
 * @throws Error naming the offending value when the name is not one segment.
 */
export function assertProfileName(profile) {
    if (!isProfileNameValid(profile)) {
        throw new Error(`非法 profile 名称：${JSON.stringify(profile)}（只允许字母数字开头、后接字母数字与 . _ -，最长 64 字符）`);
    }
    return profile;
}
/**
 * Absolute `cordis.patch.yml` path of a profile.
 *
 * Validates the name and re-checks that the resolved file is still inside the
 * profiles root — the second check is redundant while {@link PROFILE_NAME}
 * holds, and exists so that weakening the pattern cannot go unnoticed.
 *
 * @throws Error when the name is invalid or the path escapes the profiles root.
 */
export function profilePatchFile(profile) {
    assertProfileName(profile);
    const root = resolve(profilesRoot());
    const file = resolve(root, profile, 'cordis.patch.yml');
    if (!file.startsWith(root + sep)) {
        throw new Error(`profile 路径越界：${JSON.stringify(profile)}`);
    }
    return file;
}

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
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
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
 * Existing profiles that can be written to, sorted by name. A directory counts
 * as a profile when it carries a composed `cordis.yml` or a user patch
 * `cordis.patch.yml`; `node_modules` and other stray directories are excluded.
 * The running profile is always included, even when its directory has not been
 * materialized yet. Read errors degrade to "only the running profile".
 */
export function listProfiles(running = '', root = profilesRoot()) {
    const names = new Set();
    if (isProfileNameValid(running))
        names.add(running);
    try {
        for (const entry of readdirSync(root, { withFileTypes: true })) {
            if (!entry.isDirectory() || !isProfileNameValid(entry.name))
                continue;
            const dir = join(root, entry.name);
            if (existsSync(join(dir, 'cordis.yml')) || existsSync(join(dir, 'cordis.patch.yml'))) {
                names.add(entry.name);
            }
        }
    }
    catch {
        // Missing/unreadable profiles root: the running profile is all we know.
    }
    return [...names].sort((a, b) => a.localeCompare(b));
}
/**
 * Best-effort name of the profile this process runs inside.
 *
 * `DSH_PROFILE` is the obvious source, but the Desktop host launches the
 * runtime as `…/dsh-desktop-host/lib/index.js <app> <profileDir> …` without
 * exporting that variable, so the profile directory on argv must be read too —
 * otherwise the settings panel defaults to `web` on every desktop profile.
 * Returns an empty string when the profile cannot be determined.
 */
export function detectRunningProfile(argv = process.argv, env = process.env) {
    const fromEnv = (env.DSH_PROFILE ?? '').trim();
    if (isProfileNameValid(fromEnv))
        return fromEnv;
    const envDir = (env.DSH_PROFILE_DIR ?? '').trim();
    if (envDir !== '') {
        const name = basename(envDir);
        if (isProfileNameValid(name))
            return name;
    }
    for (let i = 0; i < argv.length; i++) {
        const arg = (argv[i] ?? '').trim();
        if (arg === '--profile') {
            const next = (argv[i + 1] ?? '').trim();
            if (isProfileNameValid(next))
                return next;
            continue;
        }
        if (arg.startsWith('--profile=')) {
            const value = arg.slice('--profile='.length).trim();
            if (isProfileNameValid(value))
                return value;
            continue;
        }
        // `…/.dsh/profiles/<name>` (Desktop host) or `…/.dsh/profiles/<name>/` on
        // any platform.
        const match = /[\\/]profiles[\\/]([^\\/]+)[\\/]?$/i.exec(arg);
        if (match !== null && isProfileNameValid(match[1]))
            return match[1];
    }
    return '';
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

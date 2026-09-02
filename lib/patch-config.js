/**
 * Patch-file plumbing for the settings-panel hook editor and the Feishu
 * disconnect flow: read a profile's cordis.patch.yml, replace the dsh-hooks
 * block's hooks while keeping every other entry (and other dsh-hooks
 * config, e.g. `history`) untouched, and write back with a timestamped
 * backup. The profile layer is hot-reloaded by the harness's patch watcher,
 * so a save applies without a restart.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import YAML from 'yaml';
import { HOOK_EVENTS, TURN_END_REASONS } from './config.js';
/** Parse a patch list; throws a user-facing error on malformed YAML. */
export function parsePatchText(text) {
    let entries;
    try {
        entries = YAML.parse(text || '[]\n');
    }
    catch {
        throw new Error('cordis.patch.yml 解析失败，请先修复该文件');
    }
    if (!Array.isArray(entries))
        throw new Error('cordis.patch.yml 顶层必须是 YAML 数组');
    return entries;
}
/**
 * Validate the wire hooks before they ever touch a file. Returns a
 * user-facing error message, or null when every hook is valid.
 */
export function validateHookWire(hooks) {
    for (const [i, hook] of hooks.entries()) {
        const label = `hook #${i + 1}`;
        if (!HOOK_EVENTS.includes(hook.on)) {
            return `${label}：无效事件 ${hook.on}`;
        }
        if (hook.when !== undefined && !TURN_END_REASONS.includes(hook.when)) {
            return `${label}：无效 when 原因 ${hook.when}`;
        }
        if (hook.match !== undefined) {
            for (const [field, pattern] of Object.entries(hook.match)) {
                if (field === '')
                    return `${label}：match 字段名不能为空`;
                try {
                    new RegExp(pattern);
                }
                catch (error) {
                    return `${label}：match.${field} 正则无效（${error instanceof Error ? error.message : String(error)}）`;
                }
            }
        }
        const hasRun = typeof hook.run === 'string' && hook.run.trim() !== '';
        const hasNotify = hook.notify !== undefined && hook.notify !== null;
        if (hasRun === hasNotify) {
            return `${label}：run 与 notify 必须且只能声明一个`;
        }
        if (hasNotify && hook.notify.channel !== 'webhook' && hook.notify.channel !== 'desktop') {
            return `${label}：无效通知渠道 ${hook.notify.channel}`;
        }
        for (const key of ['timeoutMs', 'retries', 'retryDelayMs', 'maxConcurrent', 'debounceMs']) {
            const value = hook[key];
            if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
                return `${label}：${key} 必须是非负数字`;
            }
        }
        if (hook.cwd !== undefined && hook.cwd !== '' && hook.cwd !== 'session' && !isAbsolute(hook.cwd)) {
            return `${label}：cwd 必须是 session 或绝对路径（收到 ${hook.cwd}）`;
        }
    }
    return null;
}
/**
 * Replace the dsh-hooks block's hooks in a patch list. Other entries and
 * other config of the dsh-hooks entry (e.g. `history`) stay untouched; a
 * missing dsh-hooks entry is appended.
 */
export function patchTextWithHooks(existingText, hooks) {
    const entries = parsePatchText(existingText);
    let found = false;
    for (const entry of entries) {
        if (entry !== null && typeof entry === 'object' && entry.id === 'dsh-hooks') {
            const target = entry;
            target.name = 'dsh-hooks';
            target.config = { ...(target.config ?? {}), hooks };
            found = true;
            break;
        }
    }
    if (!found)
        entries.push({ id: 'dsh-hooks', name: 'dsh-hooks', config: { hooks } });
    return YAML.stringify(entries);
}
/** Timestamped backup path for a patch file. */
export function backupPathFor(patchFile, now = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    return `${patchFile}.bak-${stamp}`;
}
/**
 * Validate and persist the hook list into a profile's cordis.patch.yml.
 * The previous content is backed up beside the file first.
 */
export function writeHooksConfig(patchFile, hooks) {
    const invalid = validateHookWire(hooks);
    if (invalid !== null)
        throw new Error(invalid);
    const existing = existsSync(patchFile) ? readFileSync(patchFile, 'utf8') : '[]\n';
    const backupPath = backupPathFor(patchFile);
    writeFileSync(backupPath, existing, 'utf8');
    writeFileSync(patchFile, patchTextWithHooks(existing, hooks), 'utf8');
    return { patchFile, backupPath, hookCount: hooks.length };
}
/**
 * Drop every hook whose `run` references the given script (the stable
 * notify-feishu.mjs copy), used by the Feishu disconnect flow. Other
 * entries and config stay untouched.
 */
export function removeScriptHooks(patchFile, scriptMarker) {
    if (!existsSync(patchFile))
        return;
    const existing = readFileSync(patchFile, 'utf8');
    const entries = parsePatchText(existing);
    let changed = false;
    for (const entry of entries) {
        if (entry === null || typeof entry !== 'object' || entry.id !== 'dsh-hooks')
            continue;
        const config = entry.config;
        const hooks = Array.isArray(config?.hooks) ? config.hooks : [];
        const kept = hooks.filter((hook) => {
            if (typeof hook.run !== 'string')
                return true;
            if (hook.run.includes(scriptMarker)) {
                changed = true;
                return false;
            }
            return true;
        });
        if (changed) {
            config.hooks = kept;
            const backupPath = backupPathFor(patchFile);
            writeFileSync(backupPath, existing, 'utf8');
            writeFileSync(patchFile, YAML.stringify(entries), 'utf8');
        }
        break;
    }
}

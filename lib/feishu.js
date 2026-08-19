/**
 * Shared Feishu notification setup: the one-shot app-creation flow
 * (`registerApp` + QR scan) plus credential/config plumbing. Used by both
 * the `dsh-hooks feishu-setup` CLI and the web profile's
 * `/dsh-hooks/feishu/*` routes — the CLI is a thin wrapper adding terminal
 * QR printing and the browser opener.
 *
 * The Feishu SDK and the qrcode renderer are never loaded at plugin apply
 * time: the SDK resolves through a dynamic import on first setup, so
 * headless/CLI profiles without a web server pay nothing for the UI path.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import YAML from 'yaml';
import { run as notifyRun } from '../examples/notify-feishu.mjs';
/** Feishu config dir: credentials + the stable copy of the notify script. */
export const FEISHU_CONFIG_DIR = join(homedir(), '.dsh', 'dsh-hooks');
export const FEISHU_CONFIG_PATH = join(FEISHU_CONFIG_DIR, 'feishu-config.json');
/** Card content truncation length written by setup (notify script default). */
export const FEISHU_RESULT_MAX_CHARS_DEFAULT = 300;
/** UI-accepted truncation range (characters). */
export const FEISHU_RESULT_MAX_CHARS_MIN = 50;
export const FEISHU_RESULT_MAX_CHARS_MAX = 5000;
/** Profile patch file for a profile name. */
export function patchPath(profile) {
    return join(homedir(), '.dsh', 'profiles', profile, 'cordis.patch.yml');
}
/** Which hooks the setup installs into the profile. */
export function setupHooks(scriptPath) {
    return [
        { on: 'turn/end', when: 'completed', run: `node ${JSON.stringify(scriptPath)}`, timeoutMs: 30000 },
        { on: 'turn/end', when: 'error', run: `node ${JSON.stringify(scriptPath)}`, timeoutMs: 30000 },
        { on: 'turn/end', when: 'aborted', run: `node ${JSON.stringify(scriptPath)}`, timeoutMs: 30000 },
        { on: 'approval/asked', run: `node ${JSON.stringify(scriptPath)} --approval`, timeoutMs: 30000 },
        { on: 'agent/error', run: `node ${JSON.stringify(scriptPath)}`, timeoutMs: 30000 },
    ];
}
/** Absolute path of the shipped notify script (works from both lib/ and src/). */
export function notifyScriptPath() {
    return new URL('../examples/notify-feishu.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
}
/**
 * Resolve the stable notify-script location hooks should reference. The npx
 * cache (where the CLI often runs from) is ephemeral, so the setup copies the
 * zero-dependency script next to feishu-config.json:
 * ~/.dsh/dsh-hooks/notify-feishu.mjs. Re-copies on every setup so the stable
 * copy tracks the installed version.
 */
export function stableScriptPath(paths = {}) {
    return paths.notifyScript ?? join(FEISHU_CONFIG_DIR, 'notify-feishu.mjs');
}
/**
 * Write the credential file with 0600 perms (owner-only): secrets stay out of
 * the repo and argv.
 */
export function writeConfig(configPath, { appId, appSecret, targetType = 'open_id', targetId, resultMaxChars = 300 }) {
    mkdirSync(join(configPath, '..'), { recursive: true, mode: 0o700 });
    const doc = JSON.stringify({
        app_id: appId,
        app_secret: appSecret,
        target_type: targetType,
        target_id: targetId,
        result_max_chars: resultMaxChars,
    }, null, 2);
    writeFileSync(configPath, doc + '\n', 'utf8');
    try {
        chmodSync(configPath, 0o600);
    }
    catch {
        // Windows: ACL-based protection; the file lives under the user profile.
    }
}
/**
 * Merge the dsh-hooks config block into a profile's cordis.patch.yml:
 * existing dsh-hooks entries keep unrelated config and get their hooks
 * replaced with `setupHooks`; other entries stay untouched. Idempotent.
 */
export function mergePatchYaml(existingText, { scriptPath }) {
    let entries;
    try {
        entries = YAML.parse(existingText || '[]\n');
    }
    catch {
        throw new Error('profile 的 cordis.patch.yml 解析失败，请先修复该文件');
    }
    if (!Array.isArray(entries))
        throw new Error('cordis.patch.yml 顶层必须是 YAML 数组');
    const hooks = setupHooks(scriptPath);
    let found = false;
    for (const entry of entries) {
        if (entry && typeof entry === 'object' && entry.id === 'dsh-hooks') {
            ;
            entry.name = 'dsh-hooks';
            entry.config = { hooks };
            found = true;
            break;
        }
    }
    if (!found)
        entries.push({ id: 'dsh-hooks', name: 'dsh-hooks', config: { hooks } });
    return YAML.stringify(entries);
}
/**
 * Full setup flow: registerApp (QR scan creates the Feishu app), write
 * credentials + the stable notify script, merge the card hooks into the
 * profile patch, and send a welcome card to the scanning user.
 */
export async function runFeishuSetup(options = {}) {
    const profile = options.profile ?? 'web';
    const print = options.print ?? console.log;
    const printErr = options.printErr ?? console.error;
    const paths = options.paths ?? {};
    const configPath = paths.configPath ?? FEISHU_CONFIG_PATH;
    const patchFile = paths.patchFile ?? patchPath(profile);
    const notifyScript = stableScriptPath(paths);
    print('dsh-hooks feishu-setup');
    print('1/4 正在生成飞书「一键创建应用」二维码…');
    // The SDK stays out of the module graph until the first setup actually runs.
    const registerAppFn = options.registerAppFn ?? (await import('@larksuiteoapi/node-sdk')).registerApp;
    const result = await registerAppFn({
        source: 'dsh-hooks',
        createOnly: true,
        appPreset: {
            name: 'DSH 通知机器人',
            desc: 'DeepSeek Harness 会话事件通知（dsh-hooks）',
        },
        addons: {
            preset: false,
            scopes: {
                tenant: ['im:message:send_as_bot'],
            },
        },
        signal: options.signal,
        onQRCodeReady: (authorization) => {
            // The SDK fires this once the authorization URL exists; the scan wait
            // is the registerApp promise itself. Caller-side failures must never
            // break the SDK's polling loop.
            void Promise.resolve(options.onQRCodeReady?.(authorization)).catch(() => undefined);
        },
    });
    const appId = result.client_id;
    const appSecret = result.client_secret;
    const ownerOpenId = result.user_info?.open_id;
    if (!appId || !appSecret)
        throw new Error('扫码创建未完成，未拿到应用凭证');
    if (!ownerOpenId)
        throw new Error('扫码结果缺少 open_id，请重试');
    print('');
    print(`2/4 应用创建成功：${appId}（机器人将私聊通知你）`);
    writeConfig(configPath, {
        appId,
        appSecret,
        targetType: 'open_id',
        targetId: ownerOpenId,
        resultMaxChars: options.resultMaxChars ?? FEISHU_RESULT_MAX_CHARS_DEFAULT,
    });
    print(`3/4 凭据已写入 ${configPath}（权限 0600，勿提交到仓库）`);
    // Copy the notify script to its stable location so hooks never reference
    // the ephemeral npx cache.
    if (!paths.notifyScript) {
        mkdirSync(FEISHU_CONFIG_DIR, { recursive: true, mode: 0o700 });
        writeFileSync(notifyScript, readFileSync(notifyScriptPath(), 'utf8'), 'utf8');
    }
    const existing = existsSync(patchFile) ? readFileSync(patchFile, 'utf8') : '[]\n';
    const merged = mergePatchYaml(existing, { scriptPath: notifyScript });
    writeFileSync(patchFile, merged, 'utf8');
    print(`4/4 hook 配置已写入 ${patchFile}`);
    print('发送欢迎卡片验证…');
    try {
        await notifyRun({
            appId,
            appSecret,
            to: ownerOpenId,
            event: 'agent/created',
            sessionId: 'dsh-hooks-setup',
            cwd: process.cwd(),
            timestamp: new Date().toISOString(),
        });
        print('✅ 欢迎卡片已发送。请重启 dsh web 使 hooks 生效。');
    }
    catch (error) {
        printErr(`⚠ 欢迎卡片发送失败（配置已就绪，可稍后用 feishu-test 重试）：${error instanceof Error ? error.message : String(error)}`);
    }
    return { appId, ownerOpenId };
}
/** Test the stored credentials and send a test card to the configured target. */
export async function runFeishuTest(options = {}) {
    const print = options.print ?? console.log;
    const configPath = options.paths?.configPath ?? FEISHU_CONFIG_PATH;
    if (!existsSync(configPath)) {
        throw new Error(`未找到配置文件 ${configPath}，请先运行 feishu-setup`);
    }
    let file;
    try {
        file = JSON.parse(readFileSync(configPath, 'utf8'));
    }
    catch {
        throw new Error(`配置文件 ${configPath} 解析失败，请重新运行 feishu-setup`);
    }
    const { app_id: appId, app_secret: appSecret, target_id: targetId } = file;
    if (typeof appId !== 'string' || appId === '' || typeof appSecret !== 'string' || appSecret === '' || typeof targetId !== 'string' || targetId === '') {
        throw new Error('配置文件不完整，请重新运行 feishu-setup');
    }
    await notifyRun({
        appId,
        appSecret,
        to: targetId,
        event: 'agent/status',
        status: 'connected',
        sessionId: 'feishu-test',
        cwd: process.cwd(),
        timestamp: new Date().toISOString(),
    });
    const line = '✅ 测试卡片已发送';
    print(line);
    return line;
}
/** Mask an identifier for display: `cli_a1b2…9012`. Never shows the secret. */
export function maskId(value) {
    if (value === null)
        return null;
    if (value.length <= 12)
        return value;
    return `${value.slice(0, 8)}…${value.slice(-4)}`;
}
/**
 * Inspect the credential file for a display-only summary. The app secret is
 * read for presence only and never enters any returned value.
 */
export function readFeishuSummary(configPath = FEISHU_CONFIG_PATH) {
    const empty = {
        configured: false,
        appId: null,
        targetKind: null,
        target: null,
        resultMaxChars: FEISHU_RESULT_MAX_CHARS_DEFAULT,
    };
    if (!existsSync(configPath))
        return empty;
    try {
        const file = JSON.parse(readFileSync(configPath, 'utf8'));
        const appId = typeof file.app_id === 'string' && file.app_id !== '' ? file.app_id : null;
        const secret = typeof file.app_secret === 'string' && file.app_secret !== '';
        const targetKind = typeof file.target_type === 'string' && file.target_type !== '' ? file.target_type : null;
        const target = typeof file.target_id === 'string' && file.target_id !== '' ? file.target_id : null;
        const resultMaxChars = typeof file.result_max_chars === 'number' && Number.isFinite(file.result_max_chars) && file.result_max_chars > 0
            ? Math.floor(file.result_max_chars)
            : FEISHU_RESULT_MAX_CHARS_DEFAULT;
        if (appId === null || !secret || target === null)
            return { ...empty, resultMaxChars };
        return { configured: true, appId: maskId(appId), targetKind, target: maskId(target), resultMaxChars };
    }
    catch {
        return empty;
    }
}
/**
 * Update the card truncation length in an existing credential file, keeping
 * every other field (credentials, target) untouched. Throws a user-facing
 * error for invalid input or a missing/unparsable file.
 */
export function updateFeishuResultMaxChars(configPath = FEISHU_CONFIG_PATH, value) {
    if (!Number.isFinite(value) || value < FEISHU_RESULT_MAX_CHARS_MIN || value > FEISHU_RESULT_MAX_CHARS_MAX) {
        throw new Error(`截断长度必须是 ${FEISHU_RESULT_MAX_CHARS_MIN}–${FEISHU_RESULT_MAX_CHARS_MAX} 之间的数字`);
    }
    const rounded = Math.floor(value);
    if (!existsSync(configPath))
        throw new Error('尚未连接飞书，请先扫码连接');
    let file;
    try {
        file = JSON.parse(readFileSync(configPath, 'utf8'));
    }
    catch {
        throw new Error('飞书配置文件解析失败，请重新连接');
    }
    if (typeof file !== 'object' || file === null)
        throw new Error('飞书配置文件解析失败，请重新连接');
    file.result_max_chars = rounded;
    writeFileSync(configPath, JSON.stringify(file, null, 2) + '\n', 'utf8');
    return rounded;
}

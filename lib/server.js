import { createRequire } from 'node:module';
import { applyMockFields, describeHook, evaluateHooks, MOCK_NUMERIC_FIELDS, mockContext, patchFilePath } from './dry-run.js';
import { isProfileNameValid } from './profile-path.js';
import { createHookRunner } from './runner.js';
import { fireNotify, summarizeContext } from './notify.js';
import { FEISHU_SETUP_BUSY } from './feishu-session.js';
import { deleteFeishuConfig, readFeishuSummary, runFeishuTest, updateFeishuResultMaxChars } from './feishu.js';
import { removeScriptHooks, writeHooksConfig } from './patch-config.js';
/** Plugin version, read from package.json (this package ships its own). */
export function pluginVersion() {
    const require = createRequire(import.meta.url);
    try {
        const pkg = require('../package.json');
        return typeof pkg.version === 'string' ? pkg.version : 'unknown';
    }
    catch {
        return 'unknown';
    }
}
const OK = (value) => ({ ok: true, value });
const FAIL = (code, message) => ({ ok: false, error: { code, message } });
function json(res, envelope, status = 200) {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(envelope));
}
/** DSH_HOOKS_ALLOWED_IPS: unset/empty = loopback; * = any; otherwise comma-separated IPs. */
export function isLoopbackRequest(req) {
    const allowedIps = process.env.DSH_HOOKS_ALLOWED_IPS?.trim() ?? '';
    if (allowedIps === '*')
        return true;
    // Check the direct peer only; never trust forwarded headers.
    const address = req.socket.remoteAddress ?? '';
    if (allowedIps !== '') {
        const normalize = (ip) => ip.trim().toLowerCase().replace(/^::ffff:/, '');
        return address !== '' && allowedIps.split(',').some((ip) => normalize(ip) === normalize(address));
    }
    return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}
/** Loopback hostnames a browser may legitimately use to reach this server. */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
/**
 * Extra accepted hostnames from `DSH_HOOKS_ALLOWED_HOSTS` (comma-separated,
 * hostnames without port, `*` = any). Needed when the GUI is reached through a
 * tunnel or reverse proxy: the proxy connects from loopback but forwards the
 * public hostname in `Host`, which the loopback allowlist alone would reject.
 */
function allowedHostnames() {
    return (process.env.DSH_HOOKS_ALLOWED_HOSTS ?? '')
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry !== '');
}
/** Hostname of an authority (`host:port`, `[::1]:port`, `host`). */
function hostnameOf(authority) {
    const trimmed = authority.trim().toLowerCase();
    if (trimmed.startsWith('[')) {
        const end = trimmed.indexOf(']');
        return end === -1 ? trimmed : trimmed.slice(0, end + 1);
    }
    const colon = trimmed.lastIndexOf(':');
    return colon === -1 ? trimmed : trimmed.slice(0, colon);
}
/** Whether one `Host`/`Origin` authority is loopback or explicitly allowed. */
function isTrustedAuthority(authority) {
    // A missing Host is allowed: every browser sends one, so an absent value only
    // comes from a non-browser caller that is already on this machine (and the
    // peer-IP fence above already decided that case).
    if (authority === undefined || authority.trim() === '')
        return true;
    const extra = allowedHostnames();
    if (extra.includes('*'))
        return true;
    const host = hostnameOf(authority);
    return LOOPBACK_HOSTS.has(host) || extra.includes(host);
}
/**
 * Host/Origin fence against DNS rebinding.
 *
 * The peer-IP check cannot see rebinding: a page on `evil.example` that the
 * browser resolves to 127.0.0.1 reaches us from loopback while the browser
 * treats it as same-origin — no preflight, and the response is readable. Both
 * `Host` and `Origin` still carry the attacker's hostname, so validating them
 * closes the hole. Set `DSH_HOOKS_ALLOWED_HOSTS` when a tunnel/proxy is in
 * front of the GUI (its forwarded hostname is not loopback).
 */
export function isTrustedHostRequest(req) {
    const host = req.headers.host;
    if (!isTrustedAuthority(typeof host === 'string' ? host : undefined))
        return false;
    const origin = req.headers.origin;
    if (typeof origin !== 'string' || origin === '')
        return true;
    try {
        return isTrustedAuthority(new URL(origin).host);
    }
    catch {
        return false;
    }
}
/** Body size cap for one POST (bytes); larger requests answer 413. */
export const MAX_BODY_BYTES = 1 << 20;
async function readJsonBody(req) {
    const chunks = [];
    let total = 0;
    for await (const chunk of req) {
        const buffer = chunk;
        chunks.push(buffer);
        total += buffer.length;
        // Stop reading and tell the caller why: answering "malformed JSON" here
        // would be wrong, and draining a hostile multi-GB body is worse.
        if (total > MAX_BODY_BYTES) {
            // Optional call: real requests always have it, test doubles may not.
            req.destroy?.();
            return { tooLarge: true };
        }
    }
    const text = Buffer.concat(chunks).toString('utf8');
    if (text === '')
        return {};
    try {
        return { value: JSON.parse(text) };
    }
    catch {
        return {};
    }
}
/** Render a match value for the panel: regex source or comparison string. */
function matchText(value) {
    if (value instanceof RegExp)
        return value.source;
    // Normalize single-op objects to the equivalent string syntax so the
    // editor round-trip keeps comparison semantics; multi-op stays JSON.
    const ops = Object.entries(value);
    if (ops.length === 1) {
        const [op, n] = ops[0];
        const symbol = { gt: '>', gte: '>=', lt: '<', lte: '<=', eq: '=' }[op];
        if (symbol !== undefined && typeof n === 'number')
            return `${symbol}${n}`;
    }
    return JSON.stringify(value);
}
/** Sanitized per-hook description for the settings panel (regex sources, no RegExp objects). */
export function describeHooks(hooks) {
    return hooks.map((hook, i) => ({
        index: i + 1,
        on: hook.on,
        when: hook.when,
        match: hook.match === undefined
            ? undefined
            : Object.fromEntries(Object.entries(hook.match).map(([field, re]) => [field, matchText(re)])),
        run: hook.run,
        notify: hook.notify === undefined || hook.notify === null
            ? undefined
            : { channel: hook.notify.channel, url: hook.notify.url, slack: hook.notify.slack },
        input: hook.input,
        timeoutMs: hook.timeoutMs,
        retries: hook.retries,
        retryDelayMs: hook.retryDelayMs,
        enabled: hook.enabled,
        cwd: hook.cwd,
        maxConcurrent: hook.maxConcurrent,
        debounceMs: hook.debounceMs,
    }));
}
const FAILED_OUTCOMES = new Set(['exit-nonzero', 'timeout', 'spawn-failed', 'send-failed']);
/**
 * Reject a `profile` that is not a single safe path segment, so a request body
 * can never steer a patch-file write outside `~/.dsh/profiles` (see
 * `profile-path.ts`). Returns true when the response has been sent.
 */
function rejectBadProfile(res, profile) {
    if (isProfileNameValid(profile))
        return false;
    json(res, FAIL('bad-request', `非法 profile 名称：${profile}`), 400);
    return true;
}
/** Create the /dsh-hooks route handler (exported for tests). */
export function createHookHandler(options) {
    const { hooks, history } = options;
    const version = options.version ?? pluginVersion();
    const feishu = options.feishu;
    const runFeishuTestCard = feishu?.runTest ?? runFeishuTest;
    const feishuConfigPath = feishu?.configPath;
    const runnerStats = options.runner?.stats ?? (() => ({ inFlight: 0, pendingRetries: 0 }));
    const resolvePatch = options.resolvePatchFile ?? patchFilePath;
    return async (req, res) => {
        if (!isLoopbackRequest(req)) {
            json(res, FAIL('forbidden', 'IP not allowed'), 403);
            return;
        }
        if (!isTrustedHostRequest(req)) {
            json(res, FAIL('forbidden', 'untrusted Host/Origin'), 403);
            return;
        }
        const url = new URL(req.url ?? '/', 'http://x');
        const pathname = url.pathname;
        if (req.method === 'GET' && pathname === '/dsh-hooks/status') {
            // Pull in disk records (pre-restart and other-process appends) so the
            // badge reflects the durable log, not just this process's memory.
            history.sync();
            const records = history.recent();
            const recentFailures = records.filter((record) => FAILED_OUTCOMES.has(record.outcome)).length;
            json(res, OK({
                name: 'dsh-hooks',
                version,
                hookCount: hooks.length,
                historyCount: records.length,
                hooks: describeHooks(hooks),
                stats: { ...runnerStats(), recentFailures },
            }));
            return;
        }
        if (req.method === 'GET' && pathname === '/dsh-hooks/history') {
            const raw = url.searchParams.get('n');
            const parsed = raw === null ? 50 : Number(raw);
            const n = Number.isFinite(parsed) && parsed > 0 ? Math.min(500, Math.floor(parsed)) : 50;
            history.sync();
            const records = history.recent();
            json(res, OK(records.slice(Math.max(0, records.length - n))));
            return;
        }
        if (req.method === 'POST' && pathname === '/dsh-hooks/test') {
            const contentType = req.headers['content-type'] ?? '';
            if (!contentType.toLowerCase().startsWith('application/json')) {
                json(res, FAIL('bad-request', 'POST 需要 application/json'), 415);
                return;
            }
            const { value: payload, tooLarge } = await readJsonBody(req);
            if (tooLarge === true) {
                json(res, FAIL('payload-too-large', `请求体超过 ${MAX_BODY_BYTES} 字节上限`), 413);
                return;
            }
            if (typeof payload !== 'object' || payload === null) {
                json(res, FAIL('bad-request', 'malformed JSON body'), 400);
                return;
            }
            const body = payload;
            const event = typeof body.event === 'string' && body.event !== '' ? body.event : null;
            if (event === null) {
                json(res, FAIL('bad-request', '缺少 event 字段'), 400);
                return;
            }
            const reason = typeof body.reason === 'string' && body.reason !== '' ? body.reason : undefined;
            const rawFields = body.fields;
            if (rawFields !== undefined && (typeof rawFields !== 'object' || rawFields === null || Array.isArray(rawFields))) {
                json(res, FAIL('bad-request', 'fields 必须是对象（模拟字段 → 数字）'), 400);
                return;
            }
            const simulated = applyMockFields(mockContext(event, {
                reason,
                tool: typeof body.tool === 'string' ? body.tool : undefined,
                sessionName: typeof body.sessionName === 'string' ? body.sessionName : undefined,
            }), rawFields);
            if (simulated.ignored.length > 0) {
                json(res, FAIL('bad-request', `无法模拟的字段：${simulated.ignored.join(', ')}（可用：${MOCK_NUMERIC_FIELDS.join(' / ')}）`), 400);
                return;
            }
            const ctx = simulated.ctx;
            // Echo every numeric field the simulated context actually carries (mock
            // defaults + explicit overrides) so the panel can show what was matched.
            const fields = Object.fromEntries(MOCK_NUMERIC_FIELDS.filter((key) => ctx[key] !== undefined).map((key) => [
                key,
                ctx[key],
            ]));
            const lines = evaluateHooks(hooks, event, ctx, reason);
            const matchedHooks = lines.filter((line) => line.matched);
            const execute = body.execute === true;
            if (execute) {
                const runner = createHookRunner();
                for (const line of matchedHooks) {
                    const hook = hooks[line.index - 1];
                    if (hook.run)
                        runner.run(hook, ctx);
                    else if (hook.notify)
                        void fireNotify(hook.notify, ctx, undefined, { retries: hook.retries, retryDelayMs: hook.retryDelayMs });
                }
            }
            json(res, OK({
                event,
                reason,
                fields,
                executed: execute,
                total: hooks.length,
                matched: matchedHooks.length,
                lines: lines.map((line) => ({
                    index: line.index,
                    matched: line.matched,
                    why: line.why,
                    summary: line.summary,
                    action: line.matched ? describeHook(hooks[line.index - 1]) : undefined,
                })),
            }));
            return;
        }
        if (feishu !== undefined && req.method === 'GET' && pathname === '/dsh-hooks/feishu/status') {
            const summary = readFeishuSummary(feishuConfigPath);
            json(res, OK({ ...summary, setup: feishu.manager.status() }));
            return;
        }
        if (feishu !== undefined && req.method === 'POST' && pathname === '/dsh-hooks/feishu/setup') {
            const contentType = req.headers['content-type'] ?? '';
            if (!contentType.toLowerCase().startsWith('application/json')) {
                json(res, FAIL('bad-request', 'POST 需要 application/json'), 415);
                return;
            }
            const { value: payload, tooLarge } = await readJsonBody(req);
            if (tooLarge === true) {
                json(res, FAIL('payload-too-large', `请求体超过 ${MAX_BODY_BYTES} 字节上限`), 413);
                return;
            }
            if (typeof payload !== 'object' || payload === null) {
                json(res, FAIL('bad-request', 'malformed JSON body'), 400);
                return;
            }
            const body = payload;
            const profile = typeof body.profile === 'string' && body.profile.trim() !== '' ? body.profile.trim() : 'web';
            if (rejectBadProfile(res, profile))
                return;
            const resultMaxChars = typeof body.resultMaxChars === 'number' && Number.isFinite(body.resultMaxChars)
                ? body.resultMaxChars
                : undefined;
            try {
                const setup = resultMaxChars === undefined
                    ? await feishu.manager.start(profile)
                    : await feishu.manager.start(profile, { resultMaxChars });
                json(res, OK({ setup }));
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                json(res, FAIL('pending', message), message === FEISHU_SETUP_BUSY ? 409 : 500);
            }
            return;
        }
        if (feishu !== undefined && req.method === 'POST' && pathname === '/dsh-hooks/feishu/config') {
            const contentType = req.headers['content-type'] ?? '';
            if (!contentType.toLowerCase().startsWith('application/json')) {
                json(res, FAIL('bad-request', 'POST 需要 application/json'), 415);
                return;
            }
            const { value: payload, tooLarge } = await readJsonBody(req);
            if (tooLarge === true) {
                json(res, FAIL('payload-too-large', `请求体超过 ${MAX_BODY_BYTES} 字节上限`), 413);
                return;
            }
            if (typeof payload !== 'object' || payload === null) {
                json(res, FAIL('bad-request', 'malformed JSON body'), 400);
                return;
            }
            const value = payload.resultMaxChars;
            if (typeof value !== 'number') {
                json(res, FAIL('bad-request', '缺少数字字段 resultMaxChars'), 400);
                return;
            }
            try {
                const resultMaxChars = updateFeishuResultMaxChars(feishuConfigPath, value);
                json(res, OK({ resultMaxChars }));
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                json(res, FAIL('bad-request', message), 400);
            }
            return;
        }
        if (feishu !== undefined && req.method === 'POST' && pathname === '/dsh-hooks/feishu/cancel') {
            const contentType = req.headers['content-type'] ?? '';
            if (!contentType.toLowerCase().startsWith('application/json')) {
                json(res, FAIL('bad-request', 'POST 需要 application/json'), 415);
                return;
            }
            json(res, OK({ cancelled: feishu.manager.cancel() }));
            return;
        }
        if (feishu !== undefined && req.method === 'POST' && pathname === '/dsh-hooks/feishu/test') {
            const contentType = req.headers['content-type'] ?? '';
            if (!contentType.toLowerCase().startsWith('application/json')) {
                json(res, FAIL('bad-request', 'POST 需要 application/json'), 415);
                return;
            }
            try {
                const message = await runFeishuTestCard();
                json(res, OK({ message }));
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                json(res, FAIL('send-failed', message), 500);
            }
            return;
        }
        if (req.method === 'POST' && pathname === '/dsh-hooks/notify/test') {
            const contentType = req.headers['content-type'] ?? '';
            if (!contentType.toLowerCase().startsWith('application/json')) {
                json(res, FAIL('bad-request', 'POST 需要 application/json'), 415);
                return;
            }
            const { value: payload, tooLarge } = await readJsonBody(req);
            if (tooLarge === true) {
                json(res, FAIL('payload-too-large', `请求体超过 ${MAX_BODY_BYTES} 字节上限`), 413);
                return;
            }
            if (typeof payload !== 'object' || payload === null) {
                json(res, FAIL('bad-request', 'malformed JSON body'), 400);
                return;
            }
            const body = payload;
            const channel = body.channel;
            if (channel !== 'webhook' && channel !== 'desktop') {
                json(res, FAIL('bad-request', '缺少字段 channel（webhook 或 desktop）'), 400);
                return;
            }
            const ctx = {
                event: 'user/message',
                sessionId: 'notify-test',
                sessionName: '通知测试',
                source: 'plugin',
                content: '这是一条 dsh-hooks 测试通知：如果收到这条消息，说明该渠道配置正常。',
                timestamp: new Date().toISOString(),
            };
            const result = await fireNotify({
                channel,
                url: typeof body.url === 'string' && body.url !== '' ? body.url : undefined,
                slack: body.slack === true,
            }, ctx, (record) => history.record(record));
            if (!result.ok) {
                json(res, FAIL('send-failed', result.error ?? '发送失败'), 500);
                return;
            }
            json(res, OK({ message: '✅ 测试通知已发送', preview: summarizeContext(ctx) }));
            return;
        }
        if (req.method === 'POST' && pathname === '/dsh-hooks/hooks/save') {
            const contentType = req.headers['content-type'] ?? '';
            if (!contentType.toLowerCase().startsWith('application/json')) {
                json(res, FAIL('bad-request', 'POST 需要 application/json'), 415);
                return;
            }
            const { value: payload, tooLarge } = await readJsonBody(req);
            if (tooLarge === true) {
                json(res, FAIL('payload-too-large', `请求体超过 ${MAX_BODY_BYTES} 字节上限`), 413);
                return;
            }
            if (typeof payload !== 'object' || payload === null) {
                json(res, FAIL('bad-request', 'malformed JSON body'), 400);
                return;
            }
            const body = payload;
            const profile = typeof body.profile === 'string' && body.profile.trim() !== '' ? body.profile.trim() : 'web';
            if (rejectBadProfile(res, profile))
                return;
            const wireHooks = body.hooks;
            if (!Array.isArray(wireHooks)) {
                json(res, FAIL('bad-request', '缺少数组字段 hooks'), 400);
                return;
            }
            const patchFile = resolvePatch(profile);
            try {
                const result = writeHooksConfig(patchFile, wireHooks);
                json(res, OK({
                    profile,
                    hookCount: result.hookCount,
                    patchFile: result.patchFile,
                    backupPath: result.backupPath,
                    message: `✅ 已保存 ${result.hookCount} 个 hook 到 ${profile} profile（已备份原文件）。若未立即生效请重启 dsh web。`,
                }));
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                json(res, FAIL('save-failed', message), 400);
            }
            return;
        }
        if (feishu !== undefined && req.method === 'POST' && pathname === '/dsh-hooks/feishu/disconnect') {
            const contentType = req.headers['content-type'] ?? '';
            if (!contentType.toLowerCase().startsWith('application/json')) {
                json(res, FAIL('bad-request', 'POST 需要 application/json'), 415);
                return;
            }
            const { value: payload, tooLarge } = await readJsonBody(req);
            if (tooLarge === true) {
                json(res, FAIL('payload-too-large', `请求体超过 ${MAX_BODY_BYTES} 字节上限`), 413);
                return;
            }
            const body = (typeof payload === 'object' && payload !== null ? payload : {});
            const profile = typeof body.profile === 'string' && body.profile.trim() !== '' ? body.profile.trim() : 'web';
            if (rejectBadProfile(res, profile))
                return;
            const removeHooks = body.removeHooks === true;
            // Abort any in-flight scan session first.
            feishu.manager.cancel();
            const existed = deleteFeishuConfig(feishuConfigPath);
            if (removeHooks) {
                try {
                    removeScriptHooks(resolvePatch(profile), 'notify-feishu.mjs');
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    json(res, FAIL('save-failed', message), 400);
                    return;
                }
            }
            json(res, OK({ disconnected: true, existed, removedHooks: removeHooks, message: '✅ 已断开飞书连接' }));
            return;
        }
        json(res, FAIL('not-found', `unknown route ${pathname}`), 404);
    };
}
/** Register the /dsh-hooks prefix route on the shared web server. */
export function registerHookRoutes(webServer, options) {
    return webServer.register({ kind: 'prefix', path: '/dsh-hooks', handler: createHookHandler(options) });
}

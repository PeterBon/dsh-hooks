import { createRequire } from 'node:module';
import { describeHook, evaluateHooks, mockContext } from './dry-run.js';
import { createHookRunner } from './runner.js';
import { fireNotify } from './notify.js';
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
/** Loopback fence: never let a LAN client reach /dsh-hooks operations. */
export function isLoopbackRequest(req) {
    const address = req.socket.remoteAddress ?? '';
    return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}
async function readJsonBody(req) {
    const chunks = [];
    let total = 0;
    for await (const chunk of req) {
        const buffer = chunk;
        chunks.push(buffer);
        total += buffer.length;
        if (total > 1 << 20)
            return null;
    }
    const text = Buffer.concat(chunks).toString('utf8');
    if (text === '')
        return null;
    try {
        return JSON.parse(text);
    }
    catch {
        return null;
    }
}
/** Create the /dsh-hooks route handler (exported for tests). */
export function createHookHandler(options) {
    const { hooks, history } = options;
    const version = options.version ?? pluginVersion();
    return async (req, res) => {
        if (!isLoopbackRequest(req)) {
            json(res, FAIL('forbidden', 'loopback-only'), 403);
            return;
        }
        const url = new URL(req.url ?? '/', 'http://x');
        const pathname = url.pathname;
        if (req.method === 'GET' && pathname === '/dsh-hooks/status') {
            json(res, OK({ name: 'dsh-hooks', version, hookCount: hooks.length, historyCount: history.recent().length }));
            return;
        }
        if (req.method === 'GET' && pathname === '/dsh-hooks/history') {
            const raw = url.searchParams.get('n');
            const parsed = raw === null ? 50 : Number(raw);
            const n = Number.isFinite(parsed) && parsed > 0 ? Math.min(500, Math.floor(parsed)) : 50;
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
            const payload = await readJsonBody(req);
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
            const ctx = mockContext(event, {
                reason,
                tool: typeof body.tool === 'string' ? body.tool : undefined,
                sessionName: typeof body.sessionName === 'string' ? body.sessionName : undefined,
            });
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
                        void fireNotify(hook.notify, ctx);
                }
            }
            json(res, OK({
                event,
                reason,
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
        json(res, FAIL('not-found', `unknown route ${pathname}`), 404);
    };
}
/** Register the /dsh-hooks prefix route on the shared web server. */
export function registerHookRoutes(webServer, options) {
    return webServer.register({ kind: 'prefix', path: '/dsh-hooks', handler: createHookHandler(options) });
}

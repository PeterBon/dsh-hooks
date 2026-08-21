import { spawn } from 'node:child_process';
import { eventLabel, renderTemplate, toEnv } from './context.js';
export const DEFAULT_TIMEOUT_MS = 10000;
export const DEFAULT_RETRY_DELAY_MS = 500;
/**
 * Per-stream capture cap. The hook's stdout/stderr is only kept for
 * failure diagnostics, so anything past 64 KiB is drained and dropped
 * (reading must never stop — a stopped reader would fill the pipe buffer
 * and wedge the hook process).
 */
const MAX_CAPTURE_BYTES = 64 * 1024;
/**
 * Terminate a spawned hook process. With `shell: true` on Windows the direct
 * child is cmd.exe — killing only the shell orphans the actual hook command
 * (e.g. `node notify-feishu.mjs`), so kill the whole tree first. The direct
 * kill stays as the fallback (and the only path off Windows).
 */
export function terminate(child) {
    if (process.platform === 'win32' && child.pid !== undefined) {
        try {
            spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' }).unref();
        }
        catch {
            // taskkill unavailable — fall through to the direct kill below.
        }
    }
    child.kill();
}
/**
 * Fire-and-forget command runner. Emissions are irreversible side effects:
 * failures only warn, never block the agent loop. Context travels through
 * environment variables (no data interpolation into the shell string);
 * `{{var}}` placeholders are substituted from the same map for explicit
 * templating by the user. `input: 'stdin'` additionally writes the full
 * context as one JSON document to stdin, and `retries` re-spawns commands
 * whose exit code is non-zero (with exponential backoff, in the background).
 */
export function createHookRunner(log = console.log, record) {
    const children = new Set();
    const pendingRetries = new Set();
    function spawnOnce(spec, ctx, attempt) {
        if (!spec.run)
            return { ok: false, reason: 'skipped', detail: 'no run command' };
        const timeoutMs = spec.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        const retries = spec.retries ?? 0;
        const retryDelayMs = spec.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
        const env = toEnv(ctx);
        const command = renderTemplate(spec.run, ctx);
        const useStdin = spec.input === 'stdin';
        const base = {
            kind: 'run',
            event: ctx.event,
            command,
            sessionId: ctx.sessionId,
            sessionName: ctx.sessionName,
        };
        log(`[dsh-hooks] 触发 ${eventLabel(ctx)} → ${command}`);
        let child;
        try {
            child = spawn(command, {
                shell: true,
                env: { ...process.env, ...env },
                stdio: [useStdin ? 'pipe' : 'ignore', 'pipe', 'pipe'],
            });
        }
        catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            console.warn(`[dsh-hooks] spawn 失败 (${eventLabel(ctx)}): ${detail}`);
            record?.({ ...base, outcome: 'spawn-failed', error: detail });
            return { ok: false, reason: 'spawn-failed', detail };
        }
        const startedAt = Date.now();
        record?.({ ...base, outcome: 'spawned' });
        children.add(child);
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            terminate(child);
            console.warn(`[dsh-hooks] 超时（${timeoutMs}ms），已终止：${eventLabel(ctx)}`);
            record?.({ ...base, outcome: 'timeout', durationMs: Date.now() - startedAt });
        }, timeoutMs);
        // Never hold the process open for a hook.
        child.unref();
        if (useStdin && child.stdin) {
            // The hook may exit before reading stdin (EPIPE on write): the close
            // handler owns failure reporting, so swallow the stream error.
            child.stdin.on('error', () => { });
            child.stdin.write(JSON.stringify(ctx));
            child.stdin.end();
        }
        const captured = { out: '', err: '' };
        const capture = (target) => (chunk) => {
            const text = String(chunk);
            const room = MAX_CAPTURE_BYTES - captured[target].length;
            if (room > 0)
                captured[target] += text.slice(0, room);
        };
        child.stdout?.on('data', capture('out'));
        child.stderr?.on('data', capture('err'));
        child.on('error', (error) => {
            console.warn(`[dsh-hooks] 执行出错 (${eventLabel(ctx)}): ${error.message}`);
        });
        child.on('close', (code) => {
            clearTimeout(timer);
            children.delete(child);
            // Timeouts and external kills (dispose) never retry; only a command
            // that actually ran and exited non-zero does.
            if (timedOut || code === null || code === 0) {
                if (!timedOut && code !== null) {
                    record?.({ ...base, outcome: 'exit-0', exitCode: 0, durationMs: Date.now() - startedAt });
                }
                return;
            }
            if (attempt < retries) {
                const delay = retryDelayMs * 2 ** attempt;
                log(`[dsh-hooks] hook 退出码 ${code}，${delay}ms 后重试（${attempt + 1}/${retries}）：${eventLabel(ctx)}`);
                const retryTimer = setTimeout(() => {
                    pendingRetries.delete(retryTimer);
                    spawnOnce(spec, ctx, attempt + 1);
                }, delay);
                retryTimer.unref?.();
                pendingRetries.add(retryTimer);
                return;
            }
            const tail = captured.err.trim();
            const detail = tail === '' ? '' : `，stderr：${tail.slice(-400)}`;
            console.warn(`[dsh-hooks] hook 退出码 ${code} (${eventLabel(ctx)})${detail}`);
            record?.({ ...base, outcome: 'exit-nonzero', exitCode: code, durationMs: Date.now() - startedAt, error: tail.slice(-400) || undefined });
        });
        return { ok: true, reason: 'ran' };
    }
    function run(spec, ctx) {
        if (!spec.run)
            return { ok: false, reason: 'skipped', detail: 'no run command' };
        return spawnOnce(spec, ctx, 0);
    }
    function dispose() {
        for (const timer of pendingRetries)
            clearTimeout(timer);
        pendingRetries.clear();
        for (const child of children)
            terminate(child);
        children.clear();
    }
    function stats() {
        return { inFlight: children.size, pendingRetries: pendingRetries.size };
    }
    return { run, stats, dispose };
}

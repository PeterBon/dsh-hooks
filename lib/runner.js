import { spawn } from 'node:child_process';
import { eventLabel, renderTemplate, toEnv } from './context.js';
export const DEFAULT_TIMEOUT_MS = 10000;
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
 * failures only warn, never retried, never block the agent loop.
 * Context travels through environment variables (no data interpolation into
 * the shell string); `{{var}}` placeholders are substituted from the same
 * map for explicit templating by the user.
 */
export function createHookRunner(log = console.log) {
    const children = new Set();
    function run(spec, ctx) {
        const timeoutMs = spec.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        const env = toEnv(ctx);
        const command = renderTemplate(spec.run, ctx);
        log(`[dsh-hooks] 触发 ${eventLabel(ctx)} → ${command}`);
        let child;
        try {
            child = spawn(command, {
                shell: true,
                env: { ...process.env, ...env },
                stdio: 'ignore',
            });
        }
        catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            console.warn(`[dsh-hooks] spawn 失败 (${eventLabel(ctx)}): ${detail}`);
            return { ok: false, reason: 'spawn-failed', detail };
        }
        children.add(child);
        const timer = setTimeout(() => {
            terminate(child);
            console.warn(`[dsh-hooks] 超时（${timeoutMs}ms），已终止：${eventLabel(ctx)}`);
        }, timeoutMs);
        // Never hold the process open for a hook.
        child.unref();
        child.on('error', (error) => {
            console.warn(`[dsh-hooks] 执行出错 (${eventLabel(ctx)}): ${error.message}`);
        });
        child.on('close', () => {
            clearTimeout(timer);
            children.delete(child);
        });
        return { ok: true, reason: 'ran' };
    }
    function dispose() {
        for (const child of children)
            terminate(child);
        children.clear();
    }
    return { run, dispose };
}

/**
 * Built-in notification channels: webhook (HTTP JSON POST) and desktop
 * (platform-native balloon/toast). Config-driven — a hook declares
 * `notify: { channel, url?, slack? }` and needs no external script.
 * Failures only warn, never block the agent loop.
 */
import { spawn } from 'node:child_process';
import { eventLabel } from './context.js';
import { DEFAULT_RETRY_DELAY_MS } from './runner.js';
/** Fetch timeout for webhook sends (ms). */
export const NOTIFY_TIMEOUT_MS = 10000;
/**
 * HTTP statuses worth retrying: rate limiting, request timeout, and
 * server-side failures (a cold endpoint answering 502/503 is the classic
 * case). Any other 4xx means the request itself is wrong — retrying it can
 * only waste time.
 */
export function isRetryableStatus(status) {
    return status === 408 || status === 429 || status >= 500;
}
/** Sleep without holding the event loop open (retries never outlive the plugin). */
function sleep(ms) {
    return new Promise((resolve) => {
        const timer = setTimeout(resolve, ms);
        timer.unref?.();
    });
}
/** One-line summary for Slack-style and desktop notifications. */
export function summarizeContext(ctx) {
    const label = ctx.sessionName || ctx.sessionId || '';
    const where = label ? ` · ${label}` : '';
    switch (ctx.event) {
        case 'turn/end':
            if (ctx.reason === 'completed')
                return `✅ 任务已完成${where}（回合 #${ctx.turn ?? '?'}）`;
            if (ctx.error)
                return `❌ 任务失败${where}: ${ctx.error.slice(0, 200)}`;
            return `⏸ 任务${ctx.reason ? ` ${ctx.reason}` : '结束'}${where}（回合 #${ctx.turn ?? '?'}）`;
        case 'tool/call':
            return `🔧 调用工具 ${ctx.tool ?? ''}${where}`;
        case 'tool/result':
            if (ctx.toolError)
                return `⚠️ 工具 ${ctx.tool ?? ''} 失败${where}: ${ctx.toolError}`;
            return `✅ 工具 ${ctx.tool ?? ''} 完成${where}`;
        case 'approval/asked':
            return `⏳ 需要审批：工具 ${ctx.tool ?? ''}${where}`;
        case 'user/message':
            return `💬 新消息${where}${ctx.content ? `：${ctx.content.slice(0, 120)}` : ''}`;
        case 'session/title':
            return `🏷 会话改名${where}: ${ctx.sessionName ?? ''}`;
        case 'session/created':
            return `✨ 会话开始${where}`;
        case 'session/disposed':
            return `🏁 会话结束${where}`;
        case 'agent/error':
            return `⚠️ Agent 出错${where}${ctx.error ? `: ${ctx.error.slice(0, 200)}` : ''}`;
        default:
            return `🔔 DSH ${ctx.event}${where}`;
    }
}
/** Structured JSON document for the webhook channel (present fields only). */
export function webhookPayload(ctx) {
    const payload = { event: ctx.event, timestamp: ctx.timestamp };
    const session = {};
    if (ctx.sessionId)
        session.id = ctx.sessionId;
    if (ctx.sessionName)
        session.name = ctx.sessionName;
    if (ctx.cwd)
        session.cwd = ctx.cwd;
    if (Object.keys(session).length > 0)
        payload.session = session;
    if (ctx.turn !== undefined)
        payload.turn = ctx.turn;
    if (ctx.step !== undefined)
        payload.step = ctx.step;
    if (ctx.reason !== undefined)
        payload.reason = ctx.reason;
    if (ctx.tool !== undefined)
        payload.tool = ctx.tool;
    if (ctx.callId !== undefined)
        payload.call_id = ctx.callId;
    if (ctx.toolArgs !== undefined)
        payload.tool_args = ctx.toolArgs;
    if (ctx.toolError !== undefined)
        payload.tool_error = ctx.toolError;
    if (ctx.source !== undefined)
        payload.source = ctx.source;
    if (ctx.durationMs !== undefined)
        payload.duration_ms = ctx.durationMs;
    if (ctx.status !== undefined)
        payload.status = ctx.status;
    if (ctx.error !== undefined)
        payload.error = ctx.error;
    if (ctx.content !== undefined)
        payload.content = ctx.content;
    const usage = {};
    if (ctx.usageInputTokens !== undefined)
        usage.input_tokens = ctx.usageInputTokens;
    if (ctx.usageOutputTokens !== undefined)
        usage.output_tokens = ctx.usageOutputTokens;
    if (ctx.usageCacheReadTokens !== undefined)
        usage.cache_read_tokens = ctx.usageCacheReadTokens;
    if (ctx.usageCacheWriteTokens !== undefined)
        usage.cache_write_tokens = ctx.usageCacheWriteTokens;
    if (ctx.usageReasoningTokens !== undefined)
        usage.reasoning_tokens = ctx.usageReasoningTokens;
    if (Object.keys(usage).length > 0)
        payload.usage = usage;
    return payload;
}
/**
 * POST the context to a webhook endpoint, honouring the hook's
 * `retries` / `retryDelayMs` exactly like the `run` channel: up to
 * `retries` extra attempts after the first one, with the delay doubling per
 * attempt. Retryable failures are transport errors (connection reset,
 * timeout) and HTTP 408/429/5xx. The URL comes from `spec.url` or the
 * `DSH_HOOKS_WEBHOOK_URL` environment variable.
 */
export async function sendWebhook(spec, ctx, env = process.env, retry = {}) {
    const url = spec.url || env.DSH_HOOKS_WEBHOOK_URL;
    if (!url)
        return { ok: false, error: '缺少 webhook URL（notify.url 或 DSH_HOOKS_WEBHOOK_URL）' };
    const body = spec.slack ? { text: summarizeContext(ctx) } : webhookPayload(ctx);
    const retries = Math.max(0, retry.retries ?? 0);
    const baseDelay = Math.max(0, retry.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS);
    const log = retry.log ?? ((line) => console.warn(line));
    const attempt = async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), NOTIFY_TIMEOUT_MS);
        try {
            return await fetch(url, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
        }
        finally {
            clearTimeout(timer);
        }
    };
    // Attempt loop: `retries` counts the attempts AFTER the first one, so the
    // total is `1 + retries` — identical to the run channel's semantics.
    for (let attemptNumber = 0;; attemptNumber++) {
        let failure;
        let retryable;
        try {
            const response = await attempt();
            if (response.ok)
                return { ok: true };
            failure = `webhook 响应 HTTP ${response.status}`;
            retryable = isRetryableStatus(response.status);
        }
        catch (error) {
            failure = `webhook 请求失败: ${error instanceof Error ? error.message : String(error)}`;
            // Transport failures are always worth another attempt.
            retryable = true;
        }
        const attempts = attemptNumber + 1;
        if (!retryable || attempts > retries) {
            return { ok: false, error: attempts > 1 ? `${failure}（${attempts} 次尝试后仍失败）` : failure };
        }
        const delay = baseDelay * 2 ** attemptNumber;
        log(`[dsh-hooks] 通知发送失败（${failure}），${delay}ms 后重试（${attempts}/${retries}）：${eventLabel(ctx)}`);
        await sleep(delay);
    }
}
/**
 * Desktop balloon/toast notification. The summary travels through an
 * environment variable (Windows PowerShell) or argv (macOS/Linux), never
 * through shell-string interpolation.
 */
export async function sendDesktop(spec, ctx) {
    const text = summarizeContext(ctx);
    const platform = process.platform;
    try {
        if (platform === 'win32') {
            await runAndWait(['powershell', '-NoProfile', '-STA', '-Command', [
                    'Add-Type -AssemblyName System.Windows.Forms',
                    '$n = New-Object System.Windows.Forms.NotifyIcon',
                    '$n.Icon = [System.Drawing.SystemIcons]::Information',
                    '$n.Visible = $true',
                    `$n.ShowBalloonTip(8000, 'dsh-hooks', $env:DSH_HOOK_NOTIFY_TEXT, [System.Windows.Forms.ToolTipIcon]::Info)`,
                    'Start-Sleep -Seconds 9',
                    '$n.Dispose()',
                ].join('; ')], { DSH_HOOK_NOTIFY_TEXT: text }, 15000);
            return { ok: true };
        }
        if (platform === 'darwin') {
            const script = `display notification ${JSON.stringify(text)} with title "dsh-hooks"`;
            await runAndWait(['osascript', '-e', script], {}, 10000);
            return { ok: true };
        }
        await runAndWait(['notify-send', 'dsh-hooks', text], {}, 10000);
        return { ok: true };
    }
    catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        return { ok: false, error: `桌面通知失败: ${detail}` };
    }
}
/** Spawn one OS command and wait for its exit code (timeout kills it). */
function runAndWait(argv, env, timeoutMs) {
    return new Promise((resolve, reject) => {
        let child;
        try {
            child = spawn(argv[0], argv.slice(1), { stdio: 'ignore', env: { ...process.env, ...env } });
        }
        catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
            return;
        }
        const timer = setTimeout(() => {
            child.kill();
            reject(new Error(`命令超时（${timeoutMs}ms）`));
        }, timeoutMs);
        child.on('error', (error) => {
            clearTimeout(timer);
            reject(error);
        });
        child.on('close', (code) => {
            clearTimeout(timer);
            if (code === 0)
                resolve();
            else
                reject(new Error(`退出码 ${code}`));
        });
    });
}
/**
 * Fire a built-in notification; failures only warn and surface in the result.
 * `retry` carries the hook's `retries` / `retryDelayMs` — honoured by the
 * webhook channel; the desktop channel is a local spawn and never retries.
 */
export async function fireNotify(spec, ctx, record, retry = {}) {
    const startedAt = Date.now();
    const result = spec.channel === 'webhook' ? await sendWebhook(spec, ctx, process.env, retry) : await sendDesktop(spec, ctx);
    if (!result.ok) {
        console.warn(`[dsh-hooks] 通知发送失败 (${eventLabel(ctx)}): ${result.error}`);
        record?.({
            kind: 'notify',
            event: ctx.event,
            command: `notify:${spec.channel}`,
            sessionId: ctx.sessionId,
            sessionName: ctx.sessionName,
            outcome: 'send-failed',
            durationMs: Date.now() - startedAt,
            error: result.error,
        });
        return result;
    }
    record?.({
        kind: 'notify',
        event: ctx.event,
        command: `notify:${spec.channel}`,
        sessionId: ctx.sessionId,
        sessionName: ctx.sessionName,
        outcome: 'sent',
        durationMs: Date.now() - startedAt,
    });
    return result;
}

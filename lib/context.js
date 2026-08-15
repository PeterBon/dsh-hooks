/**
 * Hook execution context: a flat string map rendered into environment
 * variables and `{{var}}` placeholders. Never carries non-string values —
 * the runner owns serialization boundaries.
 */
export function toEnv(ctx) {
    const env = { DSH_HOOK_EVENT: ctx.event, DSH_HOOK_TIMESTAMP: ctx.timestamp };
    if (ctx.sessionId !== undefined)
        env.DSH_HOOK_SESSION_ID = ctx.sessionId;
    if (ctx.cwd !== undefined)
        env.DSH_HOOK_CWD = ctx.cwd;
    if (ctx.turn !== undefined)
        env.DSH_HOOK_TURN = String(ctx.turn);
    if (ctx.reason !== undefined)
        env.DSH_HOOK_REASON = ctx.reason;
    if (ctx.tool !== undefined)
        env.DSH_HOOK_TOOL = ctx.tool;
    if (ctx.callId !== undefined)
        env.DSH_HOOK_CALL_ID = ctx.callId;
    if (ctx.durationMs !== undefined)
        env.DSH_HOOK_DURATION_MS = String(ctx.durationMs);
    if (ctx.status !== undefined)
        env.DSH_HOOK_STATUS = ctx.status;
    if (ctx.error !== undefined)
        env.DSH_HOOK_ERROR = ctx.error;
    return env;
}
/** Render `{{DSH_HOOK_*}}` placeholders from the context map. */
export function renderTemplate(template, ctx) {
    const env = toEnv(ctx);
    return template.replace(/\{\{(\w+)\}\}/g, (whole, key) => Object.prototype.hasOwnProperty.call(env, key) ? env[key] : whole);
}
/** Human-readable label for an event, used in runner logs. */
export function eventLabel(ctx) {
    const session = ctx.sessionId ? ` · 会话 ${ctx.sessionId}` : '';
    const extra = ctx.reason !== undefined
        ? ` · ${ctx.reason}`
        : ctx.tool !== undefined
            ? ` · 工具 ${ctx.tool}`
            : ctx.status !== undefined
                ? ` · ${ctx.status}`
                : '';
    return `${ctx.event}${extra}${session}`;
}

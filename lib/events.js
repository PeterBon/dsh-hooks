/** Per-session turn start timestamps for duration reporting. */
const turnStarts = new Map();
/** Tool name for an in-flight call, remembered at `tool/call` and consumed at `tool/result`. */
const callTools = new Map();
function sessionKey(session) {
    return String(session.id);
}
function callKey(session, callId) {
    return `${sessionKey(session)}\u0000${String(callId)}`;
}
/** Best-effort access to a session's event log (test fakes may omit it). */
function sessionEvents(session) {
    return Array.isArray(session.events) ? session.events : [];
}
/** Concatenate the text blocks of a message's content, or undefined. */
function textOfBlocks(content) {
    if (!Array.isArray(content))
        return undefined;
    const parts = [];
    for (const block of content) {
        if (block && block.type === 'text' && typeof block.text === 'string')
            parts.push(block.text);
    }
    const text = parts.join('\n\n').trim();
    return text || undefined;
}
/** Terminal-safe single line for a title: strip control/escape sequences. */
function oneLineTitle(input) {
    return String(input)
        .replace(/\u001B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001B\\))/g, '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
/**
 * Readable session title for notification cards. Mirrors the harness
 * session-title conventions without depending on the title service:
 * prefer the latest `session/title` log event (explicit rename, LLM title, or
 * deterministic fallback), otherwise derive one from the first direct human
 * prompt, as `dsh-session-title`'s fallback does.
 */
export function sessionTitle(session) {
    const events = sessionEvents(session);
    for (let i = events.length - 1; i >= 0; i--) {
        const event = events[i];
        if (event.type !== 'session/title')
            continue;
        const title = oneLineTitle(event.data?.title);
        if (title)
            return title.slice(0, 60);
    }
    for (const event of events) {
        if (event.type !== 'user/message')
            continue;
        if (event.data.source.kind !== 'user')
            continue;
        const text = textOfBlocks(event.data.content);
        if (!text)
            continue;
        const title = oneLineTitle(text);
        if (title)
            return title.slice(0, 60);
    }
    return undefined;
}
/**
 * The turn's final assistant text, from the last `assistant/message` of that
 * turn. Capped so the environment snapshot stays small — card builders apply
 * their own display truncation.
 */
export function turnContent(session, turn) {
    let out;
    for (const event of sessionEvents(session)) {
        if (event.type !== 'assistant/message')
            continue;
        if (event.data.turn !== turn)
            continue;
        const text = textOfBlocks(event.data.message.content);
        if (text)
            out = text;
    }
    return out === undefined ? undefined : out.slice(0, 4000);
}
/**
 * Sum the `usage` of every `assistant/message` of a turn. Steps without
 * reported accounting are skipped; returns undefined when no step reported
 * any usage (adapters may omit it entirely).
 */
export function turnUsage(session, turn) {
    let totals;
    for (const event of sessionEvents(session)) {
        if (event.type !== 'assistant/message')
            continue;
        if (event.data.turn !== turn)
            continue;
        const usage = event.data.usage;
        if (typeof usage?.inputTokens !== 'number')
            continue;
        totals ??= { inputTokens: 0, outputTokens: 0 };
        totals.inputTokens += usage.inputTokens;
        totals.outputTokens += usage.outputTokens;
        if (typeof usage.cacheReadTokens === 'number') {
            totals.cacheReadTokens = (totals.cacheReadTokens ?? 0) + usage.cacheReadTokens;
        }
        if (typeof usage.cacheWriteTokens === 'number') {
            totals.cacheWriteTokens = (totals.cacheWriteTokens ?? 0) + usage.cacheWriteTokens;
        }
        if (typeof usage.reasoningTokens === 'number') {
            totals.reasoningTokens = (totals.reasoningTokens ?? 0) + usage.reasoningTokens;
        }
    }
    return totals;
}
export function rememberTurnStart(session) {
    turnStarts.set(sessionKey(session), Date.now());
}
function takeDuration(session) {
    const key = sessionKey(session);
    const started = turnStarts.get(key);
    turnStarts.delete(key);
    return started === undefined ? undefined : Date.now() - started;
}
export function clearTurnTracking(session) {
    turnStarts.delete(sessionKey(session));
}
/** Does a declared hook match this event (type + optional `when` filter)? */
export function hookMatches(spec, event, reasonKind) {
    if (spec.on !== event)
        return false;
    if (spec.when === undefined)
        return true;
    // v1 `when` semantics: only `turn/end` carries a reason to filter on.
    if (event !== 'turn/end')
        return true;
    return spec.when === reasonKind;
}
function baseContext(session, event) {
    return {
        event,
        sessionId: sessionKey(session),
        sessionName: sessionTitle(session),
        cwd: session.header.cwd,
        timestamp: new Date().toISOString(),
    };
}
export function turnEndContext(session, turn, reason) {
    const kind = typeof reason === 'string' ? reason : reason.kind;
    let error;
    if (typeof reason === 'object' && reason !== null && kind === 'error') {
        const failure = reason.error;
        if (typeof failure?.message === 'string')
            error = failure.message;
    }
    const usage = turnUsage(session, turn);
    return {
        ...baseContext(session, 'turn/end'),
        turn,
        reason: kind,
        durationMs: takeDuration(session),
        error,
        content: turnContent(session, turn),
        usageInputTokens: usage?.inputTokens,
        usageOutputTokens: usage?.outputTokens,
        usageCacheReadTokens: usage?.cacheReadTokens,
        usageCacheWriteTokens: usage?.cacheWriteTokens,
        usageReasoningTokens: usage?.reasoningTokens,
    };
}
export function turnStartContext(session, turn) {
    return { ...baseContext(session, 'turn/start'), turn };
}
export function stepEndContext(session, turn, step) {
    return { ...baseContext(session, 'step/end'), turn, step };
}
export function toolCallContext(session, turn, step, callId, name, args) {
    const key = callKey(session, callId);
    callTools.set(key, typeof name === 'string' ? name : String(name));
    return {
        ...baseContext(session, 'tool/call'),
        turn,
        step,
        tool: typeof name === 'string' ? name : String(name),
        callId: String(callId),
        toolArgs: typeof args === 'string' ? args.slice(0, 4000) : undefined,
    };
}
export function toolResultContext(session, turn, step, callId, message, error) {
    const key = callKey(session, callId);
    const tool = callTools.get(key);
    if (tool !== undefined)
        callTools.delete(key);
    let toolError;
    if (error !== undefined) {
        const name = typeof error.name === 'string' ? error.name : undefined;
        const code = typeof error.code === 'string' ? error.code : undefined;
        if (name !== undefined || code !== undefined)
            toolError = [name, code].filter(Boolean).join(': ');
    }
    const content = textOfBlocks(message.content);
    return {
        ...baseContext(session, 'tool/result'),
        turn,
        step,
        tool,
        callId: String(callId),
        toolError,
        content: content === undefined ? undefined : content.slice(0, 4000),
    };
}
export function userMessageContext(session, content, source) {
    const kind = typeof source === 'object' && source !== null && 'kind' in source
        ? String(source.kind)
        : undefined;
    const text = textOfBlocks(content);
    return {
        ...baseContext(session, 'user/message'),
        source: kind,
        content: text === undefined ? undefined : text.slice(0, 4000),
    };
}
export function titleContext(session, title, source) {
    const kind = typeof source === 'object' && source !== null && 'kind' in source
        ? String(source.kind)
        : undefined;
    const cleaned = title === undefined ? undefined : oneLineTitle(title);
    return {
        ...baseContext(session, 'session/title'),
        sessionName: cleaned === undefined || cleaned === '' ? undefined : cleaned.slice(0, 60),
        source: kind,
    };
}
export function sessionCreatedContext(session) {
    return {
        event: 'session/created',
        sessionId: sessionKey(session),
        sessionName: sessionTitle(session),
        cwd: session.header.cwd,
        timestamp: new Date().toISOString(),
    };
}
export function sessionDisposedContext(session) {
    return {
        event: 'session/disposed',
        sessionId: sessionKey(session),
        sessionName: sessionTitle(session),
        cwd: session.header.cwd,
        timestamp: new Date().toISOString(),
    };
}
export function approvalContext(session, data) {
    return {
        ...baseContext(session, 'approval/asked'),
        tool: data.toolName,
        callId: data.callId,
        reason: data.reason,
    };
}
export function agentCreatedContext(agent) {
    return {
        event: 'agent/created',
        sessionId: String(agent.id),
        timestamp: new Date().toISOString(),
    };
}
export function agentDisposedContext(agent) {
    return {
        event: 'agent/disposed',
        sessionId: String(agent.id),
        timestamp: new Date().toISOString(),
    };
}
export function agentErrorContext(agent, turn, error) {
    return {
        event: 'agent/error',
        sessionId: String(agent.id),
        turn,
        error: errorText(error),
        timestamp: new Date().toISOString(),
    };
}
export function agentStatusContext(agent, status) {
    return {
        event: 'agent/status',
        sessionId: String(agent.id),
        status: statusText(status),
        timestamp: new Date().toISOString(),
    };
}
/** Classify a session event into a hook context, or undefined when unmapped. */
export function classifySessionEvent(session, event) {
    switch (event.type) {
        case 'turn/start':
            rememberTurnStart(session);
            return turnStartContext(session, event.data.turn);
        case 'turn/end':
            return turnEndContext(session, event.data.turn, event.data.reason);
        case 'step/end':
            return stepEndContext(session, event.data.turn, event.data.step);
        case 'tool/call':
            return toolCallContext(session, event.data.turn, event.data.step, event.data.callId, event.data.name, event.data.arguments);
        case 'tool/result': {
            // The call id rides the tool-result block (and the tool source), not
            // the event envelope — resolve it structurally with fallbacks.
            const block = event.data.message.content[0];
            const source = event.data.message.source;
            const callId = block?.toolCallId ?? source?.callId;
            return toolResultContext(session, event.data.turn, event.data.step, callId, event.data.message.content[0], event.data.error);
        }
        case 'user/message':
            return userMessageContext(session, event.data.content, event.data.source);
        case 'approval/asked':
            return approvalContext(session, event.data);
        case 'session/title':
            return titleContext(session, event.data.title, event.data.source);
        default:
            return undefined;
    }
}
/** Best-effort error text from an arbitrary thrown value. */
export function errorText(error) {
    if (error instanceof Error)
        return error.message;
    if (typeof error === 'string')
        return error;
    try {
        return JSON.stringify(error);
    }
    catch {
        return String(error);
    }
}
/** Best-effort status text from an agent status payload. */
export function statusText(status) {
    if (typeof status === 'string')
        return status;
    if (typeof status === 'object' && status !== null && 'kind' in status) {
        const kind = status.kind;
        if (typeof kind === 'string')
            return kind;
    }
    return String(status);
}

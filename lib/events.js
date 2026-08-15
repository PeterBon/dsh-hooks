/** Per-session turn start timestamps for duration reporting. */
const turnStarts = new Map();
function sessionKey(session) {
    return String(session.id);
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
    if (spec.when === undefined || spec.when === '')
        return true;
    // v1 `when` semantics: only `turn/end` carries a reason to filter on.
    if (event !== 'turn/end')
        return true;
    return spec.when === reasonKind;
}
export function turnEndContext(session, turn, reasonKind) {
    return {
        event: 'turn/end',
        sessionId: sessionKey(session),
        cwd: session.header.cwd,
        turn,
        reason: reasonKind,
        durationMs: takeDuration(session),
        timestamp: new Date().toISOString(),
    };
}
export function turnStartContext(session, turn) {
    return {
        event: 'turn/start',
        sessionId: sessionKey(session),
        cwd: session.header.cwd,
        turn,
        timestamp: new Date().toISOString(),
    };
}
export function approvalContext(session, data) {
    return {
        event: 'approval/asked',
        sessionId: sessionKey(session),
        cwd: session.header.cwd,
        tool: data.toolName,
        callId: data.callId,
        reason: data.reason,
        timestamp: new Date().toISOString(),
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
            return turnEndContext(session, event.data.turn, event.data.reason.kind);
        case 'approval/asked':
            return approvalContext(session, event.data);
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

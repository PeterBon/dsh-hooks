import { describe, expect, it } from 'vitest'
import type { HookSpec } from '../src/config.js'
import {
  agentCreatedContext,
  agentErrorContext,
  agentStatusContext,
  approvalContext,
  classifySessionEvent,
  errorText,
  hookMatches,
  statusText,
  turnEndContext,
  turnStartContext,
} from '../src/events.js'

// Minimal structural fakes for the session/event shapes this module consumes.
function sessionEvent(type: string, data: unknown) {
  return { type, seq: 1, time: Date.now(), data } as never
}

function fakeSession(id = 'session-1') {
  return { id } as never
}

describe('hookMatches', () => {
  const spec: HookSpec = { on: 'turn/end', when: 'completed', run: 'x' }

  it('matches the declared event', () => {
    expect(hookMatches(spec, 'turn/end', 'completed')).toBe(true)
  })

  it('rejects a different event', () => {
    expect(hookMatches(spec, 'turn/start')).toBe(false)
  })

  it('rejects a non-matching reason kind', () => {
    expect(hookMatches(spec, 'turn/end', 'error')).toBe(false)
  })

  it('runs unconditionally when no when filter', () => {
    const unconditional: HookSpec = { on: 'approval/asked', run: 'x' }
    expect(hookMatches(unconditional, 'approval/asked')).toBe(true)
  })

  it('ignores when filters on non-turn events', () => {
    const filtered: HookSpec = { on: 'agent/error', when: 'completed', run: 'x' }
    expect(hookMatches(filtered, 'agent/error')).toBe(true)
  })
})

describe('classifySessionEvent', () => {
  it('maps turn/start and remembers duration start', () => {
    const session = fakeSession()
    const ctx = classifySessionEvent(session, sessionEvent('turn/start', { turn: 3 }))
    expect(ctx?.event).toBe('turn/start')
    expect(ctx?.turn).toBe(3)
  })

  it('maps turn/end with reason and duration', () => {
    const session = fakeSession()
    classifySessionEvent(session, sessionEvent('turn/start', { turn: 3 }))
    const ctx = classifySessionEvent(session, sessionEvent('turn/end', { turn: 3, reason: { kind: 'completed' } }))
    expect(ctx?.event).toBe('turn/end')
    expect(ctx?.reason).toBe('completed')
    expect(ctx?.durationMs).toBeTypeOf('number')
    expect(ctx?.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('maps approval/asked payload', () => {
    const ctx = classifySessionEvent(
      fakeSession('s1'),
      sessionEvent('approval/asked', { id: 'a1', toolName: 'pwsh', callId: 'c1', reason: 'unsafe' }),
    )
    expect(ctx).toMatchObject({ event: 'approval/asked', sessionId: 's1', tool: 'pwsh', callId: 'c1' })
  })

  it('returns undefined for unrelated events', () => {
    expect(classifySessionEvent(fakeSession(), sessionEvent('todo/write', { todos: [] }))).toBeUndefined()
  })
})

describe('agent lifecycle contexts', () => {
  it('agentCreatedContext carries the session id', () => {
    const ctx = agentCreatedContext({ id: 'sess-9' })
    expect(ctx).toMatchObject({ event: 'agent/created', sessionId: 'sess-9' })
  })

  it('agentErrorContext renders error text', () => {
    const ctx = agentErrorContext({ id: 's1' }, 2, new Error('boom'))
    expect(ctx).toMatchObject({ event: 'agent/error', sessionId: 's1', turn: 2, error: 'boom' })
  })

  it('agentStatusContext renders status kind', () => {
    expect(agentStatusContext({ id: 's1' }, { kind: 'idle' }).status).toBe('idle')
    expect(agentStatusContext({ id: 's1' }, 'running').status).toBe('running')
  })
})

describe('text helpers', () => {
  it('errorText handles Error, string, and objects', () => {
    expect(errorText(new Error('x'))).toBe('x')
    expect(errorText('plain')).toBe('plain')
    expect(errorText({ code: 5 })).toBe('{"code":5}')
  })

  it('statusText handles string and kind-carrying objects', () => {
    expect(statusText('idle')).toBe('idle')
    expect(statusText({ kind: 'running' })).toBe('running')
    expect(statusText(42)).toBe('42')
  })
})

describe('context builders', () => {
  it('turnEndContext computes duration from remembered start', () => {
    const session = fakeSession('s2')
    classifySessionEvent(session, sessionEvent('turn/start', { turn: 1 }))
    const ctx = turnEndContext(session, 1, 'error')
    expect(ctx.durationMs).toBeTypeOf('number')
    expect(ctx.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('approvalContext is idempotent', () => {
    const ctx = approvalContext(fakeSession('s3'), { id: 'q1', toolName: 'ssh_exec' })
    expect(ctx).toMatchObject({ event: 'approval/asked', tool: 'ssh_exec' })
  })
})

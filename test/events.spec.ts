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
  sessionTitle,
  statusText,
  turnContent,
  turnEndContext,
  turnStartContext,
} from '../src/events.js'

// Minimal structural fakes for the session/event shapes this module consumes.
function sessionEvent(type: string, data: unknown) {
  return { type, seq: 1, time: Date.now(), data } as never
}

function fakeSession(id = 'session-1', events: unknown[] = []) {
  return { id, header: { cwd: 'D:\\work\\demo' }, events } as never
}

function textBlock(text: string) {
  return { type: 'text', text }
}

function userMessage(seq: number, text: string, kind = 'user') {
  return {
    type: 'user/message',
    seq,
    time: 1,
    data: { id: `u${seq}`, role: 'user', content: [textBlock(text)], source: { kind } },
  } as never
}

function titleEvent(seq: number, title: string) {
  return {
    type: 'session/title',
    seq,
    time: 1,
    data: { title, messageSeqs: [], source: { kind: 'fallback' } },
  } as never
}

function assistantMessage(seq: number, turn: number, text: string) {
  return {
    type: 'assistant/message',
    seq,
    time: 1,
    data: {
      turn,
      step: 1,
      message: {
        id: `a${seq}`,
        role: 'assistant',
        content: [textBlock(text)],
        source: { kind: 'model', provider: 'deepseek', model: 'deepseek-chat' },
      },
    },
  } as never
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

describe('sessionTitle', () => {
  it('prefers the latest session/title event', () => {
    const session = fakeSession('s1', [titleEvent(1, '第一条标题'), titleEvent(5, '最新标题')])
    expect(sessionTitle(session)).toBe('最新标题')
  })

  it('falls back to the first direct human prompt', () => {
    const session = fakeSession('s1', [userMessage(1, '帮我写一个脚本'), userMessage(2, '再补充一点')])
    expect(sessionTitle(session)).toBe('帮我写一个脚本')
  })

  it('skips injected plugin context and non-text messages', () => {
    const session = fakeSession('s1', [
      userMessage(1, '系统注入的说明', 'plugin'),
      userMessage(2, '真实的人类提问'),
    ])
    expect(sessionTitle(session)).toBe('真实的人类提问')
  })

  it('collapses whitespace and control characters to one line', () => {
    const session = fakeSession('s1', [userMessage(1, '第一行\n\u001B[31m带颜色\u001B[0m   第二行')])
    expect(sessionTitle(session)).toBe('第一行 带颜色 第二行')
  })

  it('returns undefined when the log offers nothing', () => {
    expect(sessionTitle(fakeSession())).toBeUndefined()
    expect(sessionTitle(fakeSession('s1', [assistantMessage(1, 1, '只有回复')]))).toBeUndefined()
  })
})

describe('turnContent', () => {
  it('returns the final assistant text of the requested turn', () => {
    const session = fakeSession('s1', [
      assistantMessage(1, 1, '第一步'),
      assistantMessage(2, 1, '第二步'),
      assistantMessage(3, 2, '另一回合'),
    ])
    expect(turnContent(session, 1)).toBe('第二步')
  })

  it('joins multiple text blocks and ignores non-text blocks', () => {
    const message = {
      type: 'assistant/message',
      seq: 1,
      time: 1,
      data: {
        turn: 4,
        step: 1,
        message: {
          id: 'a1',
          role: 'assistant',
          content: [
            { type: 'reasoning', text: '思考过程' },
            { type: 'text', text: '第一段' },
            { type: 'text', text: '第二段' },
          ],
          source: { kind: 'model', provider: 'p', model: 'm' },
        },
      },
    } as never
    expect(turnContent(fakeSession('s1', [message]), 4)).toBe('第一段\n\n第二段')
  })

  it('returns undefined when the turn has no assistant text', () => {
    expect(turnContent(fakeSession('s1', [assistantMessage(1, 2, '其他回合')]), 1)).toBeUndefined()
    expect(turnContent(fakeSession(), 1)).toBeUndefined()
  })
})

describe('turnEndContext enrichment', () => {
  it('carries session name and turn content for completed turns', () => {
    const session = fakeSession('s2', [userMessage(1, '修复这个 bug'), assistantMessage(2, 1, '已修复，提交见 #9')])
    const ctx = turnEndContext(session, 1, 'completed')
    expect(ctx.sessionName).toBe('修复这个 bug')
    expect(ctx.content).toBe('已修复，提交见 #9')
    expect(ctx.reason).toBe('completed')
    expect(ctx.error).toBeUndefined()
  })

  it('extracts the LlmFailure message for error turns', () => {
    const ctx = turnEndContext(fakeSession('s2'), 2, {
      kind: 'error',
      error: { message: 'upstream timeout', code: 'TIMEOUT', status: 504 },
    })
    expect(ctx.reason).toBe('error')
    expect(ctx.error).toBe('upstream timeout')
  })

  it('keeps working with a plain reason-kind string', () => {
    const ctx = turnEndContext(fakeSession('s2'), 2, 'aborted')
    expect(ctx).toMatchObject({ event: 'turn/end', reason: 'aborted', turn: 2 })
  })

  it('classifySessionEvent forwards the full reason to turnEndContext', () => {
    const session = fakeSession('s2')
    classifySessionEvent(session, sessionEvent('turn/start', { turn: 1 }))
    const ctx = classifySessionEvent(
      session,
      sessionEvent('turn/end', { turn: 1, reason: { kind: 'error', error: { message: 'bad request', code: 'BAD' } } }),
    )
    expect(ctx?.reason).toBe('error')
    expect(ctx?.error).toBe('bad request')
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

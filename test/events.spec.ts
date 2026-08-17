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
  matchFilters,
  sessionCreatedContext,
  sessionDisposedContext,
  sessionTitle,
  statusText,
  turnContent,
  turnEndContext,
  turnStartContext,
  turnUsage,
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

describe('turnUsage aggregation', () => {
  it('sums input/output across steps and skips other turns', () => {
    const withUsage = (seq: number, turn: number, usage: unknown) => ({
      type: 'assistant/message',
      seq,
      time: 1,
      data: {
        turn,
        step: seq,
        message: { id: `a${seq}`, role: 'assistant', content: [textBlock('x')], source: { kind: 'model' } },
        usage,
      },
    }) as never
    const session = fakeSession('s1', [
      withUsage(1, 1, { inputTokens: 100, outputTokens: 50 }),
      withUsage(2, 1, { inputTokens: 30, outputTokens: 20, cacheReadTokens: 500, reasoningTokens: 7 }),
      withUsage(3, 2, { inputTokens: 999, outputTokens: 999 }),
    ])
    expect(turnUsage(session, 1)).toEqual({
      inputTokens: 130,
      outputTokens: 70,
      cacheReadTokens: 500,
      reasoningTokens: 7,
    })
  })

  it('returns undefined when no step reported usage', () => {
    expect(turnUsage(fakeSession('s1', [assistantMessage(1, 1, '无统计')]), 1)).toBeUndefined()
    expect(turnUsage(fakeSession('s1'), 1)).toBeUndefined()
  })
})

describe('new firehose events', () => {
  it('classifies step/end', () => {
    const ctx = classifySessionEvent(fakeSession('s1'), sessionEvent('step/end', { turn: 2, step: 5 }))
    expect(ctx).toMatchObject({ event: 'step/end', sessionId: 's1', turn: 2, step: 5 })
  })

  it('classifies tool/call with name and raw arguments', () => {
    const ctx = classifySessionEvent(
      fakeSession('s1'),
      sessionEvent('tool/call', { turn: 2, step: 1, callId: 'call-9', name: 'pwsh', arguments: '{"command":"rm -rf /"}' }),
    )
    expect(ctx).toMatchObject({
      event: 'tool/call',
      sessionId: 's1',
      turn: 2,
      step: 1,
      tool: 'pwsh',
      callId: 'call-9',
      toolArgs: '{"command":"rm -rf /"}',
    })
  })

  it('classifies tool/result and resolves the tool name from the matching call', () => {
    const session = fakeSession('s1')
    classifySessionEvent(
      session,
      sessionEvent('tool/call', { turn: 2, step: 1, callId: 'call-9', name: 'read', arguments: '{}' }),
    )
    const ctx = classifySessionEvent(
      session,
      sessionEvent('tool/result', {
        turn: 2,
        step: 1,
        callId: 'call-9',
        message: { id: 'm1', role: 'user', content: [{ type: 'tool-result', toolCallId: 'call-9', content: [textBlock('文件内容')] }], source: { kind: 'tool', callId: 'call-9' } },
      }),
    )
    expect(ctx).toMatchObject({ event: 'tool/result', tool: 'read', callId: 'call-9', content: '文件内容', toolError: undefined })
  })

  it('classifies tool/result with a failure identity', () => {
    const ctx = classifySessionEvent(
      fakeSession('s1'),
      sessionEvent('tool/result', {
        turn: 2,
        step: 1,
        callId: 'call-10',
        message: { id: 'm2', role: 'user', content: [{ type: 'tool-result', toolCallId: 'call-10', content: [] }], source: { kind: 'tool', callId: 'call-10' } },
        error: { name: 'EACCES', code: 'permission-denied' },
      }),
    )
    expect(ctx).toMatchObject({ event: 'tool/result', tool: undefined, toolError: 'EACCES: permission-denied' })
  })

  it('classifies user/message with source and content', () => {
    const ctx = classifySessionEvent(
      fakeSession('s1'),
      sessionEvent('user/message', { id: 'u1', role: 'user', content: [textBlock('新的需求')], source: { kind: 'user' } }),
    )
    expect(ctx).toMatchObject({ event: 'user/message', source: 'user', content: '新的需求' })
  })

  it('classifies session/title with the new name and source kind', () => {
    const ctx = classifySessionEvent(
      fakeSession('s1'),
      sessionEvent('session/title', { title: '新的会话名', messageSeqs: [1], source: { kind: 'provider', provider: 'x' } }),
    )
    expect(ctx).toMatchObject({ event: 'session/title', sessionName: '新的会话名', source: 'provider' })
  })

  it('session lifecycle contexts carry id, name, and cwd', () => {
    const session = fakeSession('s9', [userMessage(1, '开局第一问')])
    expect(sessionCreatedContext(session)).toMatchObject({
      event: 'session/created',
      sessionId: 's9',
      sessionName: '开局第一问',
      cwd: 'D:\\work\\demo',
    })
    expect(sessionDisposedContext(session)).toMatchObject({ event: 'session/disposed', sessionId: 's9' })
  })
})

describe('turnEndContext usage enrichment', () => {
  it('attaches aggregated usage to turn/end contexts', () => {
    const withUsage = (seq: number, usage: unknown) => ({
      type: 'assistant/message',
      seq,
      time: 1,
      data: {
        turn: 1,
        step: seq,
        message: { id: `a${seq}`, role: 'assistant', content: [textBlock('x')], source: { kind: 'model' } },
        usage,
      },
    }) as never
    const session = fakeSession('s1', [withUsage(1, { inputTokens: 10, outputTokens: 5 })])
    const ctx = turnEndContext(session, 1, 'completed')
    expect(ctx.usageInputTokens).toBe(10)
    expect(ctx.usageOutputTokens).toBe(5)
    expect(ctx.usageCacheReadTokens).toBeUndefined()
  })

  it('leaves usage fields undefined when the turn has none', () => {
    const ctx = turnEndContext(fakeSession('s1'), 1, 'completed')
    expect(ctx.usageInputTokens).toBeUndefined()
    expect(ctx.usageOutputTokens).toBeUndefined()
  })
})

describe('matchFilters', () => {
  const ctx = {
    event: 'tool/call',
    sessionId: 'sess-1',
    sessionName: '修复构建',
    tool: 'pwsh',
    error: 'upstream timeout',
    timestamp: 'T',
  }

  it('passes when match is absent or empty', () => {
    expect(matchFilters(undefined, ctx)).toBe(true)
    expect(matchFilters({}, ctx)).toBe(true)
  })

  it('requires every declared regex to match its field', () => {
    expect(matchFilters({ tool: /^pw/ }, ctx)).toBe(true)
    expect(matchFilters({ tool: /^pw/, sessionName: /构建/ }, ctx)).toBe(true)
    expect(matchFilters({ tool: /^pw/, sessionName: /不存在的名字/ }, ctx)).toBe(false)
  })

  it('rejects when a field is absent from the context', () => {
    expect(matchFilters({ reason: /completed/ }, ctx)).toBe(false)
  })

  it('coerces non-string fields to string for the test', () => {
    const numbered = { event: 'turn/end', turn: 7, timestamp: 'T' }
    expect(matchFilters({ turn: /^7$/ }, numbered)).toBe(true)
  })

  it('rejects non-RegExp patterns defensively', () => {
    expect(matchFilters({ tool: '^pw' as unknown as RegExp }, ctx)).toBe(false)
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildText, formatDuration, getToken, readEnv, run, sendMessage } from '../examples/notify-feishu.mjs'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('readEnv', () => {
  it('maps DSH_HOOK_* environment variables', () => {
    const ctx = readEnv({
      DSH_HOOKS_FEISHU_APP_ID: 'cli_x',
      DSH_HOOKS_FEISHU_APP_SECRET: 's',
      DSH_HOOKS_FEISHU_TO: 'ou_1',
      DSH_HOOK_EVENT: 'turn/end',
      DSH_HOOK_SESSION_ID: 'sess-1',
      DSH_HOOK_REASON: 'completed',
    } as Record<string, string>)
    expect(ctx).toMatchObject({
      appId: 'cli_x',
      to: 'ou_1',
      event: 'turn/end',
      sessionId: 'sess-1',
      reason: 'completed',
    })
  })

  it('defaults missing fields to empty strings', () => {
    const ctx = readEnv({} as Record<string, string>)
    expect(ctx.event).toBe('')
    expect(ctx.sessionId).toBe('')
  })
})

describe('buildText', () => {
  it('renders a turn/end notice', () => {
    const text = buildText({
      event: 'turn/end',
      reason: 'completed',
      durationMs: '65000',
      sessionId: 'sess-1',
    })
    expect(text).toContain('【任务结束】')
    expect(text).toContain('completed')
    expect(text).toContain('1 分 5 秒')
    expect(text).toContain('sess-1')
  })

  it('renders an approval notice', () => {
    const text = buildText({ event: 'approval/asked', tool: 'ssh_exec', sessionId: 'sess-2' })
    expect(text).toContain('【等待审批】')
    expect(text).toContain('ssh_exec')
  })

  it('renders an agent error notice', () => {
    const text = buildText({ event: 'agent/error', error: 'boom', sessionId: 's3' })
    expect(text).toContain('【Agent 错误】')
    expect(text).toContain('boom')
  })

  it('truncates long errors', () => {
    const text = buildText({ event: 'agent/error', error: 'x'.repeat(500) })
    expect(text).toContain('x'.repeat(200))
    expect(text).not.toContain('x'.repeat(201))
  })

  it('renders agent status and generic events', () => {
    expect(buildText({ event: 'agent/status', status: 'idle' })).toContain('idle')
    expect(buildText({ event: 'agent/created', sessionId: 's9' })).toContain('agent/created')
  })
})

describe('formatDuration', () => {
  it('formats seconds, minutes, and invalid input', () => {
    expect(formatDuration(500)).toBe('1 秒')
    expect(formatDuration(65000)).toBe('1 分 5 秒')
    expect(formatDuration(120000)).toBe('2 分钟')
    expect(formatDuration(Number.NaN)).toBe('NaN')
    expect(formatDuration(-5)).toBe('-5')
  })
})

describe('getToken / sendMessage', () => {
  it('getToken posts credentials and returns the token', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ code: 0, msg: 'ok', tenant_access_token: 'tok-1' }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    expect(await getToken('cli_x', 's')).toBe('tok-1')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('tenant_access_token')
    expect(JSON.parse(String(init.body))).toEqual({ app_id: 'cli_x', app_secret: 's' })
  })

  it('getToken throws on API error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ code: 99991663, msg: 'bad app' }), { status: 200 })))
    await expect(getToken('bad', 's')).rejects.toThrow('bad app')
  })

  it('sendMessage posts a text message with bearer auth', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ code: 0, msg: 'success' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await sendMessage('tok', 'ou_9', '你好')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/im/v1/messages')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok')
    const body = JSON.parse(String(init.body))
    expect(body.receive_id).toBe('ou_9')
    expect(JSON.parse(body.content)).toEqual({ text: '你好' })
  })
})

describe('run', () => {
  it('rejects without credentials', async () => {
    await expect(run({ event: 'turn/end' })).rejects.toThrow('DSH_HOOKS_FEISHU_APP_ID')
    await expect(run({ appId: 'cli_x', appSecret: 's', event: 'turn/end' })).rejects.toThrow('DSH_HOOKS_FEISHU_TO')
  })

  it('runs the token + send pipeline', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('tenant_access_token')) {
        return new Response(JSON.stringify({ code: 0, msg: 'ok', tenant_access_token: 'tok' }), { status: 200 })
      }
      return new Response(JSON.stringify({ code: 0, msg: 'success' }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    await run({ appId: 'cli_x', appSecret: 's', to: 'ou_1', event: 'turn/end', reason: 'error' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

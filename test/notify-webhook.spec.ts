import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildPayload, parseArgs, postJson, readEnv, run, summarize } from '../examples/notify-webhook.mjs'

afterEach(() => {
  vi.unstubAllGlobals()
})

function fullEnv(overrides = {}) {
  return {
    DSH_HOOK_EVENT: 'turn/end',
    DSH_HOOK_TIMESTAMP: '2026-08-17T00:00:00.000Z',
    DSH_HOOK_SESSION_ID: 'sess-1',
    DSH_HOOK_SESSION_NAME: '修复构建',
    DSH_HOOK_CWD: 'D:\\work\\demo',
    DSH_HOOK_TURN: '3',
    DSH_HOOK_STEP: '2',
    DSH_HOOK_REASON: 'completed',
    DSH_HOOK_TOOL: 'pwsh',
    DSH_HOOK_CALL_ID: 'call-9',
    DSH_HOOK_TOOL_ARGS: '{"command":"ls"}',
    DSH_HOOK_SOURCE: 'user',
    DSH_HOOK_DURATION_MS: '65000',
    DSH_HOOK_CONTENT: '已完成',
    DSH_HOOK_USAGE_INPUT_TOKENS: '120',
    DSH_HOOK_USAGE_OUTPUT_TOKENS: '60',
    ...overrides,
  }
}

describe('readEnv', () => {
  it('keeps only the DSH_HOOK_* variables that are present and non-empty', () => {
    const raw = readEnv({ ...fullEnv(), UNRELATED: 'x', DSH_HOOK_ERROR: '' })
    expect(raw.DSH_HOOK_EVENT).toBe('turn/end')
    expect(raw.DSH_HOOK_ERROR).toBeUndefined()
    expect(raw.UNRELATED).toBeUndefined()
  })

  it('returns an empty object for an empty environment', () => {
    expect(readEnv({})).toEqual({})
  })
})

describe('buildPayload', () => {
  it('groups session facts and keeps numbers numeric', () => {
    const payload = buildPayload(readEnv(fullEnv()))
    expect(payload).toMatchObject({
      event: 'turn/end',
      timestamp: '2026-08-17T00:00:00.000Z',
      session: { id: 'sess-1', name: '修复构建', cwd: 'D:\\work\\demo' },
      turn: 3,
      step: 2,
      reason: 'completed',
      tool: 'pwsh',
      call_id: 'call-9',
      tool_args: '{"command":"ls"}',
      source: 'user',
      duration_ms: 65000,
      content: '已完成',
      usage: { input_tokens: 120, output_tokens: 60 },
    })
  })

  it('omits absent groups and ignores garbage numbers', () => {
    const payload = buildPayload(readEnv({ DSH_HOOK_EVENT: 'step/end', DSH_HOOK_TURN: 'abc' }))
    expect(payload).toEqual({ event: 'step/end' })
  })

  it('carries partial usage fields', () => {
    const payload = buildPayload(readEnv({ DSH_HOOK_EVENT: 'turn/end', DSH_HOOK_USAGE_CACHE_READ_TOKENS: '500' }))
    expect(payload.usage).toEqual({ cache_read_tokens: 500 })
  })
})

describe('summarize', () => {
  it('writes per-event one-liners', () => {
    expect(summarize(buildPayload(readEnv(fullEnv())))).toContain('✅ 任务已完成')
    expect(summarize({ event: 'tool/call', tool: 'read' })).toContain('调用工具 read')
    expect(summarize({ event: 'tool/result', tool: 'read', tool_error: 'EACCES: x' })).toContain('工具 read 失败')
    expect(summarize({ event: 'approval/asked', tool: 'ssh_exec' })).toContain('需要审批')
  })

  it('has a generic fallback', () => {
    expect(summarize({ event: 'agent/status' })).toContain('agent/status')
  })
})

describe('parseArgs', () => {
  it('parses url, slack, timeout, and quiet flags', () => {
    expect(parseArgs(['--url', 'https://x', '--slack', '--timeout', '5000', '-q'])).toEqual({
      url: 'https://x',
      slack: true,
      timeoutMs: 5000,
      quiet: true,
    })
  })

  it('ignores garbage timeouts and defaults to 10000', () => {
    expect(parseArgs(['--timeout', 'abc']).timeoutMs).toBe(10000)
    expect(parseArgs([])).toEqual({ url: '', slack: false, timeoutMs: 10000, quiet: false })
  })
})

describe('postJson', () => {
  it('posts JSON and rejects non-2xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    await postJson('https://hooks.example/x', { a: 1 }, 1000)
    expect(fetchMock).toHaveBeenCalledWith('https://hooks.example/x', expect.objectContaining({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ a: 1 }),
    }))

    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })
    await expect(postJson('https://hooks.example/x', { a: 1 }, 1000)).rejects.toThrow('HTTP 500')
  })

  it('retries once on transport failure', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    await postJson('https://hooks.example/x', { a: 1 }, 1000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('fails after the retry also fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
    await expect(postJson('https://hooks.example/x', { a: 1 }, 1000)).rejects.toThrow('重试后仍失败')
  })
})

describe('run', () => {
  it('requires a webhook url and the hook event', async () => {
    vi.stubGlobal('fetch', vi.fn())
    await expect(run(fullEnv(), [])).rejects.toThrow('缺少 webhook URL')
    await expect(run({ DSH_HOOKS_WEBHOOK_URL: 'https://hooks.example/x' }, [])).rejects.toThrow('缺少 DSH_HOOK_EVENT')
  })

  it('posts the structured payload and returns it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const body = await run(fullEnv(), ['--url', 'https://hooks.example/x'])
    expect(body.event).toBe('turn/end')
    expect(body.session).toMatchObject({ id: 'sess-1' })
  })

  it('posts a Slack-style text body with --slack', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const body = await run(fullEnv(), ['--url', 'https://hooks.example/x', '--slack'])
    expect(body).toHaveProperty('text')
    const call = fetchMock.mock.calls[0]?.[1]
    expect(JSON.parse(call.body)).toHaveProperty('text')
  })
})

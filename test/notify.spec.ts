import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireNotify, sendDesktop, sendFeishu, sendWebhook, summarizeContext, webhookPayload } from '../src/notify.js'

// Mock spawn so desktop notifications never open a real shell/UI in tests.
vi.mock('node:child_process', () => {
  return {
    spawn: vi.fn(),
  }
})

// The built-in feishu channel reuses the shipped example pipeline; mocking it
// keeps credentials and card rendering out of the tests while still asserting
// the wiring (env mapping, retry classification, history records).
vi.mock('../examples/notify-feishu.mjs', () => ({
  readEnv: vi.fn((env: Record<string, string | undefined>) => ({
    event: env.DSH_HOOK_EVENT ?? '',
    sessionId: env.DSH_HOOK_SESSION_ID ?? '',
    sessionName: env.DSH_HOOK_SESSION_NAME ?? '',
    appId: env.DSH_HOOKS_FEISHU_APP_ID,
    to: env.DSH_HOOKS_FEISHU_TO,
  })),
  run: vi.fn(),
}))

import { spawn } from 'node:child_process'
import { run as feishuRun } from '../examples/notify-feishu.mjs'

const spawnMock = vi.mocked(spawn)
const feishuRunMock = vi.mocked(feishuRun)

function fakeChild() {
  const listeners: Record<string, Array<(v?: unknown) => void>> = {}
  const child = {
    pid: 12345,
    kill: vi.fn(),
    on: vi.fn((event: string, cb: (v?: unknown) => void) => {
      ;(listeners[event] ??= []).push(cb)
      return child
    }),
    emit(event: string, value?: unknown) {
      for (const cb of listeners[event] ?? []) cb(value)
    },
  }
  return child
}

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

const ctx = {
  event: 'turn/end',
  sessionId: 'sess-1',
  sessionName: '修复构建',
  cwd: 'D:\\work\\demo',
  turn: 3,
  reason: 'completed',
  content: '已修复，提交见 #9',
  usageInputTokens: 120,
  usageOutputTokens: 60,
  timestamp: '2026-08-17T00:00:00.000Z',
}

describe('summarizeContext', () => {
  it('writes per-event one-liners', () => {
    expect(summarizeContext(ctx)).toContain('✅ 任务已完成')
    expect(summarizeContext(ctx)).toContain('修复构建')
    expect(summarizeContext({ event: 'tool/call', tool: 'read', timestamp: 'T' })).toContain('调用工具 read')
    expect(summarizeContext({ event: 'tool/result', tool: 'read', toolError: 'EACCES: x', timestamp: 'T' })).toContain('工具 read 失败')
    expect(summarizeContext({ event: 'approval/asked', tool: 'ssh_exec', timestamp: 'T' })).toContain('需要审批')
  })

  it('has a generic fallback', () => {
    expect(summarizeContext({ event: 'agent/status', timestamp: 'T' })).toContain('agent/status')
  })
})

describe('webhookPayload', () => {
  it('groups session facts and keeps only present fields', () => {
    expect(webhookPayload(ctx)).toEqual({
      event: 'turn/end',
      timestamp: '2026-08-17T00:00:00.000Z',
      session: { id: 'sess-1', name: '修复构建', cwd: 'D:\\work\\demo' },
      turn: 3,
      reason: 'completed',
      content: '已修复，提交见 #9',
      usage: { input_tokens: 120, output_tokens: 60 },
    })
  })

  it('omits absent groups', () => {
    expect(webhookPayload({ event: 'step/end', timestamp: 'T' })).toEqual({ event: 'step/end', timestamp: 'T' })
  })

  it('carries the tool failure reason when the host reported one', () => {
    const payload = webhookPayload({
      event: 'tool/result',
      timestamp: 'T',
      tool: 'pwsh',
      toolError: 'ENOENT: not-found',
      toolErrorReason: '文件不存在',
    })
    expect(payload.tool_error).toBe('ENOENT: not-found')
    expect(payload.tool_error_reason).toBe('文件不存在')
  })
})

describe('sendWebhook', () => {
  it('posts the structured document and returns ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const result = await sendWebhook({ channel: 'webhook', url: 'https://hooks.example/x' }, ctx, {})
    expect(result).toEqual({ ok: true })
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }]
    expect(url).toBe('https://hooks.example/x')
    expect(JSON.parse(init.body)).toMatchObject({ event: 'turn/end', session: { id: 'sess-1' } })
  })

  it('posts a Slack-style { text } summary with slack: true', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    await sendWebhook({ channel: 'webhook', url: 'https://hooks.example/x', slack: true }, ctx, {})
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, { body: string }])[1].body)
    expect(Object.keys(body)).toEqual(['text'])
    expect(body.text).toContain('✅ 任务已完成')
  })

  it('falls back to the DSH_HOOKS_WEBHOOK_URL env var', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    await sendWebhook({ channel: 'webhook' }, ctx, { DSH_HOOKS_WEBHOOK_URL: 'https://env.example/x' })
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe('https://env.example/x')
  })

  it('fails without any url', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const result = await sendWebhook({ channel: 'webhook' }, ctx, {})
    expect(result.ok).toBe(false)
    expect(result.error).toContain('缺少 webhook URL')
  })

  it('reports HTTP errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    const result = await sendWebhook({ channel: 'webhook', url: 'https://x' }, ctx, {})
    expect(result).toMatchObject({ ok: false })
  })

  it('makes exactly one attempt by default (retries defaults to 0)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('ECONNRESET'))
    vi.stubGlobal('fetch', fetchMock)
    const result = await sendWebhook({ channel: 'webhook', url: 'https://x' }, ctx, {})
    expect(result.ok).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries a transport failure up to the configured count', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const logs: string[] = []
    const result = await sendWebhook({ channel: 'webhook', url: 'https://x' }, ctx, {}, {
      retries: 2,
      retryDelayMs: 0,
      log: (line) => logs.push(line),
    })
    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(logs).toHaveLength(2)
    expect(logs[0]).toContain('1/2')
    expect(logs[1]).toContain('2/2')
  })

  it('retries retryable HTTP statuses (408 / 429 / 5xx)', async () => {
    for (const status of [408, 429, 503]) {
      const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status }).mockResolvedValueOnce({ ok: true })
      vi.stubGlobal('fetch', fetchMock)
      const result = await sendWebhook({ channel: 'webhook', url: 'https://x' }, ctx, {}, { retries: 1, retryDelayMs: 0, log: () => {} })
      expect(result).toEqual({ ok: true })
      expect(fetchMock).toHaveBeenCalledTimes(2)
    }
  })

  it('never retries a non-retryable status', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 })
    vi.stubGlobal('fetch', fetchMock)
    const result = await sendWebhook({ channel: 'webhook', url: 'https://x' }, ctx, {}, { retries: 3, retryDelayMs: 0, log: () => {} })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('HTTP 404')
    expect(result.error).not.toContain('次尝试后仍失败')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reports the attempt count once the retry budget is exhausted', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
    const result = await sendWebhook({ channel: 'webhook', url: 'https://x' }, ctx, {}, { retries: 1, retryDelayMs: 0, log: () => {} })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('2 次尝试后仍失败')
  })

  it('waits retryDelayMs (doubling) before each retry', async () => {
    vi.useFakeTimers()
    try {
      const fetchMock = vi.fn()
        .mockRejectedValueOnce(new Error('a'))
        .mockRejectedValueOnce(new Error('b'))
        .mockResolvedValueOnce({ ok: true })
      vi.stubGlobal('fetch', fetchMock)
      const pending = sendWebhook({ channel: 'webhook', url: 'https://x' }, ctx, {}, { retries: 2, retryDelayMs: 200, log: () => {} })
      await vi.advanceTimersByTimeAsync(0)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(399)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(1)
      expect(await pending).toEqual({ ok: true })
      expect(fetchMock).toHaveBeenCalledTimes(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('caps the exponential backoff at the ceiling', async () => {
    vi.useFakeTimers()
    try {
      const logged: string[] = []
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new Error('a'))
        .mockRejectedValueOnce(new Error('b'))
        .mockResolvedValueOnce({ ok: true })
      vi.stubGlobal('fetch', fetchMock)
      const pending = sendWebhook(
        { channel: 'webhook', url: 'https://x' },
        ctx,
        {},
        { retries: 2, retryDelayMs: 20000, log: (line) => logged.push(line) },
      )
      await vi.advanceTimersByTimeAsync(0)
      // First retry waits the base delay; the second would double to 40 s and
      // is clamped to the ceiling, so one logical run stays short-lived.
      expect(logged[0]).toContain('20000ms 后重试')
      await vi.advanceTimersByTimeAsync(20000)
      expect(logged[1]).toContain('30000ms 后重试')
      await vi.advanceTimersByTimeAsync(30000)
      expect(await pending).toEqual({ ok: true })
    } finally {
      vi.useRealTimers()
    }
  })

  it('stops retrying when the plugin unloads', async () => {
    vi.useFakeTimers()
    try {
      const fetchMock = vi.fn().mockRejectedValue(new Error('boom'))
      vi.stubGlobal('fetch', fetchMock)
      const controller = new AbortController()
      const pending = sendWebhook(
        { channel: 'webhook', url: 'https://x' },
        ctx,
        {},
        { retries: 5, retryDelayMs: 100, signal: controller.signal, log: () => {} },
      )
      await vi.advanceTimersByTimeAsync(0)
      expect(fetchMock).toHaveBeenCalledTimes(1)

      controller.abort()
      await vi.advanceTimersByTimeAsync(5000)
      const result = await pending
      expect(result).toMatchObject({ ok: false, aborted: true })
      // The backoff sleep is cut short and no further request is made.
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it("honours the hook's timeoutMs for one attempt", async () => {
    vi.useFakeTimers()
    try {
      const fetchMock = vi.fn().mockImplementation((_url: string, init: { signal: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
        })
      })
      vi.stubGlobal('fetch', fetchMock)
      const pending = sendWebhook({ channel: 'webhook', url: 'https://x' }, ctx, {}, { retries: 0, timeoutMs: 50, log: () => {} })
      // Only a 50 ms per-attempt timeout settles this; the 10 s default would hang.
      await vi.advanceTimersByTimeAsync(50)
      const result = await pending
      expect(result.ok).toBe(false)
      expect(result.error).toContain('webhook 请求失败')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('sendDesktop', () => {
  it('runs the platform command and returns ok on exit 0', async () => {
    const child = fakeChild()
    spawnMock.mockReturnValue(child as never)
    const result = sendDesktop({ channel: 'desktop' }, ctx)
    child.emit('close', 0)
    expect(await result).toEqual({ ok: true })
  })

  it('reports non-zero exit codes', async () => {
    const child = fakeChild()
    spawnMock.mockReturnValue(child as never)
    const result = sendDesktop({ channel: 'desktop' }, ctx)
    child.emit('close', 1)
    const settled = await result
    expect(settled.ok).toBe(false)
  })

  it('reports spawn failures', async () => {
    spawnMock.mockImplementation(() => {
      throw new Error('ENOENT')
    })
    const result = await sendDesktop({ channel: 'desktop' }, ctx)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('ENOENT')
  })

  it('hides the console window and keeps a timeout as the failure reason', async () => {
    vi.useFakeTimers()
    try {
      const child = fakeChild()
      spawnMock.mockReturnValue(child as never)
      const pending = sendDesktop({ channel: 'desktop' }, ctx)
      // A desktop toast must never flash a console window behind it.
      expect(spawnMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({ windowsHide: true }),
      )
      await vi.advanceTimersByTimeAsync(60000)
      const settled = await pending
      expect(settled.ok).toBe(false)
      expect(settled.error).toContain('超时')
      // The kill makes `close` fire afterwards; it must not rewrite the reason.
      child.emit('close', null)
      expect(settled.error).toContain('超时')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('fireNotify', () => {
  it('warns on failure but never throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
      await fireNotify({ channel: 'webhook', url: 'https://x' }, ctx)
      expect(warnSpy).toHaveBeenCalled()
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('records an unload-aborted retry as skipped, not as a delivery failure', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const controller = new AbortController()
      controller.abort()
      const outcomes: string[] = []
      const result = await fireNotify(
        { channel: 'webhook', url: 'https://x' },
        ctx,
        (record) => outcomes.push(record.outcome),
        { retries: 3, signal: controller.signal },
      )
      expect(result).toMatchObject({ ok: false, aborted: true })
      expect(outcomes).toEqual(['skipped'])
      expect(warnSpy).not.toHaveBeenCalled()
    } finally {
      warnSpy.mockRestore()
    }
  })
})

describe('sendFeishu', () => {
  afterEach(() => {
    feishuRunMock.mockReset()
  })

  it('reuses the example pipeline with the context mapped to env', async () => {
    feishuRunMock.mockResolvedValue({ kind: 'card' })
    const result = await sendFeishu(ctx)
    expect(result).toEqual({ ok: true })
    const [mapped, args, configPath] = feishuRunMock.mock.calls[0] as [
      Record<string, unknown>,
      string[],
      string | undefined,
    ]
    expect(mapped).toMatchObject({ event: 'turn/end', sessionId: 'sess-1' })
    expect(args).toEqual([])
    // Undefined keeps the example's own default config path.
    expect(configPath).toBeUndefined()
  })

  it('accepts a text result from the pipeline', async () => {
    feishuRunMock.mockResolvedValue({ kind: 'text', text: 'hi' })
    expect(await sendFeishu(ctx)).toEqual({ ok: true })
  })

  it('does not retry a configuration mistake', async () => {
    feishuRunMock.mockRejectedValue(new Error('缺少 DSH_HOOKS_FEISHU_APP_ID / DSH_HOOKS_FEISHU_APP_SECRET'))
    const result = await sendFeishu(ctx, { retries: 3, retryDelayMs: 1, log: () => {} })
    expect(feishuRunMock).toHaveBeenCalledTimes(1)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('飞书通知失败: 缺少 DSH_HOOKS_FEISHU_APP_ID')
    expect(result.error).not.toContain('次尝试后仍失败')
  })

  it('retries a transport failure up to the configured count', async () => {
    vi.useFakeTimers()
    try {
      feishuRunMock.mockRejectedValue(new Error('飞书接口请求失败: ECONNRESET'))
      const pending = sendFeishu(ctx, { retries: 1, retryDelayMs: 50, log: () => {} })
      await vi.advanceTimersByTimeAsync(0)
      expect(feishuRunMock).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(50)
      const result = await pending
      expect(feishuRunMock).toHaveBeenCalledTimes(2)
      expect(result.error).toContain('（2 次尝试后仍失败）')
    } finally {
      vi.useRealTimers()
    }
  })

  it('never attempts a send once the plugin is unloading', async () => {
    const controller = new AbortController()
    controller.abort()
    const result = await sendFeishu(ctx, { retries: 5, signal: controller.signal })
    expect(result).toMatchObject({ ok: false, aborted: true })
    expect(feishuRunMock).not.toHaveBeenCalled()
  })

  it('records the channel as notify:feishu in history', async () => {
    feishuRunMock.mockResolvedValue({ kind: 'card' })
    const records: Array<{ command: string; outcome: string }> = []
    await fireNotify({ channel: 'feishu' }, ctx, (record) => records.push(record as { command: string; outcome: string }))
    expect(records).toEqual([expect.objectContaining({ command: 'notify:feishu', outcome: 'sent' })])
  })
})

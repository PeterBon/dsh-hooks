import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireNotify, sendDesktop, sendWebhook, summarizeContext, webhookPayload } from '../src/notify.js'

// Mock spawn so desktop notifications never open a real shell/UI in tests.
vi.mock('node:child_process', () => {
  return {
    spawn: vi.fn(),
  }
})

import { spawn } from 'node:child_process'

const spawnMock = vi.mocked(spawn)

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

  it('retries once on transport failure', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const result = await sendWebhook({ channel: 'webhook', url: 'https://x' }, ctx, {})
    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
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
})

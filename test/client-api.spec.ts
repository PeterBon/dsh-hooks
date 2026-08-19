import { describe, expect, it, vi } from 'vitest'
import {
  fetchFeishuStatus,
  fetchHistory,
  fetchStatus,
  formatTime,
  outcomeLabel,
  outcomeTone,
  postFeishuCancel,
  postFeishuConfig,
  postFeishuSetup,
  postFeishuTest,
  postTest,
} from '../src/client/api.ts'

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as Response
}

describe('fetchStatus', () => {
  it('returns the status value', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ ok: true, value: { name: 'dsh-hooks', version: '0.2.2', hookCount: 3, historyCount: 7 } }),
    )
    const result = await fetchStatus(fetchFn as unknown as typeof fetch)
    expect(result).toEqual({ name: 'dsh-hooks', version: '0.2.2', hookCount: 3, historyCount: 7 })
    expect(fetchFn).toHaveBeenCalledWith('/dsh-hooks/status', expect.anything())
  })

  it('returns null on envelope errors and HTTP failures', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect(await fetchStatus(vi.fn().mockResolvedValue(jsonResponse({ ok: false, error: { code: 'x', message: 'y' } })) as never)).toBeNull()
      expect(await fetchStatus(vi.fn().mockResolvedValue(jsonResponse({}, false, 500)) as never)).toBeNull()
      expect(await fetchStatus(vi.fn().mockRejectedValue(new Error('down')) as never)).toBeNull()
    } finally {
      warn.mockRestore()
    }
  })
})

describe('fetchHistory', () => {
  it('caps n between 1 and 500', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ ok: true, value: [] }))
    await fetchHistory(0, fetchFn as unknown as typeof fetch)
    await fetchHistory(9999, fetchFn as unknown as typeof fetch)
    const urls = fetchFn.mock.calls.map((call) => String(call[0]))
    expect(urls[0]).toContain('n=1')
    expect(urls[1]).toContain('n=500')
  })
})

describe('postTest', () => {
  it('posts JSON and returns the test report', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ ok: true, value: { event: 'turn/end', executed: false, total: 2, matched: 1, lines: [] } }),
    )
    const result = await postTest({ event: 'turn/end', reason: 'completed' }, fetchFn as unknown as typeof fetch)
    expect(result?.matched).toBe(1)
    const [, init] = fetchFn.mock.calls[0] as [string, { method: string; body: string }]
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ event: 'turn/end', reason: 'completed' })
  })

  it('returns null on errors', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect(await postTest({ event: 'x' }, vi.fn().mockRejectedValue(new Error('down')) as never)).toBeNull()
    } finally {
      warn.mockRestore()
    }
  })
})

describe('formatters', () => {
  it('formats HH:MM:SS local time', () => {
    const ts = new Date(2026, 7, 17, 9, 5, 3).getTime()
    expect(formatTime(ts)).toBe('09:05:03')
  })

  it('labels and tones outcomes', () => {
    expect(outcomeLabel('exit-0')).toBe('成功')
    expect(outcomeLabel('exit-nonzero')).toBe('失败')
    expect(outcomeLabel('unknown-thing')).toBe('unknown-thing')
    expect(outcomeTone('sent')).toBe('ok')
    expect(outcomeTone('send-failed')).toBe('bad')
    expect(outcomeTone('timeout')).toBe('warn')
    expect(outcomeTone('spawned')).toBe('neutral')
  })
})

describe('Feishu API client', () => {
  it('fetches the connection summary and setup snapshot', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        ok: true,
        value: {
          configured: false,
          appId: null,
          targetKind: null,
          target: null,
          setup: { status: 'pending', startedAt: 1, qrUrl: 'https://x', qrDataUrl: 'data:image/png;base64,x', expiresAtMs: 9999 },
        },
      }),
    )
    const result = await fetchFeishuStatus(fetchFn as unknown as typeof fetch)
    expect(result?.setup?.status).toBe('pending')
    expect(fetchFn).toHaveBeenCalledWith('/dsh-hooks/feishu/status', expect.anything())
  })

  it('posts the profile to start a scan session', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ ok: true, value: { setup: { status: 'pending', startedAt: 1 } } }))
    const result = await postFeishuSetup('work', undefined, fetchFn as unknown as typeof fetch)
    expect(result).toMatchObject({ ok: true, setup: { status: 'pending' } })
    const [url, init] = fetchFn.mock.calls[0] as [string, { method: string; body: string }]
    expect(url).toBe('/dsh-hooks/feishu/setup')
    expect(JSON.parse(init.body)).toEqual({ profile: 'work' })
  })

  it('posts the truncation length with the setup request', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ ok: true, value: { setup: { status: 'pending', startedAt: 1 } } }))
    await postFeishuSetup('web', 800, fetchFn as unknown as typeof fetch)
    const [, init] = fetchFn.mock.calls[0] as [string, { body: string }]
    expect(JSON.parse(init.body)).toEqual({ profile: 'web', resultMaxChars: 800 })
  })

  it('surfaces a busy envelope error from setup', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ ok: false, error: { code: 'pending', message: '已有进行中的扫码会话，请先取消或等待完成' } }, false, 409),
    )
    const result = await postFeishuSetup('web', undefined, fetchFn as unknown as typeof fetch)
    expect(result).toEqual({ ok: false, error: '已有进行中的扫码会话，请先取消或等待完成' })
  })

  it('updates the truncation length via postFeishuConfig', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ ok: true, value: { resultMaxChars: 1200 } }))
    const result = await postFeishuConfig(1200, fetchFn as unknown as typeof fetch)
    expect(result).toMatchObject({ ok: true, resultMaxChars: 1200 })
    const [url, init] = fetchFn.mock.calls[0] as [string, { body: string }]
    expect(url).toBe('/dsh-hooks/feishu/config')
    expect(JSON.parse(init.body)).toEqual({ resultMaxChars: 1200 })
  })

  it('surfaces truncation validation errors', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ ok: false, error: { code: 'bad-request', message: '截断长度必须是 50–5000 之间的数字' } }, false, 400),
    )
    const result = await postFeishuConfig(10, fetchFn as unknown as typeof fetch)
    expect(result).toEqual({ ok: false, error: '截断长度必须是 50–5000 之间的数字' })
  })

  it('cancels a pending session', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ ok: true, value: { cancelled: true } }))
    const result = await postFeishuCancel(fetchFn as unknown as typeof fetch)
    expect(result.ok).toBe(true)
  })

  it('sends a test card and returns the message', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ ok: true, value: { message: '✅ 测试卡片已发送' } }))
    const result = await postFeishuTest(fetchFn as unknown as typeof fetch)
    expect(result).toMatchObject({ ok: true, message: '✅ 测试卡片已发送' })
  })

  it('degrades to a network error on fetch failure', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect(await postFeishuTest(vi.fn().mockRejectedValue(new Error('down')) as never)).toEqual({
        ok: false,
        error: '网络请求失败',
      })
    } finally {
      warn.mockRestore()
    }
  })
})

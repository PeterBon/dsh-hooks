import { describe, expect, it, vi } from 'vitest'
import {
  fetchHistory,
  fetchStatus,
  formatTime,
  outcomeLabel,
  outcomeTone,
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

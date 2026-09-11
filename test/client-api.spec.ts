import { describe, expect, it, vi } from 'vitest'
import {
  fetchFeishuStatus,
  fetchHistory,
  fetchStatus,
  filterHistory,
  formatTime,
  historyExportName,
  historyToJsonl,
  outcomeLabel,
  outcomeTone,
  postFeishuCancel,
  postFeishuConfig,
  postFeishuDisconnect,
  postFeishuSetup,
  postFeishuTest,
  postHooksSave,
  postNotifyTest,
  postTest,
  type HistoryRecord,
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

describe('hook editor / notify test / disconnect API', () => {
  it('sends a notify-channel test and returns the preview', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ ok: true, value: { message: '✅ 测试通知已发送', preview: '💬 新消息' } }),
    )
    const result = await postNotifyTest('webhook', 'https://x.test', true, fetchFn as unknown as typeof fetch)
    expect(result).toMatchObject({ ok: true, message: '✅ 测试通知已发送', preview: '💬 新消息' })
    const [, init] = fetchFn.mock.calls[0] as [string, { body: string }]
    expect(JSON.parse(init.body)).toEqual({ channel: 'webhook', url: 'https://x.test', slack: true })
  })

  it('omits empty url and slack=false from the notify test body', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ ok: true, value: {} }))
    await postNotifyTest('desktop', '', false, fetchFn as unknown as typeof fetch)
    const [, init] = fetchFn.mock.calls[0] as [string, { body: string }]
    expect(JSON.parse(init.body)).toEqual({ channel: 'desktop' })
  })

  it('saves hooks for a profile', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ ok: true, value: { hookCount: 3, patchFile: 'p.yml', backupPath: 'p.yml.bak', message: 'saved' } }),
    )
    const hooks = [{ on: 'turn/end', when: 'completed', run: 'node x.mjs' }]
    const result = await postHooksSave('work', hooks, fetchFn as unknown as typeof fetch)
    expect(result).toMatchObject({ ok: true, hookCount: 3, patchFile: 'p.yml' })
    const [, init] = fetchFn.mock.calls[0] as [string, { body: string }]
    expect(JSON.parse(init.body)).toEqual({ profile: 'work', hooks })
  })

  it('surfaces editor save errors', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ ok: false, error: { code: 'save-failed', message: 'hook #1：无效事件 nope' } }, false, 400),
    )
    const result = await postHooksSave('web', [{ on: 'nope', run: 'x' }], fetchFn as unknown as typeof fetch)
    expect(result).toEqual({ ok: false, error: 'hook #1：无效事件 nope' })
  })

  it('disconnects Feishu with hook removal', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ ok: true, value: { disconnected: true, existed: true, removedHooks: true, message: 'ok' } }),
    )
    const result = await postFeishuDisconnect('web', true, fetchFn as unknown as typeof fetch)
    expect(result).toMatchObject({ ok: true, disconnected: true, removedHooks: true })
    const [, init] = fetchFn.mock.calls[0] as [string, { body: string }]
    expect(JSON.parse(init.body)).toEqual({ profile: 'web', removeHooks: true })
  })
})

describe('postTest fields', () => {
  it('sends the numeric simulation fields', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ ok: true, value: { event: 'turn/end', fields: { runningSubagents: 2 }, executed: false, total: 0, matched: 0, lines: [] } }),
    )
    const result = await postTest(
      { event: 'turn/end', fields: { runningSubagents: 2 } },
      fetchFn as unknown as typeof fetch,
    )
    expect(result?.fields).toEqual({ runningSubagents: 2 })
    const [, init] = fetchFn.mock.calls[0] as [string, { body: string }]
    expect(JSON.parse(init.body)).toEqual({ event: 'turn/end', fields: { runningSubagents: 2 } })
  })
})

describe('filterHistory', () => {
  const records: HistoryRecord[] = [
    { ts: 1, kind: 'run', event: 'turn/end', command: 'a', outcome: 'exit-0', sessionId: 'sess-1', sessionName: '修复构建' },
    { ts: 2, kind: 'run', event: 'turn/end', command: 'b', outcome: 'exit-nonzero', sessionId: 'sess-2', sessionName: '发布 0.12.0' },
    { ts: 3, kind: 'notify', event: 'tool/call', command: 'notify:webhook', outcome: 'send-failed', sessionId: 'sess-1' },
  ]

  it('keeps everything without a filter', () => {
    expect(filterHistory(records, {})).toHaveLength(3)
    expect(filterHistory(records, { event: '', outcome: '', session: '  ' })).toHaveLength(3)
  })

  it('ANDs event, outcome and case-insensitive session matching', () => {
    expect(filterHistory(records, { event: 'turn/end' }).map((r) => r.command)).toEqual(['a', 'b'])
    expect(filterHistory(records, { outcome: 'send-failed' }).map((r) => r.command)).toEqual(['notify:webhook'])
    expect(filterHistory(records, { session: 'SESS-1' }).map((r) => r.command)).toEqual(['a', 'notify:webhook'])
    expect(filterHistory(records, { session: '发布' }).map((r) => r.command)).toEqual(['b'])
    expect(filterHistory(records, { event: 'turn/end', outcome: 'exit-0' }).map((r) => r.command)).toEqual(['a'])
    expect(filterHistory(records, { event: 'turn/end', session: 'sess-2' }).map((r) => r.command)).toEqual(['b'])
    expect(filterHistory(records, { event: 'step/end' })).toEqual([])
  })
})

describe('history export', () => {
  const records: HistoryRecord[] = [
    { ts: 1, kind: 'run', event: 'turn/end', command: 'a', outcome: 'exit-0' },
    { ts: 2, kind: 'notify', event: 'tool/call', command: 'notify:webhook', outcome: 'sent' },
  ]

  it('serializes JSONL that round-trips, with a trailing newline', () => {
    const text = historyToJsonl(records)
    expect(text.endsWith('\n')).toBe(true)
    const lines = text.trimEnd().split('\n')
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[1] as string)).toEqual(records[1])
  })

  it('serializes nothing for an empty view', () => {
    expect(historyToJsonl([])).toBe('')
  })

  it('stamps the download name with local time', () => {
    expect(historyExportName(new Date(2026, 8, 11, 9, 5, 7))).toBe('dsh-hooks-history-20260911-090507.jsonl')
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildBody,
  buildCard,
  eventPresentation,
  fmtTime,
  formatDuration,
  getToken,
  parseArgs,
  readEnv,
  run,
  sendCard,
  sendText,
  truncateText,
} from '../examples/notify-feishu.mjs'

afterEach(() => {
  vi.unstubAllGlobals()
})

function baseCtx(overrides = {}) {
  return {
    appId: 'cli_x',
    appSecret: 's',
    to: 'ou_1',
    event: 'turn/end',
    sessionId: 'sess-1',
    sessionName: '',
    cwd: 'D:\\work\\demo',
    turn: '3',
    reason: 'completed',
    tool: '',
    callId: '',
    durationMs: '65000',
    status: '',
    error: '',
    content: '',
    timestamp: '2026-08-13T00:00:00.000Z',
    ...overrides,
  }
}

describe('readEnv', () => {
  it('maps DSH_HOOK_* environment variables including cwd', () => {
    const ctx = readEnv({
      DSH_HOOKS_FEISHU_APP_ID: 'cli_x',
      DSH_HOOKS_FEISHU_APP_SECRET: 's',
      DSH_HOOKS_FEISHU_TO: 'ou_1',
      DSH_HOOK_EVENT: 'turn/end',
      DSH_HOOK_SESSION_ID: 'sess-1',
      DSH_HOOK_SESSION_NAME: '修复构建',
      DSH_HOOK_CWD: 'D:\\x',
      DSH_HOOK_REASON: 'completed',
      DSH_HOOK_CONTENT: '已修复',
    })
    expect(ctx).toMatchObject({
      appId: 'cli_x',
      to: 'ou_1',
      event: 'turn/end',
      sessionId: 'sess-1',
      sessionName: '修复构建',
      cwd: 'D:\\x',
      content: '已修复',
    })
  })

  it('defaults missing fields to empty strings', () => {
    const ctx = readEnv({})
    expect(ctx.event).toBe('')
    expect(ctx.cwd).toBe('')
  })
})

describe('truncateText', () => {
  it('normalizes newlines and collapses blank lines', () => {
    expect(truncateText('a\r\nb\t \n\n\n\nc  ', 100)).toBe('a\nb\n\nc')
  })

  it('returns null for blank input', () => {
    expect(truncateText('   \n  ', 10)).toBeNull()
  })

  it('cuts at a line boundary near the limit with ellipsis', () => {
    const text = 'line one\nline two\nline three'
    const out = truncateText(text, 15)
    expect(out).toBe('line one…')
  })

  it('keeps short text untouched', () => {
    expect(truncateText('short text', 50)).toBe('short text')
  })
})

describe('fmtTime / formatDuration', () => {
  it('formats timestamps in 2026/8/13 00:28:12 style', () => {
    expect(fmtTime(new Date(2026, 7, 13, 0, 28, 12))).toBe('2026/8/13 00:28:12')
  })

  it('formats durations like feishu-notify', () => {
    expect(formatDuration(500)).toBe('1 秒')
    expect(formatDuration(65000)).toBe('1 分 5 秒')
    expect(formatDuration(120000)).toBe('2 分钟')
  })
})

describe('eventPresentation', () => {
  it('maps completed turns to a green success card', () => {
    expect(eventPresentation(baseCtx())).toEqual({ header: 'green', title: '✅ 任务已完成' })
  })

  it('maps error turns to a red failure card', () => {
    expect(eventPresentation(baseCtx({ reason: 'error' }))).toEqual({ header: 'red', title: '❌ 任务失败' })
  })

  it('maps aborted/interrupted/blocked to an orange pause card', () => {
    for (const reason of ['aborted', 'interrupted', 'blocked']) {
      expect(eventPresentation(baseCtx({ reason })).header).toBe('orange')
    }
  })

  it('maps approval to an orange card', () => {
    expect(eventPresentation(baseCtx({ event: 'approval/asked', reason: '' }))).toEqual({
      header: 'orange',
      title: '⏳ 需要审批',
    })
  })

  it('maps agent/error and agent/status', () => {
    expect(eventPresentation(baseCtx({ event: 'agent/error', reason: '' })).header).toBe('red')
    expect(eventPresentation(baseCtx({ event: 'agent/status', reason: '' })).header).toBe('blue')
  })
})

describe('buildBody', () => {
  it('shows the turn content directly on turn/end', () => {
    const body = buildBody(baseCtx({ content: '构建通过，测试 71/71 全绿。' }))
    expect(body).toBe('构建通过，测试 71/71 全绿。')
  })

  it('omits result/duration/turn meta lines from turn/end cards', () => {
    const body = buildBody(baseCtx({ content: '正文', durationMs: '65000' }))
    expect(body).toBe('正文')
    expect(body).not.toContain('完成')
    expect(body).not.toContain('1 分 5 秒')
    expect(body).not.toContain('#3')
  })

  it('truncates long turn content', () => {
    const body = buildBody(baseCtx({ content: 'x'.repeat(2000) }))
    expect(body).not.toContain('x'.repeat(2000))
    expect(body.endsWith('…')).toBe(true)
  })

  it('shows the error detail on error turns', () => {
    const body = buildBody(baseCtx({ reason: 'error', error: 'upstream timeout' }))
    expect(body).toBe('详情：upstream timeout')
  })

  it('prepends the error detail before the content on error turns', () => {
    const body = buildBody(baseCtx({ reason: 'error', error: 'boom', content: 'partial work' }))
    expect(body).toBe('详情：boom\npartial work')
  })

  it('builds an approval body with tool and truncated reason', () => {
    const body = buildBody(baseCtx({ event: 'approval/asked', reason: 'x'.repeat(300), tool: 'ssh_exec' }))
    expect(body).toContain('ssh_exec')
    expect(body).not.toContain('x'.repeat(300))
  })

  it('builds an error body with truncated detail', () => {
    const body = buildBody(baseCtx({ event: 'agent/error', error: 'y'.repeat(500), reason: '' }))
    expect(body).toContain('Agent 循环报告了错误')
    expect(body).not.toContain('y'.repeat(500))
  })
})

describe('buildCard', () => {
  it('renders the information-list layout with meta lines and hr', () => {
    const card = buildCard(baseCtx(), {
      header: 'green',
      title: '✅ 任务已完成',
      body: '结果：完成',
      now: new Date(2026, 7, 13, 0, 28, 12),
    })
    expect(card.config).toEqual({ wide_screen_mode: true })
    expect(card.header).toEqual({ template: 'green', title: { tag: 'plain_text', content: '✅ 任务已完成' } })
    const [meta, hr, bodyEl] = card.elements
    expect(meta.text.content).toContain('🕐 2026/8/13 00:28:12')
    expect(meta.text.content).toContain('📁 D:\\work\\demo')
    expect(meta.text.content).toContain('🗒 会话 sess-1')
    expect(hr.tag).toBe('hr')
    expect(bodyEl.text.content).toBe('结果：完成')
  })

  it('shows the readable session name instead of the raw id', () => {
    const card = buildCard(baseCtx({ sessionName: '修复飞书卡片' }), { header: 'green', title: 't' })
    expect(card.elements[0].text.content).toContain('🗒 会话 修复飞书卡片')
    expect(card.elements[0].text.content).not.toContain('sess-1')
  })

  it('omits the session line entirely when neither name nor id exists', () => {
    const card = buildCard(baseCtx({ sessionId: '', sessionName: '' }), { header: 'blue', title: 't' })
    expect(card.elements[0].text.content).not.toContain('🗒 会话')
  })

  it('omits hr/body when there is no body', () => {
    const card = buildCard(baseCtx(), { header: 'blue', title: 't', body: '' })
    expect(card.elements).toHaveLength(1)
  })
})

describe('getToken / sendCard / sendText', () => {
  it('getToken posts credentials and caches the token', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ code: 0, msg: 'ok', tenant_access_token: 'tok-1', expire: 7200 }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    expect(await getToken('cli_x', 's', 0)).toBe('tok-1')
    expect(await getToken('cli_x', 's', 1000)).toBe('tok-1') // cached
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('tenant_access_token')
    expect(JSON.parse(init.body)).toEqual({ app_id: 'cli_x', app_secret: 's' })
  })

  it('getToken throws with a Chinese hint on API error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ code: 99991663, msg: 'denied' }), { status: 200 })))
    await expect(getToken('bad', 's')).rejects.toThrow('im:message:send_as_bot')
  })

  it('getToken caches per app and refetches for a different appId', async () => {
    const fetchMock = vi.fn(async (url, init) => {
      const body = JSON.parse(String(init.body))
      return new Response(
        JSON.stringify({ code: 0, msg: 'ok', tenant_access_token: `tok-${body.app_id}`, expire: 7200 }),
        { status: 200 },
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    expect(await getToken('cli_a', 's', 0)).toBe('tok-cli_a')
    expect(await getToken('cli_a', 's', 1000)).toBe('tok-cli_a') // cached
    expect(await getToken('cli_b', 's', 1000)).toBe('tok-cli_b') // different app
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('getToken surfaces HTTP failures instead of JSON parse errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Bad Gateway</html>', { status: 502 })))
    await expect(getToken('cli_x', 's')).rejects.toThrow('HTTP 502')
  })

  it('sendCard posts an interactive card with bearer auth', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ code: 0, msg: 'success' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await sendCard('tok', 'ou_9', { config: {}, header: {}, elements: [] })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/im/v1/messages')
    expect(init.headers.authorization).toBe('Bearer tok')
    const body = JSON.parse(init.body)
    expect(body.msg_type).toBe('interactive')
    expect(JSON.parse(body.content)).toEqual({ config: {}, header: {}, elements: [] })
  })

  it('sendText posts a plain text message', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ code: 0, msg: 'success' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await sendText('tok', 'ou_9', '你好')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.msg_type).toBe('text')
    expect(JSON.parse(body.content)).toEqual({ text: '你好' })
  })

  it('sendCard surfaces HTTP errors with the API message when available', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ code: 1, msg: 'rate limited' }), { status: 429 })))
    await expect(sendCard('tok', 'ou_9', {})).rejects.toThrow('HTTP 429')
    await expect(sendCard('tok', 'ou_9', {})).rejects.toThrow('rate limited')
  })

  it('sendCard fails clearly on a non-JSON 2xx body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('oops', { status: 200 })))
    await expect(sendCard('tok', 'ou_9', {})).rejects.toThrow('无法解析')
  })

  it('sendCard translates network failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    }))
    await expect(sendCard('tok', 'ou_9', {})).rejects.toThrow('请求失败')
  })
})

describe('parseArgs / run', () => {
  // Explicit non-existent config path: tests must never read the real
  // ~/.dsh/dsh-hooks/feishu-config.json on the developer machine.
  const noConfig = 'Z:\\does\\not\\exist\\feishu-config.json'

  it('parses flags and positional body', () => {
    const opts = parseArgs(['--header', 'red', '--title', 'T', '--note', 'N', '-q', 'body text'])
    expect(opts).toMatchObject({ header: 'red', title: 'T', note: 'N', quiet: true, body: 'body text' })
  })

  it('run rejects missing credentials and invalid headers', async () => {
    await expect(run({ event: 'turn/end' }, [], noConfig)).rejects.toThrow('DSH_HOOKS_FEISHU_APP_ID')
    await expect(run(baseCtx(), ['--header', 'neon'], noConfig)).rejects.toThrow('无效的卡片配色')
  })

  it('run sends a card for the default pipeline', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (String(url).includes('tenant_access_token')) {
        return new Response(JSON.stringify({ code: 0, msg: 'ok', tenant_access_token: 'tok', expire: 7200 }), { status: 200 })
      }
      return new Response(JSON.stringify({ code: 0, msg: 'success' }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await run(baseCtx(), [], noConfig)
    expect(result.kind).toBe('card')
    expect(result.card.header.title.content).toBe('✅ 任务已完成')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('run sends plain text with --text', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (String(url).includes('tenant_access_token')) {
        return new Response(JSON.stringify({ code: 0, msg: 'ok', tenant_access_token: 'tok', expire: 7200 }), { status: 200 })
      }
      return new Response(JSON.stringify({ code: 0, msg: 'success' }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await run(baseCtx(), ['--text', '自定义正文'], noConfig)
    expect(result.kind).toBe('text')
    expect(result.text).toBe('自定义正文')
  })
})

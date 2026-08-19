import type { IncomingMessage, ServerResponse } from 'node:http'
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHistorySink } from '../src/history.js'
import { createHookHandler } from '../src/server.js'
import type { HookSpec } from '../src/config.js'
import type { FeishuSetupManager } from '../src/feishu-session.js'
import { FEISHU_SETUP_BUSY } from '../src/feishu-session.js'

function fakeReq(overrides: Record<string, unknown> = {}): IncomingMessage {
  const req = {
    method: 'GET',
    url: '/dsh-hooks/status',
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
    [Symbol.asyncIterator]: async function* () {},
  }
  return Object.assign(req, overrides) as unknown as IncomingMessage
}

function bodyReq(url: string, body: unknown, headers: Record<string, string> = { 'content-type': 'application/json' }): IncomingMessage {
  const text = JSON.stringify(body)
  return fakeReq({
    method: 'POST',
    url,
    headers,
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from(text)
    },
  })
}

interface FakeRes {
  statusCode: number
  body: string
  writeHead: (status: number, headers?: Record<string, string | number>) => void
  end: (data?: string) => void
}

function fakeRes() {
  const res: FakeRes = {
    statusCode: 0,
    body: '',
    writeHead(status: number) {
      res.statusCode = status
    },
    end(data?: string) {
      res.body = typeof data === 'string' ? data : ''
    },
  }
  return res as unknown as ServerResponse
}

function readJson(res: ServerResponse): { statusCode: number; body: unknown } {
  const raw = res as unknown as FakeRes
  return { statusCode: raw.statusCode, body: JSON.parse(raw.body) }
}

const hooks = [
  { on: 'turn/end', when: 'completed', run: 'echo hi' },
  { on: 'tool/call', run: 'echo x' },
] as HookSpec[]

describe('createHookHandler', () => {
  it('serves /dsh-hooks/status', async () => {
    const history = createHistorySink({ enabled: false })
    history.record({ kind: 'run', event: 'turn/end', command: 'x', outcome: 'exit-0' })
    const handler = createHookHandler({ hooks, history, version: '9.9.9' })
    const res = fakeRes()
    await handler(fakeReq(), res)
    const { statusCode, body } = readJson(res)
    expect(statusCode).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      value: { name: 'dsh-hooks', version: '9.9.9', hookCount: 2, historyCount: 1 },
    })
  })

  it('serves the newest N history records', async () => {
    const history = createHistorySink({ enabled: false })
    for (let i = 0; i < 5; i++) {
      history.record({ kind: 'run', event: `event-${i}`, command: 'x', outcome: 'exit-0' })
    }
    const handler = createHookHandler({ hooks, history })
    const res = fakeRes()
    await handler(fakeReq({ url: '/dsh-hooks/history?n=2' }), res)
    const { body } = readJson(res)
    const value = (body as { value: { event: string }[] }).value
    expect(value.map((r) => r.event)).toEqual(['event-3', 'event-4'])
  })

  it('evaluates a simulated event on POST /dsh-hooks/test', async () => {
    const history = createHistorySink({ enabled: false })
    const handler = createHookHandler({ hooks, history })
    const res = fakeRes()
    await handler(bodyReq('/dsh-hooks/test', { event: 'turn/end', reason: 'completed' }), res)
    const { statusCode, body } = readJson(res)
    expect(statusCode).toBe(200)
    const value = (body as { value: { matched: number; total: number; lines: { matched: boolean }[] } }).value
    expect(value).toMatchObject({ matched: 1, total: 2 })
    expect(value.lines.map((l) => l.matched)).toEqual([true, false])
  })

  it('rejects non-loopback clients', async () => {
    const handler = createHookHandler({ hooks, history: createHistorySink({ enabled: false }) })
    const res = fakeRes()
    await handler(fakeReq({ socket: { remoteAddress: '192.168.1.5' } }), res)
    expect(readJson(res).statusCode).toBe(403)
  })

  it('requires application/json on POSTs', async () => {
    const handler = createHookHandler({ hooks, history: createHistorySink({ enabled: false }) })
    const res = fakeRes()
    await handler(bodyReq('/dsh-hooks/test', { event: 'turn/end' }, { 'content-type': 'text/plain' }), res)
    expect(readJson(res).statusCode).toBe(415)
  })

  it('rejects malformed test bodies', async () => {
    const handler = createHookHandler({ hooks, history: createHistorySink({ enabled: false }) })
    const res = fakeRes()
    await handler(bodyReq('/dsh-hooks/test', { reason: 'completed' }), res)
    expect(readJson(res).statusCode).toBe(400)
  })

  it('404s unknown routes', async () => {
    const handler = createHookHandler({ hooks, history: createHistorySink({ enabled: false }) })
    const res = fakeRes()
    await handler(fakeReq({ url: '/dsh-hooks/nope' }), res)
    expect(readJson(res).statusCode).toBe(404)
  })
})

describe('Feishu routes', () => {
  let tmp: string
  let configPath: string

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'dsh-hooks-server-'))
    configPath = join(tmp, 'feishu-config.json')
  })

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  function fakeManager(overrides: Partial<FeishuSetupManager> = {}): FeishuSetupManager {
    return {
      start: vi.fn(async () => ({ status: 'pending', startedAt: 1 })),
      status: vi.fn(() => null),
      cancel: vi.fn(() => false),
      dispose: vi.fn(() => {}),
      ...overrides,
    } as unknown as FeishuSetupManager
  }

  it('summarizes the Feishu connection (masked) on /feishu/status', async () => {
    writeFileSync(
      configPath,
      JSON.stringify({
        app_id: 'cli_a1b2c3d4e5f6g7h8',
        app_secret: 'super-secret',
        target_type: 'open_id',
        target_id: 'ou_x1y2z3w4v5u6t7s8',
      }),
      'utf8',
    )
    const manager = fakeManager({ status: () => ({ status: 'succeeded', startedAt: 1, appId: 'cli_a1b2c3d4e5f6g7h8' }) })
    const handler = createHookHandler({ hooks, history: createHistorySink({ enabled: false }), feishu: { manager, configPath } })
    const res = fakeRes()
    await handler(fakeReq({ url: '/dsh-hooks/feishu/status' }), res)
    const { statusCode, body } = readJson(res)
    expect(statusCode).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      value: {
        configured: true,
        appId: 'cli_a1b2…g7h8',
        targetKind: 'open_id',
        target: 'ou_x1y2z…t7s8',
        setup: { status: 'succeeded', appId: 'cli_a1b2c3d4e5f6g7h8' },
      },
    })
    // The secret must never leave the server.
    expect(JSON.stringify(body)).not.toContain('super-secret')
  })

  it('reports not configured when no credential file exists', async () => {
    const manager = fakeManager()
    const handler = createHookHandler({ hooks, history: createHistorySink({ enabled: false }), feishu: { manager, configPath } })
    const res = fakeRes()
    await handler(fakeReq({ url: '/dsh-hooks/feishu/status' }), res)
    expect(readJson(res).body).toMatchObject({
      ok: true,
      value: { configured: false, appId: null, targetKind: null, target: null, setup: null, resultMaxChars: 300 },
    })
  })

  it('exposes the stored truncation length on /feishu/status', async () => {
    writeFileSync(
      configPath,
      JSON.stringify({ app_id: 'cli_x', app_secret: 's', target_type: 'open_id', target_id: 'ou_x', result_max_chars: 500 }),
      'utf8',
    )
    const handler = createHookHandler({ hooks, history: createHistorySink({ enabled: false }), feishu: { manager: fakeManager(), configPath } })
    const res = fakeRes()
    await handler(fakeReq({ url: '/dsh-hooks/feishu/status' }), res)
    expect(readJson(res).body).toMatchObject({ ok: true, value: { configured: true, resultMaxChars: 500 } })
  })

  it('passes the truncation length to the scan session', async () => {
    const manager = fakeManager()
    const handler = createHookHandler({ hooks, history: createHistorySink({ enabled: false }), feishu: { manager, configPath } })
    await handler(bodyReq('/dsh-hooks/feishu/setup', { profile: 'web', resultMaxChars: 800 }), fakeRes())
    expect(manager.start).toHaveBeenCalledWith('web', { resultMaxChars: 800 })
  })

  it('updates the truncation length on POST /feishu/config', async () => {
    writeFileSync(
      configPath,
      JSON.stringify({ app_id: 'cli_x', app_secret: 's', target_type: 'open_id', target_id: 'ou_x', result_max_chars: 300 }),
      'utf8',
    )
    const handler = createHookHandler({ hooks, history: createHistorySink({ enabled: false }), feishu: { manager: fakeManager(), configPath } })
    const res = fakeRes()
    await handler(bodyReq('/dsh-hooks/feishu/config', { resultMaxChars: 1200 }), res)
    const { statusCode, body } = readJson(res)
    expect(statusCode).toBe(200)
    expect(body).toMatchObject({ ok: true, value: { resultMaxChars: 1200 } })
    const saved = JSON.parse(readFileSync(configPath, 'utf8'))
    expect(saved).toMatchObject({ app_id: 'cli_x', result_max_chars: 1200 })
  })

  it('rejects invalid truncation updates', async () => {
    const handler = createHookHandler({ hooks, history: createHistorySink({ enabled: false }), feishu: { manager: fakeManager(), configPath } })
    const res = fakeRes()
    await handler(bodyReq('/dsh-hooks/feishu/config', { resultMaxChars: 'wide' }), res)
    expect(readJson(res).statusCode).toBe(400)
    const res2 = fakeRes()
    await handler(bodyReq('/dsh-hooks/feishu/config', { resultMaxChars: 10 }), res2)
    const { statusCode, body } = readJson(res2)
    expect(statusCode).toBe(400)
    expect(body).toMatchObject({ ok: false, error: { code: 'bad-request' } })
  })

  it('starts a scan session on POST /feishu/setup (default profile web)', async () => {
    const manager = fakeManager({
      start: vi.fn(async () => ({ status: 'pending', startedAt: 5, qrUrl: 'https://x', expiresAtMs: 5000 })),
    })
    const handler = createHookHandler({ hooks, history: createHistorySink({ enabled: false }), feishu: { manager, configPath } })
    const res = fakeRes()
    await handler(bodyReq('/dsh-hooks/feishu/setup', {}), res)
    const { statusCode, body } = readJson(res)
    expect(statusCode).toBe(200)
    expect(body).toMatchObject({ ok: true, value: { setup: { status: 'pending', qrUrl: 'https://x' } } })
    expect(manager.start).toHaveBeenCalledWith('web')
  })

  it('passes the requested profile through', async () => {
    const manager = fakeManager()
    const handler = createHookHandler({ hooks, history: createHistorySink({ enabled: false }), feishu: { manager, configPath } })
    await handler(bodyReq('/dsh-hooks/feishu/setup', { profile: 'work' }), fakeRes())
    expect(manager.start).toHaveBeenCalledWith('work')
  })

  it('conflicts with 409 while a scan session is pending', async () => {
    const manager = fakeManager({
      start: vi.fn(async () => {
        throw new Error(FEISHU_SETUP_BUSY)
      }),
    })
    const handler = createHookHandler({ hooks, history: createHistorySink({ enabled: false }), feishu: { manager, configPath } })
    const res = fakeRes()
    await handler(bodyReq('/dsh-hooks/feishu/setup', { profile: 'web' }), res)
    const { statusCode, body } = readJson(res)
    expect(statusCode).toBe(409)
    expect(body).toMatchObject({ ok: false, error: { code: 'pending' } })
  })

  it('cancels a pending scan session', async () => {
    const manager = fakeManager({ cancel: () => true })
    const handler = createHookHandler({ hooks, history: createHistorySink({ enabled: false }), feishu: { manager, configPath } })
    const res = fakeRes()
    await handler(bodyReq('/dsh-hooks/feishu/cancel', {}), res)
    expect(readJson(res).body).toMatchObject({ ok: true, value: { cancelled: true } })
  })

  it('sends a test card on POST /feishu/test', async () => {
    const runTest = vi.fn(async () => '✅ 测试卡片已发送')
    const manager = fakeManager()
    const handler = createHookHandler({ hooks, history: createHistorySink({ enabled: false }), feishu: { manager, configPath, runTest } })
    const res = fakeRes()
    await handler(bodyReq('/dsh-hooks/feishu/test', {}), res)
    expect(readJson(res).body).toMatchObject({ ok: true, value: { message: '✅ 测试卡片已发送' } })
  })

  it('surfaces test-card failures', async () => {
    const runTest = vi.fn(async () => {
      throw new Error('配置文件不完整')
    })
    const manager = fakeManager()
    const handler = createHookHandler({ hooks, history: createHistorySink({ enabled: false }), feishu: { manager, configPath, runTest } })
    const res = fakeRes()
    await handler(bodyReq('/dsh-hooks/feishu/test', {}), res)
    const { statusCode, body } = readJson(res)
    expect(statusCode).toBe(500)
    expect(body).toMatchObject({ ok: false, error: { code: 'send-failed', message: '配置文件不完整' } })
  })

  it('requires application/json on feishu POSTs', async () => {
    const manager = fakeManager()
    const handler = createHookHandler({ hooks, history: createHistorySink({ enabled: false }), feishu: { manager, configPath } })
    const res = fakeRes()
    await handler(bodyReq('/dsh-hooks/feishu/setup', {}, { 'content-type': 'text/plain' }), res)
    expect(readJson(res).statusCode).toBe(415)
    expect(manager.start).not.toHaveBeenCalled()
  })

  it('does not expose feishu routes without the feishu deps', async () => {
    const handler = createHookHandler({ hooks, history: createHistorySink({ enabled: false }) })
    const res = fakeRes()
    await handler(fakeReq({ url: '/dsh-hooks/feishu/status' }), res)
    expect(readJson(res).statusCode).toBe(404)
  })
})

describe('history disk sync on routes', () => {
  let tmp: string

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'dsh-hooks-server-'))
  })

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  const diskLine = (event: string, ts: number) =>
    JSON.stringify({ kind: 'run', event, command: 'x', sessionId: 's', outcome: 'exit-0', ts }) + '\n'

  it('counts disk-seeded records in /dsh-hooks/status', async () => {
    const file = join(tmp, 'history.jsonl')
    writeFileSync(file, diskLine('turn/end', 1) + diskLine('turn/end', 2), 'utf8')
    const history = createHistorySink({ path: file })
    const handler = createHookHandler({ hooks, history })
    const res = fakeRes()
    await handler(fakeReq({ url: '/dsh-hooks/status' }), res)
    expect(readJson(res).body).toMatchObject({ ok: true, value: { historyCount: 2 } })
  })

  it('serves records appended to disk by another process', async () => {
    const file = join(tmp, 'history.jsonl')
    writeFileSync(file, diskLine('turn/end', 1), 'utf8')
    const history = createHistorySink({ path: file })
    const handler = createHookHandler({ hooks, history })
    // Another process appends after the sink was created.
    appendFileSync(file, diskLine('tool/call', 2), 'utf8')
    const res = fakeRes()
    await handler(fakeReq({ url: '/dsh-hooks/history?n=10' }), res)
    const { body } = readJson(res)
    const value = (body as { value: { event: string }[] }).value
    expect(value.map((r) => r.event)).toEqual(['turn/end', 'tool/call'])
  })
})

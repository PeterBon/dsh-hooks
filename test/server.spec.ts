import type { IncomingMessage, ServerResponse } from 'node:http'
import { describe, expect, it } from 'vitest'
import { createHistorySink } from '../src/history.js'
import { createHookHandler } from '../src/server.js'
import type { HookSpec } from '../src/config.js'

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

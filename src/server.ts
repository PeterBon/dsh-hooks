/**
 * /dsh-hooks/* HTTP routes for the web profile: status, execution history,
 * a dry-run-style test trigger, and the Feishu connect flow (QR setup /
 * cancel / test card). Registered only when the shared webserver service
 * exists (web profile) — CLI/headless environments never see them.
 * Loopback-only with JSON envelopes; POSTs require an explicit
 * application/json content-type (CSRF hardening, same posture as
 * dsh-aionui-panel).
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createRequire } from 'node:module'
import type { HookSpec } from './config.js'
import type { HistorySink } from './history.js'
import { describeHook, evaluateHooks, mockContext } from './dry-run.js'
import { createHookRunner } from './runner.js'
import { fireNotify } from './notify.js'
import { FEISHU_SETUP_BUSY, type FeishuSetupManager } from './feishu-session.js'
import { readFeishuSummary, runFeishuTest, updateFeishuResultMaxChars } from './feishu.js'

/** Minimal structural shape of the shared web server (dsh-host-webserver). */
export interface WebServerLike {
  register(spec: {
    kind: 'prefix' | 'exact'
    path: string
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
  }): () => void
}

/** Plugin version, read from package.json (this package ships its own). */
export function pluginVersion(): string {
  const require = createRequire(import.meta.url)
  try {
    const pkg = require('../package.json') as { version?: unknown }
    return typeof pkg.version === 'string' ? pkg.version : 'unknown'
  } catch {
    return 'unknown'
  }
}

interface Envelope<T> {
  ok: boolean
  value?: T
  error?: { code: string; message: string }
}

const OK = <T>(value: T): Envelope<T> => ({ ok: true, value })
const FAIL = (code: string, message: string): Envelope<never> => ({ ok: false, error: { code, message } })

function json(res: ServerResponse, envelope: Envelope<unknown>, status = 200): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(envelope))
}

/** Loopback fence: never let a LAN client reach /dsh-hooks operations. */
export function isLoopbackRequest(req: IncomingMessage): boolean {
  const address = req.socket.remoteAddress ?? ''
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    chunks.push(buffer)
    total += buffer.length
    if (total > 1 << 20) return null
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (text === '') return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

export interface FeishuRouteDeps {
  /** QR-scan session manager (one in-flight flow at a time). */
  manager: FeishuSetupManager
  /** Test-card sender, injectable for tests. */
  runTest?: typeof runFeishuTest
  /** Credential file the status route summarizes. */
  configPath?: string
}

export interface HookRoutesOptions {
  hooks: readonly HookSpec[]
  history: HistorySink
  version?: string
  feishu?: FeishuRouteDeps
}

/** Create the /dsh-hooks route handler (exported for tests). */
export function createHookHandler(options: HookRoutesOptions) {
  const { hooks, history } = options
  const version = options.version ?? pluginVersion()
  const feishu = options.feishu
  const runFeishuTestCard = feishu?.runTest ?? runFeishuTest
  const feishuConfigPath = feishu?.configPath

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (!isLoopbackRequest(req)) {
      json(res, FAIL('forbidden', 'loopback-only'), 403)
      return
    }
    const url = new URL(req.url ?? '/', 'http://x')
    const pathname = url.pathname

    if (req.method === 'GET' && pathname === '/dsh-hooks/status') {
      // Pull in disk records (pre-restart and other-process appends) so the
      // badge reflects the durable log, not just this process's memory.
      history.sync()
      json(res, OK({ name: 'dsh-hooks', version, hookCount: hooks.length, historyCount: history.recent().length }))
      return
    }
    if (req.method === 'GET' && pathname === '/dsh-hooks/history') {
      const raw = url.searchParams.get('n')
      const parsed = raw === null ? 50 : Number(raw)
      const n = Number.isFinite(parsed) && parsed > 0 ? Math.min(500, Math.floor(parsed)) : 50
      history.sync()
      const records = history.recent()
      json(res, OK(records.slice(Math.max(0, records.length - n))))
      return
    }
    if (req.method === 'POST' && pathname === '/dsh-hooks/test') {
      const contentType = req.headers['content-type'] ?? ''
      if (!contentType.toLowerCase().startsWith('application/json')) {
        json(res, FAIL('bad-request', 'POST 需要 application/json'), 415)
        return
      }
      const payload = await readJsonBody(req)
      if (typeof payload !== 'object' || payload === null) {
        json(res, FAIL('bad-request', 'malformed JSON body'), 400)
        return
      }
      const body = payload as Record<string, unknown>
      const event = typeof body.event === 'string' && body.event !== '' ? body.event : null
      if (event === null) {
        json(res, FAIL('bad-request', '缺少 event 字段'), 400)
        return
      }
      const reason = typeof body.reason === 'string' && body.reason !== '' ? body.reason : undefined
      const ctx = mockContext(event, {
        reason,
        tool: typeof body.tool === 'string' ? body.tool : undefined,
        sessionName: typeof body.sessionName === 'string' ? body.sessionName : undefined,
      })
      const lines = evaluateHooks(hooks, event, ctx, reason as never)
      const matchedHooks = lines.filter((line) => line.matched)

      const execute = body.execute === true
      if (execute) {
        const runner = createHookRunner()
        for (const line of matchedHooks) {
          const hook = hooks[line.index - 1]
          if (hook.run) runner.run(hook, ctx)
          else if (hook.notify) void fireNotify(hook.notify, ctx)
        }
      }

      json(
        res,
        OK({
          event,
          reason,
          executed: execute,
          total: hooks.length,
          matched: matchedHooks.length,
          lines: lines.map((line) => ({
            index: line.index,
            matched: line.matched,
            why: line.why,
            summary: line.summary,
            action: line.matched ? describeHook(hooks[line.index - 1]) : undefined,
          })),
        }),
      )
      return
    }
    if (feishu !== undefined && req.method === 'GET' && pathname === '/dsh-hooks/feishu/status') {
      const summary = readFeishuSummary(feishuConfigPath)
      json(res, OK({ ...summary, setup: feishu.manager.status() }))
      return
    }
    if (feishu !== undefined && req.method === 'POST' && pathname === '/dsh-hooks/feishu/setup') {
      const contentType = req.headers['content-type'] ?? ''
      if (!contentType.toLowerCase().startsWith('application/json')) {
        json(res, FAIL('bad-request', 'POST 需要 application/json'), 415)
        return
      }
      const payload = await readJsonBody(req)
      if (typeof payload !== 'object' || payload === null) {
        json(res, FAIL('bad-request', 'malformed JSON body'), 400)
        return
      }
      const body = payload as Record<string, unknown>
      const profile = typeof body.profile === 'string' && body.profile.trim() !== '' ? body.profile.trim() : 'web'
      const resultMaxChars = typeof body.resultMaxChars === 'number' && Number.isFinite(body.resultMaxChars)
        ? body.resultMaxChars
        : undefined
      try {
        const setup = resultMaxChars === undefined
          ? await feishu.manager.start(profile)
          : await feishu.manager.start(profile, { resultMaxChars })
        json(res, OK({ setup }))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        json(res, FAIL('pending', message), message === FEISHU_SETUP_BUSY ? 409 : 500)
      }
      return
    }
    if (feishu !== undefined && req.method === 'POST' && pathname === '/dsh-hooks/feishu/config') {
      const contentType = req.headers['content-type'] ?? ''
      if (!contentType.toLowerCase().startsWith('application/json')) {
        json(res, FAIL('bad-request', 'POST 需要 application/json'), 415)
        return
      }
      const payload = await readJsonBody(req)
      if (typeof payload !== 'object' || payload === null) {
        json(res, FAIL('bad-request', 'malformed JSON body'), 400)
        return
      }
      const value = (payload as Record<string, unknown>).resultMaxChars
      if (typeof value !== 'number') {
        json(res, FAIL('bad-request', '缺少数字字段 resultMaxChars'), 400)
        return
      }
      try {
        const resultMaxChars = updateFeishuResultMaxChars(feishuConfigPath, value)
        json(res, OK({ resultMaxChars }))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        json(res, FAIL('bad-request', message), 400)
      }
      return
    }
    if (feishu !== undefined && req.method === 'POST' && pathname === '/dsh-hooks/feishu/cancel') {
      const contentType = req.headers['content-type'] ?? ''
      if (!contentType.toLowerCase().startsWith('application/json')) {
        json(res, FAIL('bad-request', 'POST 需要 application/json'), 415)
        return
      }
      json(res, OK({ cancelled: feishu.manager.cancel() }))
      return
    }
    if (feishu !== undefined && req.method === 'POST' && pathname === '/dsh-hooks/feishu/test') {
      const contentType = req.headers['content-type'] ?? ''
      if (!contentType.toLowerCase().startsWith('application/json')) {
        json(res, FAIL('bad-request', 'POST 需要 application/json'), 415)
        return
      }
      try {
        const message = await runFeishuTestCard()
        json(res, OK({ message }))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        json(res, FAIL('send-failed', message), 500)
      }
      return
    }
    json(res, FAIL('not-found', `unknown route ${pathname}`), 404)
  }
}

/** Register the /dsh-hooks prefix route on the shared web server. */
export function registerHookRoutes(webServer: WebServerLike, options: HookRoutesOptions): () => void {
  return webServer.register({ kind: 'prefix', path: '/dsh-hooks', handler: createHookHandler(options) })
}

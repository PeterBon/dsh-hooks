import { spawn, type ChildProcess } from 'node:child_process'
import type { HookContext } from './context.js'
import { eventLabel, renderTemplate, toEnv } from './context.js'
import type { HookSpec } from './config.js'
import type { HookRunRecord } from './history.js'

export interface RunOutcome {
  ok: boolean
  reason: 'ran' | 'timeout' | 'spawn-failed' | 'skipped'
  detail?: string
}

/** Track in-flight hook runs so a missing parent never outlives teardown. */
export interface HookRunner {
  run(spec: HookSpec, ctx: HookContext, recordOverride?: RunRecord, limiter?: RunLimiter): RunOutcome
  /** Live counters for the web-panel diagnostics. */
  stats(): HookRunnerStats
  dispose(): void
}

export interface HookRunnerStats {
  /** Spawned children still running (waiting for their exit). */
  inFlight: number
  /** Retry timers scheduled in the background. */
  pendingRetries: number
}

export type RunRecord = (record: Omit<HookRunRecord, 'ts'>) => void

/**
 * Per-hook concurrency gate: runs carrying the same `id` share one cap.
 * Accepted runs occupy a slot until the logical run reaches a terminal
 * outcome (retries keep the slot), so a retrying hook still counts.
 */
export interface RunLimiter {
  id: string
  max: number
}

export const DEFAULT_TIMEOUT_MS = 10000
export const DEFAULT_RETRY_DELAY_MS = 500

/**
 * Per-stream capture cap. The hook's stdout/stderr is only kept for
 * failure diagnostics, so anything past 64 KiB is drained and dropped
 * (reading must never stop — a stopped reader would fill the pipe buffer
 * and wedge the hook process).
 */
const MAX_CAPTURE_BYTES = 64 * 1024

/**
 * Terminate a spawned hook process. With `shell: true` on Windows the direct
 * child is cmd.exe — killing only the shell orphans the actual hook command
 * (e.g. `node notify-feishu.mjs`), so kill the whole tree first. The direct
 * kill stays as the fallback (and the only path off Windows).
 */
export function terminate(child: ChildProcess): void {
  if (process.platform === 'win32' && child.pid !== undefined) {
    try {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' }).unref()
    } catch {
      // taskkill unavailable — fall through to the direct kill below.
    }
  }
  child.kill()
}

/**
 * Resolve the spawn working directory for a hook: `cwd: 'session'` runs in
 * the session's cwd (falling back to the plugin process when unknown); any
 * other configured value is used verbatim (documented as an absolute path).
 */
function resolveCwd(spec: HookSpec, ctx: HookContext): string | undefined {
  if (spec.cwd === undefined) return undefined
  if (spec.cwd === 'session') return ctx.cwd ?? process.cwd()
  return spec.cwd
}

/**
 * Fire-and-forget command runner. Emissions are irreversible side effects:
 * failures only warn, never block the agent loop. Context travels through
 * environment variables (no data interpolation into the shell string);
 * `{{var}}` placeholders are substituted from the same map for explicit
 * templating by the user. `input: 'stdin'` additionally writes the full
 * context as one JSON document to stdin, and `retries` re-spawns commands
 * whose exit code is non-zero (with exponential backoff, in the background).
 * `cwd` moves the spawn into the session/project directory, and an optional
 * `limiter` caps concurrent runs per identity.
 */
export function createHookRunner(log: (line: string) => void = console.log, record?: RunRecord): HookRunner {
  const children = new Set<ReturnType<typeof spawn>>()
  const pendingRetries = new Set<ReturnType<typeof setTimeout>>()
  /** Live logical-run counts per limiter id (retries keep their slot). */
  const inFlightById = new Map<string, number>()

  function releaseSlot(limiter: RunLimiter | undefined): void {
    if (limiter === undefined) return
    const count = (inFlightById.get(limiter.id) ?? 0) - 1
    if (count <= 0) inFlightById.delete(limiter.id)
    else inFlightById.set(limiter.id, count)
  }

  function spawnOnce(
    spec: HookSpec,
    ctx: HookContext,
    attempt: number,
    recordOverride: RunRecord | undefined,
    done: (() => void) | undefined,
  ): RunOutcome {
    if (!spec.run) return { ok: false, reason: 'skipped', detail: 'no run command' }
    // Per-run override replaces the shared sink for this logical run so
    // callers can attribute outcomes (incl. retries) to one hook identity.
    const rec = recordOverride ?? record
    const timeoutMs = spec.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const retries = spec.retries ?? 0
    const retryDelayMs = spec.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
    const env = toEnv(ctx)
    const command = renderTemplate(spec.run, ctx)
    const useStdin = spec.input === 'stdin'
    const base = {
      kind: 'run' as const,
      event: ctx.event,
      command,
      sessionId: ctx.sessionId,
      sessionName: ctx.sessionName,
    }

    log(`[dsh-hooks] 触发 ${eventLabel(ctx)} → ${command}`)

    let child: ReturnType<typeof spawn>
    try {
      child = spawn(command, {
        shell: true,
        cwd: resolveCwd(spec, ctx),
        env: { ...process.env, ...env },
        stdio: [useStdin ? 'pipe' : 'ignore', 'pipe', 'pipe'],
      })
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.warn(`[dsh-hooks] spawn 失败 (${eventLabel(ctx)}): ${detail}`)
      rec?.({ ...base, outcome: 'spawn-failed', error: detail })
      done?.()
      return { ok: false, reason: 'spawn-failed', detail }
    }

    const startedAt = Date.now()
    rec?.({ ...base, outcome: 'spawned' })
    children.add(child)
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      terminate(child)
      console.warn(`[dsh-hooks] 超时（${timeoutMs}ms），已终止：${eventLabel(ctx)}`)
      rec?.({ ...base, outcome: 'timeout', durationMs: Date.now() - startedAt })
    }, timeoutMs)
    // Never hold the process open for a hook.
    child.unref()

    if (useStdin && child.stdin) {
      // The hook may exit before reading stdin (EPIPE on write): the close
      // handler owns failure reporting, so swallow the stream error.
      child.stdin.on('error', () => {})
      child.stdin.write(JSON.stringify(ctx))
      child.stdin.end()
    }

    const captured = { out: '', err: '' }
    const capture = (target: 'out' | 'err') => (chunk: Buffer | string) => {
      const text = String(chunk)
      const room = MAX_CAPTURE_BYTES - captured[target].length
      if (room > 0) captured[target] += text.slice(0, room)
    }
    child.stdout?.on('data', capture('out'))
    child.stderr?.on('data', capture('err'))

    child.on('error', (error) => {
      console.warn(`[dsh-hooks] 执行出错 (${eventLabel(ctx)}): ${error.message}`)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      children.delete(child)
      // Timeouts and external kills (dispose) never retry; only a command
      // that actually ran and exited non-zero does.
      if (timedOut || code === null || code === 0) {
        if (!timedOut && code !== null) {
          rec?.({ ...base, outcome: 'exit-0', exitCode: 0, durationMs: Date.now() - startedAt })
        }
        done?.()
        return
      }
      if (attempt < retries) {
        const delay = retryDelayMs * 2 ** attempt
        log(`[dsh-hooks] hook 退出码 ${code}，${delay}ms 后重试（${attempt + 1}/${retries}）：${eventLabel(ctx)}`)
        const retryTimer = setTimeout(() => {
          pendingRetries.delete(retryTimer)
          spawnOnce(spec, ctx, attempt + 1, recordOverride, done)
        }, delay)
        retryTimer.unref?.()
        pendingRetries.add(retryTimer)
        return
      }
      const tail = captured.err.trim()
      const detail = tail === '' ? '' : `，stderr：${tail.slice(-400)}`
      console.warn(`[dsh-hooks] hook 退出码 ${code} (${eventLabel(ctx)})${detail}`)
      rec?.({ ...base, outcome: 'exit-nonzero', exitCode: code, durationMs: Date.now() - startedAt, error: tail.slice(-400) || undefined })
      done?.()
    })

    return { ok: true, reason: 'ran' }
  }

  function run(spec: HookSpec, ctx: HookContext, recordOverride?: RunRecord, limiter?: RunLimiter): RunOutcome {
    if (!spec.run) return { ok: false, reason: 'skipped', detail: 'no run command' }
    if (limiter !== undefined) {
      const inFlight = inFlightById.get(limiter.id) ?? 0
      if (inFlight >= limiter.max) {
        const detail = `maxConcurrent 达到上限（${limiter.max}），本次触发被丢弃`
        recordOverride?.({ kind: 'run', event: ctx.event, command: spec.run, sessionId: ctx.sessionId, sessionName: ctx.sessionName, outcome: 'skipped', error: detail })
        return { ok: false, reason: 'skipped', detail }
      }
      inFlightById.set(limiter.id, inFlight + 1)
    }
    return spawnOnce(spec, ctx, 0, recordOverride, () => releaseSlot(limiter))
  }

  function dispose(): void {
    for (const timer of pendingRetries) clearTimeout(timer)
    pendingRetries.clear()
    for (const child of children) terminate(child)
    children.clear()
  }

  function stats(): HookRunnerStats {
    return { inFlight: children.size, pendingRetries: pendingRetries.size }
  }

  return { run, stats, dispose }
}

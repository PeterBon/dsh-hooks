/**
 * Hook execution history: an in-memory ring buffer plus a best-effort
 * JSONL append log under ~/.dsh/dsh-hooks/ (0600, owner-only). History is
 * strictly best-effort — a failed write never breaks a hook.
 */
import { appendFileSync, chmodSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** One recorded hook execution. No secrets: env vars never enter records. */
export interface HookRunRecord {
  /** Epoch milliseconds when the record was written. */
  ts: number
  /** `run` (spawned command) or `notify` (built-in channel). */
  kind: 'run' | 'notify'
  event: string
  /** Rendered command (`run`) or `notify:<channel>` (`notify`). */
  command: string
  sessionId?: string
  sessionName?: string
  outcome: 'spawned' | 'spawn-failed' | 'timeout' | 'exit-0' | 'exit-nonzero' | 'sent' | 'send-failed'
  exitCode?: number
  durationMs?: number
  /** stderr tail or error message. */
  error?: string
}

export const DEFAULT_HISTORY_PATH = join(homedir(), '.dsh', 'dsh-hooks', 'history.jsonl')
export const DEFAULT_HISTORY_MAX = 500

export interface HistorySinkOptions {
  /** Whether to persist records to disk. Defaults to true. */
  enabled?: boolean
  /** JSONL file path. Defaults to ~/.dsh/dsh-hooks/history.jsonl. */
  path?: string
  /** In-memory ring buffer size. Defaults to 500. */
  max?: number
}

export interface HistorySink {
  record(record: Omit<HookRunRecord, 'ts'>): void
  /** Most recent records, oldest first. */
  recent(): readonly HookRunRecord[]
  dispose(): void
}

export function createHistorySink(options: HistorySinkOptions = {}): HistorySink {
  const enabled = options.enabled ?? true
  const file = options.path ?? DEFAULT_HISTORY_PATH
  const max = options.max ?? DEFAULT_HISTORY_MAX
  const buffer: HookRunRecord[] = []
  let dirReady = false
  let chmodded = false

  function record(partial: Omit<HookRunRecord, 'ts'>): void {
    const entry: HookRunRecord = { ...partial, ts: Date.now() }
    buffer.push(entry)
    if (buffer.length > max) buffer.splice(0, buffer.length - max)
    if (!enabled) return
    try {
      if (!dirReady) {
        mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
        dirReady = true
      }
      appendFileSync(file, JSON.stringify(entry) + '\n', 'utf8')
      if (!chmodded) {
        try {
          chmodSync(file, 0o600)
        } catch {
          // Windows: ACL-based protection; the file lives under the user profile.
        }
        chmodded = true
      }
    } catch {
      // History is best-effort: a failed write never breaks a hook.
    }
  }

  return {
    record,
    recent: () => buffer,
    dispose: () => {},
  }
}

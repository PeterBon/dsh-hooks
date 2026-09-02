/**
 * Hook execution history: an in-memory ring buffer plus a best-effort
 * JSONL append log under ~/.dsh/dsh-hooks/ (0600, owner-only). History is
 * strictly best-effort — a failed write never breaks a hook.
 *
 * The buffer is not process-private memory only: it seeds from the JSONL at
 * startup and `sync()` incrementally ingests bytes appended since the last
 * read, so records written before a restart (or by another dsh process
 * sharing the file, e.g. a task-board Host) surface in the web GUI instead
 * of vanishing with the process.
 */
import {
  appendFileSync,
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
} from 'node:fs'
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
  outcome: 'spawned' | 'spawn-failed' | 'timeout' | 'exit-0' | 'exit-nonzero' | 'skipped' | 'sent' | 'send-failed'
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
  /**
   * Ingest JSONL bytes appended since the last read (startup seed or another
   * process). Idempotent and best-effort: failures leave the buffer as-is.
   */
  sync(): void
  dispose(): void
}

export function createHistorySink(options: HistorySinkOptions = {}): HistorySink {
  const enabled = options.enabled ?? true
  const file = options.path ?? DEFAULT_HISTORY_PATH
  const max = options.max ?? DEFAULT_HISTORY_MAX
  const buffer: HookRunRecord[] = []
  let dirReady = false
  let chmodded = false
  /** Bytes of `file` already ingested into the buffer. */
  let syncedBytes = 0
  /** Trailing fragment of the last read that did not end with a newline. */
  let pending = ''

  function push(entry: HookRunRecord): void {
    buffer.push(entry)
    if (buffer.length > max) buffer.splice(0, buffer.length - max)
  }

  /** Parse complete JSONL lines into the ring buffer; incomplete tails stay pending. */
  function ingest(text: string): void {
    pending += text
    const lines = pending.split('\n')
    pending = lines.pop() ?? ''
    for (const line of lines) {
      if (line === '') continue
      try {
        const entry = JSON.parse(line) as HookRunRecord
        if (typeof entry !== 'object' || entry === null || typeof entry.ts !== 'number') continue
        push(entry)
      } catch {
        // Broken line (mid-write or foreign content): skip, never fail.
      }
    }
  }

  /** Rebuild the buffer from the whole file (startup seed / truncated file). */
  function rebuild(): void {
    buffer.length = 0
    pending = ''
    syncedBytes = 0
    const text = readFileSync(file, 'utf8')
    syncedBytes = Buffer.byteLength(text, 'utf8')
    ingest(text)
  }

  /** Seed the ring buffer from an existing JSONL log (best-effort). */
  function seed(): void {
    if (!enabled) return
    try {
      if (!existsSync(file)) return
      rebuild()
    } catch {
      // Seeding is best-effort; recording starts from an empty buffer.
    }
  }

  /** Ingest every byte appended since the last read (own writes included). */
  function sync(): void {
    if (!enabled) return
    try {
      if (!existsSync(file)) return
      const size = statSync(file).size
      if (size === syncedBytes) return
      if (size < syncedBytes) {
        // The file shrank (rotation/truncation): rebuild from its tail.
        rebuild()
        return
      }
      const deltaBytes = size - syncedBytes
      const fd = openSync(file, 'r')
      try {
        const chunk = Buffer.allocUnsafe(deltaBytes)
        let total = 0
        while (total < deltaBytes) {
          const n = readSync(fd, chunk, total, deltaBytes - total, syncedBytes + total)
          if (n <= 0) break
          total += n
        }
        ingest(chunk.subarray(0, total).toString('utf8'))
      } finally {
        closeSync(fd)
      }
      syncedBytes = size
    } catch {
      // Sync is best-effort; the next call retries.
    }
  }

  function record(partial: Omit<HookRunRecord, 'ts'>): void {
    const entry: HookRunRecord = { ...partial, ts: Date.now() }
    // Ingest other processes' appends BEFORE our own entry so the buffer
    // stays in file order, and `syncedBytes` stays a true prefix of the
    // file (otherwise our own advance would skip the foreign appends).
    if (enabled) sync()
    push(entry)
    if (!enabled) return
    try {
      if (!dirReady) {
        mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
        dirReady = true
      }
      appendFileSync(file, JSON.stringify(entry) + '\n', 'utf8')
      syncedBytes = statSync(file).size
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

  seed()

  return {
    record,
    recent: () => buffer,
    sync,
    dispose: () => {},
  }
}

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
  renameSync,
  statSync,
  writeFileSync,
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
/**
 * Compact the JSONL file once it grows past this many bytes. Without a cap the
 * append-only log grows forever (every trigger writes at least a `spawned` and
 * a terminal record), and the startup seed has to read all of it.
 */
export const DEFAULT_HISTORY_MAX_BYTES = 2 * 1024 * 1024
/** Newest bytes read when seeding from (or compacting) a large file. */
export const DEFAULT_HISTORY_TAIL_BYTES = 512 * 1024

export interface HistorySinkOptions {
  /** Whether to persist records to disk. Defaults to true. */
  enabled?: boolean
  /** JSONL file path. Defaults to ~/.dsh/dsh-hooks/history.jsonl. */
  path?: string
  /** In-memory ring buffer size. Defaults to 500. */
  max?: number
  /**
   * Compact the file once it exceeds this size; `0` never compacts.
   * Defaults to {@link DEFAULT_HISTORY_MAX_BYTES}.
   */
  maxBytes?: number
  /** Newest bytes read when seeding/compacting. Defaults to {@link DEFAULT_HISTORY_TAIL_BYTES}. */
  tailBytes?: number
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
  const maxBytes = options.maxBytes ?? DEFAULT_HISTORY_MAX_BYTES
  const tailBytes = options.tailBytes ?? DEFAULT_HISTORY_TAIL_BYTES
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

  /**
   * Newest `bytes` of the file as text, cut at the first line boundary so the
   * result starts on a complete record. Bounds both the startup seed and
   * compaction: a multi-gigabyte log must not be read into memory whole.
   */
  function readTail(bytes: number): string {
    const size = statSync(file).size
    if (size <= bytes) return readFileSync(file, 'utf8')
    const fd = openSync(file, 'r')
    try {
      const chunk = Buffer.allocUnsafe(bytes)
      let total = 0
      while (total < bytes) {
        const n = readSync(fd, chunk, total, bytes - total, size - bytes + total)
        if (n <= 0) break
        total += n
      }
      const text = chunk.subarray(0, total).toString('utf8')
      const firstBreak = text.indexOf('\n')
      return firstBreak === -1 ? '' : text.slice(firstBreak + 1)
    } finally {
      closeSync(fd)
    }
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

  /** Rebuild the buffer from the file's newest bytes (startup seed / truncated file). */
  function rebuild(): void {
    buffer.length = 0
    pending = ''
    syncedBytes = 0
    const text = readTail(tailBytes)
    syncedBytes = statSync(file).size
    ingest(text)
  }

  /**
   * Rewrite the file with only its newest bytes, once it grows past the cap.
   * Atomic (temp file + rename) so a crash cannot leave a half-written log; the
   * buffer is refilled from what was kept, so the panel keeps showing the tail.
   */
  function compact(): void {
    // Keep the newest records, but never more than the cap itself: `tailBytes`
    // may exceed `maxBytes` (a caller can set a small cap on purpose).
    const keepBytes = Math.min(tailBytes, maxBytes)
    const kept = keepBytes <= 0 ? [] : readTail(keepBytes).split('\n').filter((line) => line !== '')
    const temp = `${file}.tmp-${process.pid}`
    writeFileSync(temp, kept.length === 0 ? '' : kept.join('\n') + '\n', { encoding: 'utf8', mode: 0o600 })
    renameSync(temp, file)
    buffer.length = 0
    pending = ''
    ingest(kept.length === 0 ? '' : kept.join('\n') + '\n')
    syncedBytes = statSync(file).size
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

  /** Ingest the file bytes in `[from, to)` into the ring buffer. */
  function ingestRange(from: number, to: number): void {
    const deltaBytes = to - from
    if (deltaBytes <= 0) return
    const fd = openSync(file, 'r')
    try {
      const chunk = Buffer.allocUnsafe(deltaBytes)
      let total = 0
      while (total < deltaBytes) {
        const n = readSync(fd, chunk, total, deltaBytes - total, from + total)
        if (n <= 0) break
        total += n
      }
      ingest(chunk.subarray(0, total).toString('utf8'))
    } finally {
      closeSync(fd)
    }
  }

  /**
   * Ingest every byte appended since the last read and return the synced size
   * (undefined when persistence is off or the file is unreadable). Returning
   * the size lets `record` verify its own write without another stat.
   */
  function syncToEnd(): number | undefined {
    if (!enabled) return undefined
    try {
      if (!existsSync(file)) return undefined
      const size = statSync(file).size
      if (size < syncedBytes) {
        // The file shrank (rotation/truncation): rebuild from its tail.
        rebuild()
        return statSync(file).size
      }
      if (size > syncedBytes) {
        ingestRange(syncedBytes, size)
        syncedBytes = size
      }
      return size
    } catch {
      // Sync is best-effort; the next call retries.
      return undefined
    }
  }

  /** Ingest every byte appended since the last read (own writes included). */
  function sync(): void {
    syncToEnd()
  }

  function record(partial: Omit<HookRunRecord, 'ts'>): void {
    const entry: HookRunRecord = { ...partial, ts: Date.now() }
    // Ingest other processes' appends BEFORE our own entry so the buffer stays
    // in file order, and remember the size they left the file at.
    const syncedSize = enabled ? syncToEnd() : undefined
    push(entry)
    if (!enabled) return
    try {
      if (!dirReady) {
        mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
        dirReady = true
      }
      const before = syncedSize ?? (existsSync(file) ? statSync(file).size : 0)
      const line = JSON.stringify(entry) + '\n'
      // Create owner-only (mode applies at creation; an existing file keeps
      // its mode and is chmodded below).
      appendFileSync(file, line, { encoding: 'utf8', mode: 0o600 })
      const size = statSync(file).size
      if (size === before + Buffer.byteLength(line, 'utf8')) {
        // Our line is exactly where we expect it: the file is a true prefix.
        syncedBytes = size
      } else {
        // Another process appended inside our write window, so a size delta can
        // no longer say what we have ingested. Resync from the tail instead of
        // advancing past records that never entered the buffer (the tail window
        // is far larger than the ring, so nothing visible is lost).
        rebuild()
      }
      if (!chmodded) {
        try {
          chmodSync(file, 0o600)
          chmodded = true
        } catch {
          // Windows: ACL-based protection; the file lives under the user
          // profile. Left unset so a later write retries the chmod.
        }
      }
      if (maxBytes > 0 && size > maxBytes) compact()
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

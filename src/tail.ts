/**
 * Incremental reader for the hook history JSONL log, behind
 * `dsh-hooks tail`. It follows the same rules as the history sink — complete
 * lines only, a shrinking file means rotation/truncation and resets the
 * offset, a broken line never throws — but it is strictly read-only and keeps
 * no ring buffer: it hands each new batch to the caller.
 *
 * The reader tracks a byte offset plus the trailing fragment of the last read
 * (a line can be observed mid-write). Decoding happens per chunk, exactly like
 * the sink does, so a multibyte character split across two reads can cost one
 * malformed line at worst — never a crash.
 */
import { closeSync, existsSync, openSync, readSync, statSync } from 'node:fs'
import type { HookRunRecord } from './history.js'

/** Bytes of the file tail read for the initial backfill. */
export const TAIL_BACKFILL_BYTES = 64 * 1024

export interface TailBatch {
  /** Parsed records of the complete lines in this batch, in file order. */
  records: HookRunRecord[]
  /** The same lines verbatim, for `--json` passthrough. */
  lines: string[]
  /** The file shrank (rotation/truncation) and reading restarted from 0. */
  reset: boolean
}

/** Optional filters for `tail` (all are AND-ed; unset means "no filter"). */
export interface TailFilter {
  /** Exact event name (`turn/end`, …). */
  event?: string
  /** Exact outcome (`exit-nonzero`, `send-failed`, …). */
  outcome?: string
  /** Substring of the hook identity (the rendered command / `notify:<channel>`). */
  hook?: string
}

/** Does a record pass every configured filter? */
export function matchesTailFilter(record: HookRunRecord, filter: TailFilter): boolean {
  if (filter.event !== undefined && record.event !== filter.event) return false
  if (filter.outcome !== undefined && record.outcome !== filter.outcome) return false
  if (filter.hook !== undefined && !record.command.includes(filter.hook)) return false
  return true
}

/** Local `HH:MM:SS` stamp for a record's epoch-ms timestamp. */
function clockTime(ts: number): string {
  const date = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** One human-readable line, aligned with the Web GUI's history timeline. */
export function formatTailRecord(record: HookRunRecord): string {
  const parts = [clockTime(record.ts), record.event, record.command, record.outcome]
  if (record.durationMs !== undefined) parts.push(`${record.durationMs}ms`)
  if (record.exitCode !== undefined && record.exitCode !== 0) parts.push(`exit=${record.exitCode}`)
  if (record.sessionName || record.sessionId) parts.push(record.sessionName ?? String(record.sessionId))
  let line = parts.join('  ')
  if (record.error) line += `\n    ${record.error.replace(/\s+/g, ' ').slice(0, 300)}`
  return line
}

/** Parse one JSONL line into a record, or undefined when it is unreadable. */
function parseRecord(line: string): HookRunRecord | undefined {
  try {
    const entry = JSON.parse(line) as HookRunRecord
    if (typeof entry !== 'object' || entry === null || typeof entry.ts !== 'number') return undefined
    return entry
  } catch {
    return undefined
  }
}

export class HistoryTailer {
  #offset = 0
  #pending = ''

  constructor(readonly file: string) {}

  /** Bytes already consumed (the next read starts here). */
  get offset(): number {
    return this.#offset
  }

  /** Read `[start, end)` as text (best-effort: returns '' when unreadable). */
  #read(start: number, end: number): string {
    const length = end - start
    if (length <= 0) return ''
    const fd = openSync(this.file, 'r')
    try {
      const chunk = Buffer.allocUnsafe(length)
      let total = 0
      while (total < length) {
        const read = readSync(fd, chunk, total, length - total, start + total)
        if (read <= 0) break
        total += read
      }
      return chunk.subarray(0, total).toString('utf8')
    } finally {
      closeSync(fd)
    }
  }

  /**
   * The last `limit` records (`limit <= 0` = all of them), read from at most
   * `maxBytes` of the file tail so a large log is never slurped just to print
   * a few lines. Leaves the reader positioned at EOF, so the following
   * {@link readNew} only reports what is appended afterwards.
   */
  backfill(limit = 10, maxBytes = TAIL_BACKFILL_BYTES): HookRunRecord[] {
    if (!existsSync(this.file)) return []
    const size = statSync(this.file).size
    if (size === 0) {
      this.#offset = 0
      this.#pending = ''
      return []
    }
    const start = Math.max(0, size - Math.max(0, maxBytes))
    const text = this.#read(start, size)
    this.#offset = size
    this.#pending = ''
    let lines = text.split('\n')
    // Reading from the middle of the file starts mid-line: drop that fragment.
    if (start > 0) lines = lines.slice(1)
    const records: HookRunRecord[] = []
    for (const line of lines) {
      if (line === '') continue
      const record = parseRecord(line)
      if (record !== undefined) records.push(record)
    }
    return limit > 0 ? records.slice(-limit) : records
  }

  /**
   * Complete lines appended since the previous call. A file that shrank since
   * then was rotated/truncated: reading restarts from 0 and `reset` is set so
   * the caller can say so out loud.
   */
  readNew(): TailBatch {
    const batch: TailBatch = { records: [], lines: [], reset: false }
    if (!existsSync(this.file)) return batch
    const size = statSync(this.file).size
    if (size < this.#offset) {
      this.#offset = 0
      this.#pending = ''
      batch.reset = true
    }
    if (size === this.#offset) return batch
    const text = this.#pending + this.#read(this.#offset, size)
    this.#offset = size
    const parts = text.split('\n')
    this.#pending = parts.pop() ?? ''
    for (const line of parts) {
      if (line === '') continue
      batch.lines.push(line)
      const record = parseRecord(line)
      if (record !== undefined) batch.records.push(record)
    }
    return batch
  }
}

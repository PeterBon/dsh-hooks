import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createHistorySink, DEFAULT_HISTORY_MAX } from '../src/history.js'

let tmp: string

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'dsh-hooks-history-'))
})

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

const sample = {
  kind: 'run' as const,
  event: 'turn/end',
  command: 'node notify.mjs',
  sessionId: 's1',
  sessionName: '构建',
  outcome: 'exit-0' as const,
  exitCode: 0,
  durationMs: 12,
}

describe('createHistorySink', () => {
  it('buffers records in memory with ts stamps', () => {
    const sink = createHistorySink({ enabled: false })
    sink.record(sample)
    const recent = sink.recent()
    expect(recent).toHaveLength(1)
    expect(recent[0]).toMatchObject({ ...sample })
    expect(typeof recent[0].ts).toBe('number')
  })

  it('keeps only the newest max records (ring buffer)', () => {
    const sink = createHistorySink({ enabled: false, max: 3 })
    for (let i = 0; i < 5; i++) sink.record({ ...sample, event: `event-${i}` })
    const recent = sink.recent()
    expect(recent.map((r) => r.event)).toEqual(['event-2', 'event-3', 'event-4'])
  })

  it('defaults to the home-dir path and 500-entry buffer', () => {
    const sink = createHistorySink({ enabled: false })
    expect(DEFAULT_HISTORY_MAX).toBe(500)
    expect(sink.recent()).toEqual([])
  })

  it('appends JSONL records to the configured file', () => {
    const file = join(tmp, 'history.jsonl')
    const sink = createHistorySink({ path: file })
    sink.record(sample)
    sink.record({ ...sample, event: 'tool/call' })
    const lines = readFileSync(file, 'utf8').trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0])).toMatchObject({ kind: 'run', event: 'turn/end', outcome: 'exit-0' })
    expect(JSON.parse(lines[1]).event).toBe('tool/call')
  })

  it('creates missing parent directories', () => {
    const file = join(tmp, 'deep', 'nested', 'history.jsonl')
    const sink = createHistorySink({ path: file })
    sink.record(sample)
    expect(existsSync(file)).toBe(true)
  })

  it('never writes when disabled', () => {
    const file = join(tmp, 'history.jsonl')
    const sink = createHistorySink({ enabled: false, path: file })
    sink.record(sample)
    expect(existsSync(file)).toBe(false)
  })

  it('swallows write failures (best-effort)', () => {
    // A path under an existing FILE makes mkdirSync throw; the sink must not.
    const blocker = join(tmp, 'blocker')
    const { writeFileSync } = require('node:fs') as typeof import('node:fs')
    writeFileSync(blocker, 'x')
    const sink = createHistorySink({ path: join(blocker, 'sub', 'history.jsonl') })
    expect(() => sink.record(sample)).not.toThrow()
    expect(sink.recent()).toHaveLength(1) // memory buffer still works
  })
})

describe('disk seeding and sync', () => {
  const line = (event: string, ts: number) => JSON.stringify({ ...sample, event, ts }) + '\n'

  it('seeds the buffer from an existing JSONL at startup', () => {
    const file = join(tmp, 'history.jsonl')
    writeFileSync(file, line('event-0', 1000) + line('event-1', 2000), 'utf8')
    const sink = createHistorySink({ path: file })
    expect(sink.recent().map((r) => r.event)).toEqual(['event-0', 'event-1'])
  })

  it('seeds only the newest max records', () => {
    const file = join(tmp, 'history.jsonl')
    writeFileSync(file, line('a', 1) + line('b', 2) + line('c', 3), 'utf8')
    const sink = createHistorySink({ path: file, max: 2 })
    expect(sink.recent().map((r) => r.event)).toEqual(['b', 'c'])
  })

  it('sync ingests appends from another process, idempotently', () => {
    const file = join(tmp, 'history.jsonl')
    writeFileSync(file, line('a', 1), 'utf8')
    const sink = createHistorySink({ path: file })
    appendFileSync(file, line('b', 2), 'utf8')
    sink.sync()
    sink.sync() // second call must not duplicate
    expect(sink.recent().map((r) => r.event)).toEqual(['a', 'b'])
  })

  it('record ingests external appends before writing its own', () => {
    const file = join(tmp, 'history.jsonl')
    writeFileSync(file, line('a', 1), 'utf8')
    const sink = createHistorySink({ path: file })
    appendFileSync(file, line('b', 2), 'utf8') // other process
    sink.record({ ...sample, event: 'c' })
    expect(sink.recent().map((r) => r.event)).toEqual(['a', 'b', 'c'])
    // And the file holds all three, in order.
    const lines = readFileSync(file, 'utf8').trim().split('\n')
    expect(lines).toHaveLength(3)
    expect(JSON.parse(lines[2]).event).toBe('c')
  })

  it('skips broken lines and survives truncation', () => {
    const file = join(tmp, 'history.jsonl')
    writeFileSync(file, line('a', 1), 'utf8')
    const sink = createHistorySink({ path: file })
    appendFileSync(file, 'not-json\n', 'utf8')
    sink.sync()
    expect(sink.recent().map((r) => r.event)).toEqual(['a'])
    // Truncate to one line; the buffer rebuilds from what remains.
    writeFileSync(file, line('z', 9), 'utf8')
    sink.sync()
    expect(sink.recent().map((r) => r.event)).toEqual(['z'])
  })

  it('never reads the disk when persistence is disabled', () => {
    const file = join(tmp, 'history.jsonl')
    writeFileSync(file, line('a', 1), 'utf8')
    const sink = createHistorySink({ enabled: false, path: file })
    expect(sink.recent()).toEqual([])
    sink.sync()
    expect(sink.recent()).toEqual([])
  })
})

describe('disk retention', () => {
  const line = (event: string, ts: number) => JSON.stringify({ ...sample, event, ts }) + '\n'

  it('seeds only the newest tail of a large log', () => {
    const file = join(tmp, 'history.jsonl')
    const records: string[] = []
    for (let i = 0; i < 200; i++) records.push(line(`event-${i}`, i + 1))
    writeFileSync(file, records.join(''), 'utf8')

    // A small tail window: the seed must read the end of the file, not all of it.
    const sink = createHistorySink({ path: file, tailBytes: 400 })
    const events = sink.recent().map((r) => r.event)
    expect(events.length).toBeGreaterThan(0)
    expect(events.length).toBeLessThan(200)
    expect(events.at(-1)).toBe('event-199')
    // Every seeded record is a complete line (no half-parsed cut).
    expect(events.every((event) => /^event-\d+$/.test(event))).toBe(true)
  })

  it('compacts the file once it exceeds the size cap, keeping the newest records', () => {
    const file = join(tmp, 'history.jsonl')
    const sink = createHistorySink({ path: file, max: 5, maxBytes: 400, tailBytes: 4000 })
    for (let i = 0; i < 60; i++) sink.record({ ...sample, event: `event-${i}` })

    const size = statSync(file).size
    // 60 records are far bigger than the cap; compaction must keep the file small.
    expect(size).toBeLessThanOrEqual(800)
    // The newest record survives, and what remains is valid JSONL.
    expect(sink.recent().at(-1)?.event).toBe('event-59')
    const kept = readFileSync(file, 'utf8').split('\n').filter((entry) => entry !== '')
    expect(kept.length).toBeGreaterThan(0)
    for (const entry of kept) expect(() => JSON.parse(entry)).not.toThrow()
    expect(JSON.parse(kept[kept.length - 1] as string).event).toBe('event-59')
  })

  it('does not compact when the cap is disabled', () => {
    const file = join(tmp, 'history.jsonl')
    const sink = createHistorySink({ path: file, maxBytes: 0 })
    for (let i = 0; i < 30; i++) sink.record({ ...sample, event: `event-${i}` })
    const kept = readFileSync(file, 'utf8').split('\n').filter((entry) => entry !== '')
    expect(kept).toHaveLength(30)
  })

  it('creates the log owner-only on POSIX', () => {
    const file = join(tmp, 'history.jsonl')
    const sink = createHistorySink({ path: file })
    sink.record({ ...sample, event: 'first' })
    if (process.platform !== 'win32') {
      expect(statSync(file).mode & 0o777).toBe(0o600)
    }
    expect(readFileSync(file, 'utf8')).toContain('first')
  })

  it('keeps the cursor consistent across its own and foreign appends', () => {
    const file = join(tmp, 'history.jsonl')
    const sink = createHistorySink({ path: file })
    sink.record({ ...sample, event: 'own-1' })
    // Another process appends, then we append again: the foreign record must be
    // ingested in order, and our own records must not be duplicated.
    appendFileSync(file, JSON.stringify({ ...sample, event: 'foreign', ts: 2 }) + '\n', 'utf8')
    sink.record({ ...sample, event: 'own-2' })
    sink.sync()
    expect(sink.recent().map((r) => r.event)).toEqual(['own-1', 'foreign', 'own-2'])
    expect(readFileSync(file, 'utf8').trim().split('\n')).toHaveLength(3)
    // Re-syncing changes nothing (the cursor points at the file end).
    sink.sync()
    expect(sink.recent().map((r) => r.event)).toEqual(['own-1', 'foreign', 'own-2'])
  })
})

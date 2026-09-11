import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { tailHistory } from '../bin/dsh-hooks.mjs'
import { loadHistoryPath } from '../src/dry-run.js'
import { DEFAULT_HISTORY_PATH } from '../src/history.js'
import { formatTailRecord, HistoryTailer, matchesTailFilter } from '../src/tail.js'
import type { HookRunRecord } from '../src/history.js'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dsh-hooks-tail-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function record(overrides: Partial<HookRunRecord> = {}): HookRunRecord {
  return {
    ts: new Date(2026, 8, 11, 15, 4, 5).getTime(),
    kind: 'run',
    event: 'turn/end',
    command: 'node notify.mjs',
    outcome: 'exit-0',
    ...overrides,
  }
}

const line = (entry: HookRunRecord) => `${JSON.stringify(entry)}\n`

describe('matchesTailFilter', () => {
  const entry = record({ event: 'tool/result', outcome: 'exit-nonzero', command: 'node slow.mjs' })

  it('passes everything without a filter', () => {
    expect(matchesTailFilter(entry, {})).toBe(true)
  })

  it('ANDs event, outcome and hook substring', () => {
    expect(matchesTailFilter(entry, { event: 'tool/result' })).toBe(true)
    expect(matchesTailFilter(entry, { event: 'turn/end' })).toBe(false)
    expect(matchesTailFilter(entry, { outcome: 'exit-nonzero' })).toBe(true)
    expect(matchesTailFilter(entry, { outcome: 'sent' })).toBe(false)
    expect(matchesTailFilter(entry, { hook: 'slow' })).toBe(true)
    expect(matchesTailFilter(entry, { hook: 'fast' })).toBe(false)
    expect(matchesTailFilter(entry, { event: 'tool/result', hook: 'fast' })).toBe(false)
  })
})

describe('formatTailRecord', () => {
  it('renders one aligned line with duration, exit code and session', () => {
    const text = formatTailRecord(record({ durationMs: 1234, exitCode: 2, sessionName: '修复构建' }))
    expect(text).toContain('15:04:05')
    expect(text).toContain('turn/end')
    expect(text).toContain('node notify.mjs')
    expect(text).toContain('exit-0')
    expect(text).toContain('1234ms')
    expect(text).toContain('exit=2')
    expect(text).toContain('修复构建')
  })

  it('collapses an error message onto an indented second line', () => {
    const text = formatTailRecord(record({ outcome: 'exit-nonzero', error: 'boom\n  at x' }))
    expect(text.split('\n')).toHaveLength(2)
    expect(text).toContain('boom at x')
  })
})

describe('HistoryTailer', () => {
  it('backfills the last N records', () => {
    const file = join(dir, 'history.jsonl')
    writeFileSync(file, [1, 2, 3, 4, 5].map((n) => line(record({ command: `cmd-${n}` }))).join(''))
    const tailer = new HistoryTailer(file)
    const records = tailer.backfill(2)
    expect(records.map((entry) => entry.command)).toEqual(['cmd-4', 'cmd-5'])
    // Positioned at EOF: nothing "new" right after a backfill.
    expect(tailer.readNew().records).toEqual([])
  })

  it('returns every record when the limit is not positive', () => {
    const file = join(dir, 'history.jsonl')
    writeFileSync(file, [1, 2].map((n) => line(record({ command: `cmd-${n}` }))).join(''))
    expect(new HistoryTailer(file).backfill(0)).toHaveLength(2)
  })

  it('drops the partial first line when only the tail bytes are read', () => {
    const file = join(dir, 'history.jsonl')
    writeFileSync(file, [1, 2, 3].map((n) => line(record({ command: `cmd-${n}` }))).join(''))
    // A window that starts in the middle of the second line.
    const records = new HistoryTailer(file).backfill(10, 120)
    expect(records.map((entry) => entry.command)).toEqual(['cmd-3'])
  })

  it('reads only appended bytes and never re-reports older records', () => {
    const file = join(dir, 'history.jsonl')
    writeFileSync(file, line(record({ command: 'first' })))
    const tailer = new HistoryTailer(file)
    expect(tailer.backfill(10).map((entry) => entry.command)).toEqual(['first'])

    appendFileSync(file, line(record({ command: 'second' })))
    const batch = tailer.readNew()
    expect(batch.records.map((entry) => entry.command)).toEqual(['second'])
    expect(batch.lines).toHaveLength(1)
    expect(batch.reset).toBe(false)
    expect(tailer.readNew().records).toEqual([])
  })

  it('waits for a complete line (mid-write records stay pending)', () => {
    const file = join(dir, 'history.jsonl')
    writeFileSync(file, '')
    const tailer = new HistoryTailer(file)
    const text = JSON.stringify(record({ command: 'partial' }))
    appendFileSync(file, text.slice(0, 20))
    expect(tailer.readNew().records).toEqual([])
    appendFileSync(file, `${text.slice(20)}\n`)
    expect(tailer.readNew().records.map((entry) => entry.command)).toEqual(['partial'])
  })

  it('resets the offset when the file is truncated or rotated', () => {
    const file = join(dir, 'history.jsonl')
    writeFileSync(file, line(record({ command: 'old-old-old' })) + line(record({ command: 'old' })))
    const tailer = new HistoryTailer(file)
    tailer.backfill(10)

    writeFileSync(file, line(record({ command: 'fresh' })))
    const batch = tailer.readNew()
    expect(batch.reset).toBe(true)
    expect(batch.records.map((entry) => entry.command)).toEqual(['fresh'])
  })

  it('tolerates a missing file and a broken line', () => {
    const missing = new HistoryTailer(join(dir, 'nope.jsonl'))
    expect(missing.backfill(5)).toEqual([])
    expect(missing.readNew()).toEqual({ records: [], lines: [], reset: false })

    const file = join(dir, 'history.jsonl')
    writeFileSync(file, 'not json\n' + line(record({ command: 'good' })))
    const tailer = new HistoryTailer(file)
    expect(tailer.backfill(10).map((entry) => entry.command)).toEqual(['good'])
  })
})

describe('loadHistoryPath', () => {
  it('prefers the configured history path', () => {
    const patch = join(dir, 'cordis.patch.yml')
    writeFileSync(patch, ['- id: dsh-hooks', '  config:', '    history:', '      path: D:\\logs\\hooks.jsonl'].join('\n'))
    expect(loadHistoryPath('web', { patchFile: patch })).toBe('D:\\logs\\hooks.jsonl')
  })

  it('falls back to the plugin default for a missing or history-less profile', () => {
    expect(loadHistoryPath('web', { patchFile: join(dir, 'missing.yml') })).toBe(DEFAULT_HISTORY_PATH)
    const patch = join(dir, 'cordis.patch.yml')
    writeFileSync(patch, ['- id: dsh-hooks', '  config:', '    hooks: []'].join('\n'))
    expect(loadHistoryPath('web', { patchFile: patch })).toBe(DEFAULT_HISTORY_PATH)
  })

  it('stays lenient when the patch file is malformed', () => {
    const patch = join(dir, 'cordis.patch.yml')
    writeFileSync(patch, 'not: [a yaml')
    expect(loadHistoryPath('web', { patchFile: patch })).toBe(DEFAULT_HISTORY_PATH)
  })
})

describe('tailHistory', () => {
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  it('prints the backfill, then follows appends, honouring the filters', async () => {
    const file = join(dir, 'history.jsonl')
    writeFileSync(
      file,
      line(record({ event: 'turn/end', command: 'cmd-old' })) + line(record({ event: 'tool/call', command: 'cmd-tail' })),
    )
    const out: string[] = []
    const stop = await tailHistory({ file, n: 1, intervalMs: 10, print: (text) => out.push(text) })
    try {
      expect(out[0]).toContain('dsh-hooks tail ·')
      expect(out.some((text) => text.includes('cmd-tail'))).toBe(true)
      expect(out.some((text) => text.includes('cmd-old'))).toBe(false)

      appendFileSync(file, line(record({ event: 'usage/daily', command: 'cmd-new' })))
      await wait(50)
      expect(out.some((text) => text.includes('cmd-new'))).toBe(true)
    } finally {
      stop()
    }
  })

  it('emits raw JSONL with json: true and applies an event filter', async () => {
    const file = join(dir, 'history.jsonl')
    writeFileSync(file, line(record({ event: 'turn/end', command: 'a' })))
    const out: string[] = []
    const stop = await tailHistory({
      file,
      n: 5,
      json: true,
      intervalMs: 10,
      event: 'turn/end',
      hook: 'a',
      print: (text) => out.push(text),
    })
    try {
      const payload = out.find((text) => text.startsWith('{'))
      expect(payload).toBeDefined()
      expect(JSON.parse(payload as string).command).toBe('a')
      expect(out.some((text) => text.includes('过滤：event=turn/end hook=a'))).toBe(true)
    } finally {
      stop()
    }
  })

  it('announces a truncated file and keeps following from the start', async () => {
    const file = join(dir, 'history.jsonl')
    writeFileSync(file, line(record({ command: 'before-rotation' })))
    const out: string[] = []
    const stop = await tailHistory({ file, n: 5, intervalMs: 10, print: (text) => out.push(text) })
    try {
      writeFileSync(file, line(record({ command: 'after-rotation' })))
      await wait(50)
      expect(out.some((text) => text.includes('已从头跟进'))).toBe(true)
      expect(out.some((text) => text.includes('after-rotation'))).toBe(true)
    } finally {
      stop()
    }
  })

  it('says so when the log is empty', async () => {
    const file = join(dir, 'history.jsonl')
    writeFileSync(file, '')
    const out: string[] = []
    const stop = await tailHistory({ file, intervalMs: 10, print: (text) => out.push(text) })
    try {
      expect(out.some((text) => text.includes('（暂无历史记录）'))).toBe(true)
    } finally {
      stop()
    }
  })
})

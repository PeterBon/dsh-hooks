import { describe, expect, it } from 'vitest'
import type { HookContext } from '../src/context.js'
import {
  DailyUsageAccumulator,
  localDayKey,
  usageTotalsFromContext,
  type UsageTotals,
} from '../src/usage.js'

/** Local-time date helper: month is 0-based, so 8 = September. */
const at = (day: number, hour = 12, minute = 0) => new Date(2026, 8, day, hour, minute)

const usage = (inputTokens: number, outputTokens: number, extra: Partial<UsageTotals> = {}): UsageTotals => ({
  inputTokens,
  outputTokens,
  ...extra,
})

describe('localDayKey', () => {
  it('renders the local calendar day with zero padding', () => {
    expect(localDayKey(new Date(2026, 8, 1, 23, 59))).toBe('2026-09-01')
    expect(localDayKey(new Date(2026, 0, 9, 0, 0))).toBe('2026-01-09')
    expect(localDayKey(new Date(2026, 11, 31, 12, 0))).toBe('2026-12-31')
  })

  it('follows the local day, not the UTC day', () => {
    // 00:30 local is a different calendar day than its UTC rendering in any
    // timezone offset; the key must follow the machine's local day.
    const localMidnight = new Date(2026, 8, 2, 0, 30)
    expect(localDayKey(localMidnight)).toBe('2026-09-02')
  })
})

describe('usageTotalsFromContext', () => {
  it('reads the flattened turn usage off a context', () => {
    const ctx: HookContext = {
      event: 'turn/end',
      usageInputTokens: 100,
      usageOutputTokens: 40,
      usageCacheReadTokens: 500,
      timestamp: 'T',
    }
    expect(usageTotalsFromContext(ctx)).toEqual({
      inputTokens: 100,
      outputTokens: 40,
      cacheReadTokens: 500,
    })
  })

  it('omits optional fields that were never reported', () => {
    const totals = usageTotalsFromContext({ event: 'turn/end', usageInputTokens: 5, usageOutputTokens: 0, timestamp: 'T' })
    expect(totals).toEqual({ inputTokens: 5, outputTokens: 0 })
    expect(totals !== undefined && 'cacheWriteTokens' in totals).toBe(false)
    expect(totals !== undefined && 'reasoningTokens' in totals).toBe(false)
  })

  it('returns undefined when the turn reported no accounting', () => {
    expect(usageTotalsFromContext({ event: 'turn/end', timestamp: 'T' })).toBeUndefined()
    expect(usageTotalsFromContext({ event: 'usage/daily', usageDay: '2026-09-01', timestamp: 'T' })).toBeUndefined()
  })
})

describe('DailyUsageAccumulator', () => {
  it('anchors the day on the first observation and reports nothing', () => {
    const bucket = new DailyUsageAccumulator()
    expect(bucket.observe({ totals: usage(100, 50), sessionId: 's1' }, at(1))).toBeUndefined()
    expect(bucket.day).toBe('2026-09-01')
  })

  it('accumulates several turns of the same day without reporting', () => {
    const bucket = new DailyUsageAccumulator()
    bucket.observe({ totals: usage(100, 50), sessionId: 's1' }, at(1, 9))
    bucket.observe({ totals: usage(20, 10, { reasoningTokens: 5 }), sessionId: 's1' }, at(1, 10))
    bucket.observe({ totals: usage(1, 2), sessionId: 's2' }, at(1, 11))

    const finished = bucket.rollover(at(2, 0, 5))
    expect(finished?.day).toBe('2026-09-01')
    expect(finished?.totals).toEqual({
      day: '2026-09-01',
      inputTokens: 121,
      outputTokens: 62,
      reasoningTokens: 5,
      turns: 3,
      sessions: 2,
    })
  })

  it('reports a day once, then starts the new day empty', () => {
    const bucket = new DailyUsageAccumulator()
    bucket.observe({ totals: usage(10, 5), sessionId: 's1' }, at(1))
    expect(bucket.rollover(at(2))?.totals.turns).toBe(1)
    expect(bucket.rollover(at(3))).toBeUndefined()
    expect(bucket.day).toBe('2026-09-03')
  })

  it('never reports a day without reported usage', () => {
    const bucket = new DailyUsageAccumulator()
    expect(bucket.observe(undefined, at(1))).toBeUndefined()
    expect(bucket.rollover(at(2))).toBeUndefined()
    expect(bucket.day).toBe('2026-09-02')
  })

  it('reports only the accumulated day when several days pass', () => {
    const bucket = new DailyUsageAccumulator()
    bucket.observe({ totals: usage(10, 5), sessionId: 's1' }, at(1))
    // No events on Sep 2 at all: the bucket still holds Sep 1.
    const finished = bucket.observe({ totals: usage(7, 3), sessionId: 's2' }, at(3))
    expect(finished?.day).toBe('2026-09-01')
    expect(finished?.totals.inputTokens).toBe(10)
    expect(bucket.day).toBe('2026-09-03')
  })

  it('keeps a turn that ends after midnight out of the previous day', () => {
    const bucket = new DailyUsageAccumulator()
    bucket.observe({ totals: usage(100, 50), sessionId: 's1' }, at(1, 23, 59))
    // The turn ends at 00:01 — its usage belongs to the new day, while the
    // finished report still covers only what Sep 1 accumulated.
    const finished = bucket.observe({ totals: usage(9, 4), sessionId: 's1' }, at(2, 0, 1))
    expect(finished?.totals).toMatchObject({ day: '2026-09-01', inputTokens: 100, outputTokens: 50, turns: 1 })

    const next = bucket.rollover(at(3))
    expect(next?.totals).toMatchObject({ day: '2026-09-02', inputTokens: 9, outputTokens: 4, turns: 1 })
  })

  it('omits optional token fields no turn ever reported', () => {
    const bucket = new DailyUsageAccumulator()
    bucket.observe({ totals: usage(10, 5), sessionId: 's1' }, at(1))
    const totals = bucket.rollover(at(2))?.totals
    expect(totals).toBeDefined()
    expect(totals !== undefined && 'cacheReadTokens' in totals).toBe(false)
    expect(totals !== undefined && 'cacheWriteTokens' in totals).toBe(false)
    expect(totals !== undefined && 'reasoningTokens' in totals).toBe(false)
  })

  it('counts sessions without a session id as turns only', () => {
    const bucket = new DailyUsageAccumulator()
    bucket.observe({ totals: usage(1, 1) }, at(1))
    bucket.observe({ totals: usage(1, 1), sessionId: 's1' }, at(1))
    const totals = bucket.rollover(at(2))?.totals
    expect(totals).toMatchObject({ turns: 2, sessions: 1 })
  })

  it('reset drops the in-flight day', () => {
    const bucket = new DailyUsageAccumulator()
    bucket.observe({ totals: usage(10, 5), sessionId: 's1' }, at(1))
    bucket.reset()
    expect(bucket.day).toBeUndefined()
    expect(bucket.rollover(at(2))).toBeUndefined()
    expect(bucket.day).toBe('2026-09-02')
  })
})

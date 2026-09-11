/**
 * Local calendar day key (`YYYY-MM-DD`). Local — not UTC — because a daily
 * report should follow the machine's day boundary the way the user reads
 * costs; `toISOString` would put the boundary in the wrong place.
 */
export function localDayKey(date = new Date()) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}
/**
 * Read the turn usage already flattened onto a hook context (the same numbers
 * a `turn/end` hook sees, so a `usage/daily` report and the per-turn variables
 * always agree). Returns undefined when the turn reported no accounting.
 */
export function usageTotalsFromContext(ctx) {
    if (ctx.usageInputTokens === undefined && ctx.usageOutputTokens === undefined)
        return undefined;
    return {
        inputTokens: ctx.usageInputTokens ?? 0,
        outputTokens: ctx.usageOutputTokens ?? 0,
        ...(ctx.usageCacheReadTokens !== undefined ? { cacheReadTokens: ctx.usageCacheReadTokens } : {}),
        ...(ctx.usageCacheWriteTokens !== undefined ? { cacheWriteTokens: ctx.usageCacheWriteTokens } : {}),
        ...(ctx.usageReasoningTokens !== undefined ? { reasoningTokens: ctx.usageReasoningTokens } : {}),
    };
}
/**
 * In-memory daily usage bucket behind the synthetic `usage/daily` event.
 *
 * `observe` is the single entry point: it rolls the calendar day over first
 * (returning the finished day's report exactly once), then records the
 * observation into the new day. Rolling over *before* recording is what keeps
 * a turn ending just after midnight out of the previous day's totals.
 */
export class DailyUsageAccumulator {
    #day;
    #bucket;
    /** The day currently accumulated; `undefined` before the first observation. */
    get day() {
        return this.#day;
    }
    /**
     * Roll the day over if needed, then record one observation.
     *
     * Returns the finished day's totals when this call crossed a day boundary
     * and that day had reported usage — `undefined` on an ordinary call, on the
     * first observation of a process (nothing accumulated yet), and for a day
     * without usage (an empty report is noise, not a report).
     */
    observe(observation, now = new Date()) {
        const finished = this.rollover(now);
        if (observation !== undefined)
            this.#record(observation);
        return finished;
    }
    /**
     * Detect a calendar-day rollover without recording anything, so the first
     * event after midnight can report the day that just ended.
     */
    rollover(now = new Date()) {
        const today = localDayKey(now);
        if (this.#day === undefined) {
            this.#day = today;
            return undefined;
        }
        if (this.#day === today)
            return undefined;
        const bucket = this.#bucket;
        const day = this.#day;
        this.#day = today;
        this.#bucket = undefined;
        if (bucket === undefined)
            return undefined;
        return {
            day,
            totals: {
                day,
                inputTokens: bucket.inputTokens,
                outputTokens: bucket.outputTokens,
                ...(bucket.cacheReadTokens !== undefined ? { cacheReadTokens: bucket.cacheReadTokens } : {}),
                ...(bucket.cacheWriteTokens !== undefined ? { cacheWriteTokens: bucket.cacheWriteTokens } : {}),
                ...(bucket.reasoningTokens !== undefined ? { reasoningTokens: bucket.reasoningTokens } : {}),
                turns: bucket.turns,
                sessions: bucket.sessions.size,
            },
        };
    }
    /** Drop all state (plugin dispose). */
    reset() {
        this.#day = undefined;
        this.#bucket = undefined;
    }
    #record(observation) {
        const bucket = (this.#bucket ??= { inputTokens: 0, outputTokens: 0, turns: 0, sessions: new Set() });
        bucket.inputTokens += observation.totals.inputTokens;
        bucket.outputTokens += observation.totals.outputTokens;
        if (observation.totals.cacheReadTokens !== undefined) {
            bucket.cacheReadTokens = (bucket.cacheReadTokens ?? 0) + observation.totals.cacheReadTokens;
        }
        if (observation.totals.cacheWriteTokens !== undefined) {
            bucket.cacheWriteTokens = (bucket.cacheWriteTokens ?? 0) + observation.totals.cacheWriteTokens;
        }
        if (observation.totals.reasoningTokens !== undefined) {
            bucket.reasoningTokens = (bucket.reasoningTokens ?? 0) + observation.totals.reasoningTokens;
        }
        bucket.turns += 1;
        if (observation.sessionId !== undefined)
            bucket.sessions.add(observation.sessionId);
    }
}

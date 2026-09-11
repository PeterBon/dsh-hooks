import type { HookRunRecord } from './history.js';
/** Bytes of the file tail read for the initial backfill. */
export declare const TAIL_BACKFILL_BYTES: number;
export interface TailBatch {
    /** Parsed records of the complete lines in this batch, in file order. */
    records: HookRunRecord[];
    /** The same lines verbatim, for `--json` passthrough. */
    lines: string[];
    /** The file shrank (rotation/truncation) and reading restarted from 0. */
    reset: boolean;
}
/** Optional filters for `tail` (all are AND-ed; unset means "no filter"). */
export interface TailFilter {
    /** Exact event name (`turn/end`, …). */
    event?: string;
    /** Exact outcome (`exit-nonzero`, `send-failed`, …). */
    outcome?: string;
    /** Substring of the hook identity (the rendered command / `notify:<channel>`). */
    hook?: string;
}
/** Does a record pass every configured filter? */
export declare function matchesTailFilter(record: HookRunRecord, filter: TailFilter): boolean;
/** One human-readable line, aligned with the Web GUI's history timeline. */
export declare function formatTailRecord(record: HookRunRecord): string;
export declare class HistoryTailer {
    #private;
    readonly file: string;
    constructor(file: string);
    /** Bytes already consumed (the next read starts here). */
    get offset(): number;
    /**
     * The last `limit` records (`limit <= 0` = all of them), read from at most
     * `maxBytes` of the file tail so a large log is never slurped just to print
     * a few lines. Leaves the reader positioned at EOF, so the following
     * {@link readNew} only reports what is appended afterwards.
     */
    backfill(limit?: number, maxBytes?: number): HookRunRecord[];
    /**
     * Complete lines appended since the previous call. A file that shrank since
     * then was rotated/truncated: reading restarts from 0 and `reset` is set so
     * the caller can say so out loud.
     */
    readNew(): TailBatch;
}

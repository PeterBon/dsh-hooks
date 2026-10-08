/** One recorded hook execution. No secrets: env vars never enter records. */
export interface HookRunRecord {
    /** Epoch milliseconds when the record was written. */
    ts: number;
    /** `run` (spawned command) or `notify` (built-in channel). */
    kind: 'run' | 'notify';
    event: string;
    /** Rendered command (`run`) or `notify:<channel>` (`notify`). */
    command: string;
    sessionId?: string;
    sessionName?: string;
    outcome: 'spawned' | 'spawn-failed' | 'timeout' | 'exit-0' | 'exit-nonzero' | 'skipped' | 'sent' | 'send-failed';
    exitCode?: number;
    durationMs?: number;
    /** stderr tail or error message. */
    error?: string;
}
export declare const DEFAULT_HISTORY_PATH: string;
export declare const DEFAULT_HISTORY_MAX = 500;
/**
 * Compact the JSONL file once it grows past this many bytes. Without a cap the
 * append-only log grows forever (every trigger writes at least a `spawned` and
 * a terminal record), and the startup seed has to read all of it.
 */
export declare const DEFAULT_HISTORY_MAX_BYTES: number;
/** Newest bytes read when seeding from (or compacting) a large file. */
export declare const DEFAULT_HISTORY_TAIL_BYTES: number;
export interface HistorySinkOptions {
    /** Whether to persist records to disk. Defaults to true. */
    enabled?: boolean;
    /** JSONL file path. Defaults to ~/.dsh/dsh-hooks/history.jsonl. */
    path?: string;
    /** In-memory ring buffer size. Defaults to 500. */
    max?: number;
    /**
     * Compact the file once it exceeds this size; `0` never compacts.
     * Defaults to {@link DEFAULT_HISTORY_MAX_BYTES}.
     */
    maxBytes?: number;
    /** Newest bytes read when seeding/compacting. Defaults to {@link DEFAULT_HISTORY_TAIL_BYTES}. */
    tailBytes?: number;
}
export interface HistorySink {
    record(record: Omit<HookRunRecord, 'ts'>): void;
    /** Most recent records, oldest first. */
    recent(): readonly HookRunRecord[];
    /**
     * Ingest JSONL bytes appended since the last read (startup seed or another
     * process). Idempotent and best-effort: failures leave the buffer as-is.
     */
    sync(): void;
    dispose(): void;
}
export declare function createHistorySink(options?: HistorySinkOptions): HistorySink;

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
import { appendFileSync, chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, renameSync, statSync, writeFileSync, } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
export const DEFAULT_HISTORY_PATH = join(homedir(), '.dsh', 'dsh-hooks', 'history.jsonl');
export const DEFAULT_HISTORY_MAX = 500;
/**
 * Compact the JSONL file once it grows past this many bytes. Without a cap the
 * append-only log grows forever (every trigger writes at least a `spawned` and
 * a terminal record), and the startup seed has to read all of it.
 */
export const DEFAULT_HISTORY_MAX_BYTES = 2 * 1024 * 1024;
/** Newest bytes read when seeding from (or compacting) a large file. */
export const DEFAULT_HISTORY_TAIL_BYTES = 512 * 1024;
export function createHistorySink(options = {}) {
    const enabled = options.enabled ?? true;
    const file = options.path ?? DEFAULT_HISTORY_PATH;
    const max = options.max ?? DEFAULT_HISTORY_MAX;
    const maxBytes = options.maxBytes ?? DEFAULT_HISTORY_MAX_BYTES;
    const tailBytes = options.tailBytes ?? DEFAULT_HISTORY_TAIL_BYTES;
    const buffer = [];
    let dirReady = false;
    let chmodded = false;
    /** Bytes of `file` already ingested into the buffer. */
    let syncedBytes = 0;
    /** Trailing fragment of the last read that did not end with a newline. */
    let pending = '';
    function push(entry) {
        buffer.push(entry);
        if (buffer.length > max)
            buffer.splice(0, buffer.length - max);
    }
    /**
     * Newest `bytes` of the file as text, cut at the first line boundary so the
     * result starts on a complete record. Bounds both the startup seed and
     * compaction: a multi-gigabyte log must not be read into memory whole.
     */
    function readTail(bytes) {
        const size = statSync(file).size;
        if (size <= bytes)
            return readFileSync(file, 'utf8');
        const fd = openSync(file, 'r');
        try {
            const chunk = Buffer.allocUnsafe(bytes);
            let total = 0;
            while (total < bytes) {
                const n = readSync(fd, chunk, total, bytes - total, size - bytes + total);
                if (n <= 0)
                    break;
                total += n;
            }
            const text = chunk.subarray(0, total).toString('utf8');
            const firstBreak = text.indexOf('\n');
            return firstBreak === -1 ? '' : text.slice(firstBreak + 1);
        }
        finally {
            closeSync(fd);
        }
    }
    /** Parse complete JSONL lines into the ring buffer; incomplete tails stay pending. */
    function ingest(text) {
        pending += text;
        const lines = pending.split('\n');
        pending = lines.pop() ?? '';
        for (const line of lines) {
            if (line === '')
                continue;
            try {
                const entry = JSON.parse(line);
                if (typeof entry !== 'object' || entry === null || typeof entry.ts !== 'number')
                    continue;
                push(entry);
            }
            catch {
                // Broken line (mid-write or foreign content): skip, never fail.
            }
        }
    }
    /** Rebuild the buffer from the file's newest bytes (startup seed / truncated file). */
    function rebuild() {
        buffer.length = 0;
        pending = '';
        syncedBytes = 0;
        const text = readTail(tailBytes);
        syncedBytes = statSync(file).size;
        ingest(text);
    }
    /**
     * Rewrite the file with only its newest bytes, once it grows past the cap.
     * Atomic (temp file + rename) so a crash cannot leave a half-written log; the
     * buffer is refilled from what was kept, so the panel keeps showing the tail.
     */
    function compact() {
        // Keep the newest records, but never more than the cap itself: `tailBytes`
        // may exceed `maxBytes` (a caller can set a small cap on purpose).
        const keepBytes = Math.min(tailBytes, maxBytes);
        const kept = keepBytes <= 0 ? [] : readTail(keepBytes).split('\n').filter((line) => line !== '');
        const temp = `${file}.tmp-${process.pid}`;
        writeFileSync(temp, kept.length === 0 ? '' : kept.join('\n') + '\n', { encoding: 'utf8', mode: 0o600 });
        renameSync(temp, file);
        buffer.length = 0;
        pending = '';
        ingest(kept.length === 0 ? '' : kept.join('\n') + '\n');
        syncedBytes = statSync(file).size;
    }
    /** Seed the ring buffer from an existing JSONL log (best-effort). */
    function seed() {
        if (!enabled)
            return;
        try {
            if (!existsSync(file))
                return;
            rebuild();
        }
        catch {
            // Seeding is best-effort; recording starts from an empty buffer.
        }
    }
    /** Ingest every byte appended since the last read (own writes included). */
    function sync() {
        if (!enabled)
            return;
        try {
            if (!existsSync(file))
                return;
            const size = statSync(file).size;
            if (size === syncedBytes)
                return;
            if (size < syncedBytes) {
                // The file shrank (rotation/truncation): rebuild from its tail.
                rebuild();
                return;
            }
            const deltaBytes = size - syncedBytes;
            const fd = openSync(file, 'r');
            try {
                const chunk = Buffer.allocUnsafe(deltaBytes);
                let total = 0;
                while (total < deltaBytes) {
                    const n = readSync(fd, chunk, total, deltaBytes - total, syncedBytes + total);
                    if (n <= 0)
                        break;
                    total += n;
                }
                ingest(chunk.subarray(0, total).toString('utf8'));
            }
            finally {
                closeSync(fd);
            }
            syncedBytes = size;
        }
        catch {
            // Sync is best-effort; the next call retries.
        }
    }
    function record(partial) {
        const entry = { ...partial, ts: Date.now() };
        // Ingest other processes' appends BEFORE our own entry so the buffer
        // stays in file order, and `syncedBytes` stays a true prefix of the
        // file (otherwise our own advance would skip the foreign appends).
        // Residual race: an append landing between this sync and our write below
        // advances the cursor past it, so that record stays on disk but never
        // enters the ring buffer until the next rebuild.
        if (enabled)
            sync();
        push(entry);
        if (!enabled)
            return;
        try {
            if (!dirReady) {
                mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
                dirReady = true;
            }
            // Create owner-only (mode applies at creation; an existing file keeps
            // its mode and is chmodded below).
            appendFileSync(file, JSON.stringify(entry) + '\n', { encoding: 'utf8', mode: 0o600 });
            const size = statSync(file).size;
            syncedBytes = size;
            if (!chmodded) {
                try {
                    chmodSync(file, 0o600);
                    chmodded = true;
                }
                catch {
                    // Windows: ACL-based protection; the file lives under the user
                    // profile. Left unset so a later write retries the chmod.
                }
            }
            if (maxBytes > 0 && size > maxBytes)
                compact();
        }
        catch {
            // History is best-effort: a failed write never breaks a hook.
        }
    }
    seed();
    return {
        record,
        recent: () => buffer,
        sync,
        dispose: () => { },
    };
}

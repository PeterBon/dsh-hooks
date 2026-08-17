/**
 * Hook execution history: an in-memory ring buffer plus a best-effort
 * JSONL append log under ~/.dsh/dsh-hooks/ (0600, owner-only). History is
 * strictly best-effort — a failed write never breaks a hook.
 */
import { appendFileSync, chmodSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
export const DEFAULT_HISTORY_PATH = join(homedir(), '.dsh', 'dsh-hooks', 'history.jsonl');
export const DEFAULT_HISTORY_MAX = 500;
export function createHistorySink(options = {}) {
    const enabled = options.enabled ?? true;
    const file = options.path ?? DEFAULT_HISTORY_PATH;
    const max = options.max ?? DEFAULT_HISTORY_MAX;
    const buffer = [];
    let dirReady = false;
    let chmodded = false;
    function record(partial) {
        const entry = { ...partial, ts: Date.now() };
        buffer.push(entry);
        if (buffer.length > max)
            buffer.splice(0, buffer.length - max);
        if (!enabled)
            return;
        try {
            if (!dirReady) {
                mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
                dirReady = true;
            }
            appendFileSync(file, JSON.stringify(entry) + '\n', 'utf8');
            if (!chmodded) {
                try {
                    chmodSync(file, 0o600);
                }
                catch {
                    // Windows: ACL-based protection; the file lives under the user profile.
                }
                chmodded = true;
            }
        }
        catch {
            // History is best-effort: a failed write never breaks a hook.
        }
    }
    return {
        record,
        recent: () => buffer,
        dispose: () => { },
    };
}

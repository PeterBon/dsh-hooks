/**
 * Feishu QR-scan session manager for the web routes: one in-flight
 * `registerApp` flow at a time, polled by the settings card. The start
 * promise resolves as soon as the QR authorization is ready (so the UI can
 * render the code immediately), while the scan wait and file writes finish
 * in the background and surface through `status()`.
 */
import { runFeishuSetup } from './feishu.js';
export const FEISHU_SETUP_BUSY = '已有进行中的扫码会话，请先取消或等待完成';
/** Render the QR as a PNG data URL (the qrcode package loads lazily). */
export async function renderFeishuQr(url) {
    const { default: QRCode } = await import('qrcode');
    return QRCode.toDataURL(url, { width: 320, margin: 1 });
}
export function createFeishuSetupManager(deps = {}) {
    const runSetup = deps.runSetup ?? runFeishuSetup;
    const renderQr = deps.renderQr ?? renderFeishuQr;
    const now = deps.now ?? Date.now;
    const paths = deps.paths;
    let current = null;
    let controller = null;
    let cancelled = false;
    async function start(profile = 'web', options = {}) {
        if (current?.status === 'pending')
            throw new Error(FEISHU_SETUP_BUSY);
        cancelled = false;
        const ac = new AbortController();
        controller = ac;
        const signal = ac.signal;
        const startedAt = now();
        const snapshot = { status: 'pending', startedAt };
        current = snapshot;
        let resolveReady;
        const ready = new Promise((resolve) => {
            resolveReady = resolve;
        });
        const task = (async () => {
            try {
                const result = await runSetup({
                    profile,
                    signal,
                    paths,
                    resultMaxChars: options.resultMaxChars,
                    onQRCodeReady: async (qr) => {
                        snapshot.qrUrl = qr.url;
                        snapshot.expiresAtMs = startedAt + qr.expireIn * 1000;
                        try {
                            snapshot.qrDataUrl = await renderQr(qr.url);
                        }
                        catch {
                            // QR 图像渲染失败不阻塞扫码：UI 回退为授权链接。
                        }
                        resolveReady({ ...snapshot });
                    },
                });
                if (cancelled)
                    return;
                current = { status: 'succeeded', startedAt, appId: result.appId };
            }
            catch (error) {
                if (cancelled)
                    return;
                current = {
                    status: 'failed',
                    startedAt,
                    error: error instanceof Error ? error.message : String(error),
                };
            }
        })();
        // Resolve when the QR is ready; if the flow settles first (no QR callback
        // or an immediate failure), report the terminal snapshot instead.
        const cancelledOutcome = { status: 'failed', startedAt, error: '已取消' };
        return await Promise.race([
            ready,
            task.then(() => current ?? cancelledOutcome),
        ]);
    }
    function status() {
        return current;
    }
    function cancel() {
        if (current?.status !== 'pending')
            return false;
        cancelled = true;
        controller?.abort();
        controller = null;
        current = null;
        return true;
    }
    function dispose() {
        cancel();
    }
    return { start, status, cancel, dispose };
}

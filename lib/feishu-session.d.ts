/**
 * Feishu QR-scan session manager for the web routes: one in-flight
 * `registerApp` flow at a time, polled by the settings card. The start
 * promise resolves as soon as the QR authorization is ready (so the UI can
 * render the code immediately), while the scan wait and file writes finish
 * in the background and surface through `status()`.
 */
import { runFeishuSetup, type FeishuSetupPaths } from './feishu.js';
export type FeishuSetupStatus = 'pending' | 'succeeded' | 'failed';
/** Display-only snapshot; credentials never enter any field. */
export interface FeishuSetupSnapshot {
    status: FeishuSetupStatus;
    /** Epoch ms when the flow started (server clock). */
    startedAt: number;
    /** Epoch ms when the QR authorization expires (pending only). */
    expiresAtMs?: number;
    /** Feishu authorization URL (pending only). */
    qrUrl?: string;
    /** PNG data URL of the QR code (pending only; best-effort). */
    qrDataUrl?: string;
    /** Created app id (succeeded only, unmasked — it is not a secret). */
    appId?: string;
    /** Failure message (failed only). */
    error?: string;
}
export declare const FEISHU_SETUP_BUSY = "\u5DF2\u6709\u8FDB\u884C\u4E2D\u7684\u626B\u7801\u4F1A\u8BDD\uFF0C\u8BF7\u5148\u53D6\u6D88\u6216\u7B49\u5F85\u5B8C\u6210";
/** Render the QR as a PNG data URL (the qrcode package loads lazily). */
export declare function renderFeishuQr(url: string): Promise<string>;
export interface FeishuSetupManagerDeps {
    runSetup?: typeof runFeishuSetup;
    renderQr?: (url: string) => Promise<string>;
    /** Clock override for tests. */
    now?: () => number;
    paths?: FeishuSetupPaths;
}
export interface FeishuSetupManager {
    /** Start one scan flow; rejects when another flow is still pending. */
    start(profile?: string, options?: {
        resultMaxChars?: number;
    }): Promise<FeishuSetupSnapshot>;
    /** Current snapshot, or null when idle. */
    status(): FeishuSetupSnapshot | null;
    /** Abort the pending flow. Returns false when nothing was pending. */
    cancel(): boolean;
    dispose(): void;
}
export declare function createFeishuSetupManager(deps?: FeishuSetupManagerDeps): FeishuSetupManager;

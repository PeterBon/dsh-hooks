/**
 * @PeterBon/dsh-hooks-ui — client entry. Re-exports the browser half so
 * tsdown can derive both bundle entries from package.json exports (the host
 * half lives at src/index.ts; this file maps to exports "./client").
 */
export { apply, name } from './client/index.ts'
export type { HooksPanelProps } from './client/panel.tsx'
export type { HistoryRecord, StatusInfo, TestLine, TestRequest, TestResult } from './client/api.ts'

/**
 * Drawer panel mounting: one lazily-created React root in a fixed-position
 * host. The stylesheet is bundled as a string (`.css?inline`) and injected
 * once as a <style> tag — no separate CSS asset for the shell to load.
 */
import { createRoot, type Root } from 'react-dom/client'
import { HooksPanel } from './panel.tsx'
import panelCss from './panel.module.css?inline'

const STYLE_ID = 'dsh-hooks-ui-style'
let root: Root | undefined
let host: HTMLElement | undefined

function injectStyle(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = panelCss
  document.head.appendChild(style)
}

function ensureHost(): HTMLElement {
  if (host === undefined || !host.isConnected) {
    host = document.createElement('div')
    host.dataset.dshHooksPanelHost = ''
    document.body.appendChild(host)
  }
  return host
}

function show(): void {
  injectStyle()
  const target = ensureHost()
  if (root === undefined) {
    root = createRoot(target)
    root.render(<HooksPanel onClose={hide} />)
  }
}

function hide(): void {
  root?.unmount()
  root = undefined
  host?.remove()
  host = undefined
  document.getElementById(STYLE_ID)?.remove()
}

export interface PanelHandle {
  toggle: () => void
  dispose: () => void
}

/** Create the panel controller the sidebar entry toggles. */
export function mountPanel(): PanelHandle {
  return {
    toggle: () => {
      if (root !== undefined) hide()
      else show()
    },
    dispose: () => hide(),
  }
}

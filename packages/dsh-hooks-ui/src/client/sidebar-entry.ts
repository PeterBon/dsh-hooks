/**
 * Sidebar entry injection (dsh-task-board precedent, simplified).
 *
 * dsh's sidebar shell exposes no slot an external plugin can register into,
 * so the entry row is injected next to the New Session button and self-heals
 * through MutationObservers whenever a React re-render displaces it. The row
 * is plain DOM — it can never disturb the shell's reconciliation.
 */

/** Stable data attribute identifying the injected entry row. */
const ENTRY_SELECTOR = '[data-dsh-hooks-entry]'

const ICON =
  '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 2.5v3a2 2 0 0 0 2 2h1"/><path d="M12 13.5v-3a2 2 0 0 0-2-2H9"/><path d="M9.5 5.5 12 8l-2.5 2.5"/><circle cx="7" cy="8" r="0.8" fill="currentColor" stroke="none"/></svg>'

function sidebarRoot(): HTMLElement | undefined {
  const column = document.querySelector<HTMLElement>('[data-pane="sidebar"], [class*="sidebarCol"]')
  if (column === null) return undefined
  const logoOwner = column.querySelector<HTMLElement>('[class*="logoRow"]')?.parentElement
  return logoOwner ?? (column.firstElementChild as HTMLElement | undefined)
}

function newSessionButton(root: HTMLElement): HTMLButtonElement | undefined {
  const nested = root.querySelector<HTMLButtonElement>('button[class*="newSession"]')
  if (nested !== null) return nested
  for (const child of root.children) {
    if (child.tagName === 'BUTTON') return child as HTMLButtonElement
  }
  return undefined
}

export interface SidebarEntryController {
  toggle(): void
}

/**
 * Mount the sidebar entry row. Idempotent per page: a duplicated apply (or
 * stale HMR module) never mounts a second row.
 */
export function mountSidebarEntry(controller: SidebarEntryController): () => void {
  if (typeof document === 'undefined') return () => {}
  if (document.querySelector(ENTRY_SELECTOR) !== null) return () => {}

  const entry = document.createElement('button')
  entry.type = 'button'
  entry.dataset.dshHooksEntry = ''
  entry.setAttribute('aria-label', 'Hooks')
  entry.style.cssText =
    'display:flex;align-items:center;gap:6px;width:100%;padding:7px 10px;border:none;background:transparent;color:inherit;font-size:13px;cursor:pointer;border-radius:6px;'
  entry.innerHTML = `<span>${ICON}</span><span>Hooks</span>`
  entry.addEventListener('mouseenter', () => {
    entry.style.background = 'rgba(128,132,144,0.14)'
  })
  entry.addEventListener('mouseleave', () => {
    entry.style.background = 'transparent'
  })
  entry.addEventListener('click', () => controller.toggle())

  let root: HTMLElement | undefined
  let placed = false

  const place = (): void => {
    if (root !== undefined && !root.isConnected) {
      rootObserver.disconnect()
      root = undefined
      placed = false
    }
    if (placed) {
      if (document.body.contains(entry)) return
      rootObserver.disconnect()
      root = undefined
      placed = false
    }
    root ??= sidebarRoot()
    if (root === undefined) return
    const button = newSessionButton(root)
    if (button === undefined) return
    const family = Array.from(root.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement && el.matches('[data-dsh-hooks-entry], [data-dsh-taskboard-entry], [data-dsh-ssh-entry]'),
    )
    const row = button.closest('[class*="logoRow"]')
    const base = row !== null && row.parentElement === root ? row : button
    const anchor = family.length > 0 ? family[0] : base.nextElementSibling
    root.insertBefore(entry, anchor)
    placed = true
    rootObserver.observe(root, { childList: true, subtree: true })
  }

  const waitObserver = new MutationObserver(() => place())
  waitObserver.observe(document.body, { childList: true, subtree: true })
  const rootObserver = new MutationObserver(() => {
    if (root === undefined || !root.isConnected) {
      placed = false
      place()
      return
    }
    if (!root.contains(entry)) place()
  })

  place()

  return () => {
    waitObserver.disconnect()
    rootObserver.disconnect()
    entry.remove()
  }
}

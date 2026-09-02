/**
 * Which mount is rendering — the 380px side panel, or the full browser tab.
 *
 * A module flag rather than a prop threaded through App → LeadWorkspace →
 * CallHud, and rather than a CSS media query: the prop chain touches four
 * components that have no other reason to know, and a media query cannot be
 * asserted in jsdom, so the layout would ship untested.
 *
 * The call entrypoint calls markWide() before render; nothing else does.
 * Components take an explicit `layout` prop for tests and fall back to this.
 */
let wide = false

export function markWideSurface(): void {
  wide = true
}

export function isWideSurface(): boolean {
  return wide
}

/** Tests only — the flag is process-global, so a wide test would leak. */
export function resetWideSurface(): void {
  wide = false
}

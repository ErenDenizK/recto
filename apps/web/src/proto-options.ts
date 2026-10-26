/**
 * Temporary prototype switch for the colour audit's two open board questions (r29, lanes 2 and
 * 5): `?focusopt=a|b|c` picks a light-theme focus ring and `?selopt=a|b|c` a selected-state
 * treatment, written once at boot as `data-focusopt` / `data-selopt` on the root. The options
 * live in `styles/focus.css` and in the selected-state rules of the modules that read
 * `data-selopt`. Dev server and test builds only (`main.tsx`); removed once the board picks.
 */
const OPTIONS = new Set(['a', 'b', 'c']);

export function applyProtoOptions(root: HTMLElement, search: string): void {
  const params = new URLSearchParams(search);
  for (const key of ['focusopt', 'selopt'] as const) {
    const value = params.get(key);
    if (value && OPTIONS.has(value)) root.setAttribute(`data-${key}`, value);
  }
}

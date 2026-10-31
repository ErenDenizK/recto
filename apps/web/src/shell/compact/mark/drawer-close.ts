/**
 * How the drawer closes (`design/phone-2026-10/README.md` §3 "Closing"; EDN-18, the owner: "it
 * shouldn't close right away, so I can make another colour choice or undo"). A tile or row
 * arms its tool and the drawer stays open; it closes by a press outside, a swipe down, the chip,
 * Close or Esc (`use-drawer-panel.ts`), and as New signature's sheet opens (`sign.tsx`).
 *
 * The press outside depends on where the armed tool's next step is:
 *
 * - **On the drawer's own options, or anywhere** (the Eraser, Select, Sign before a signature
 *   is chosen): the press only closes. The transparent scrim takes it, so a tap meant to put
 *   the drawer away never erases or selects.
 * - **A touch on the page** (Pen and Highlight start their stroke, EDN-28; Text places a box,
 *   Edit text opens a paragraph, a chosen signature is placed): the press closes the drawer and goes on to the page, which acts on it in the same
 *   tap. The scrim lets presses through (`pressGoesThrough`) and a window listener closes the
 *   drawer as the press starts (`closeOnOutsidePress`); the keyboard a text box or paragraph
 *   opens still rises within that tap (`TextLayer.tsx`, `keyboard-hold.ts`).
 *
 * A press on the island never closes it: Undo and Redo there work with the drawer open, and
 * the chip closes it itself (`EditIsland.tsx`).
 */
import type { ToolMode } from '../../../viewer/tool-store';
import { setDrawerOpen } from '../compact-store';

/**
 * The tool-store modes whose next step is a touch on the page: a stroke (Pen, Highlight; EDN-28,
 * else the scrim swallowed the first stroke after picking the tool) or a tap (the rest).
 */
const ON_PAGE: ReadonlySet<ToolMode> = new Set<ToolMode>([
  'ink',
  'highlight',
  'text-box',
  'edit-text',
  'signature',
]);

/** Whether a press outside the open drawer goes on to the page under it (EDN-18). */
export function pressGoesThrough(mode: ToolMode): boolean {
  return ON_PAGE.has(mode);
}

/** Presses here never close the drawer: the island (Undo, Redo, the chip, Done). */
const KEEPS_OPEN = '[data-testid="compact-capsule"]';

/**
 * Closes the drawer on any press that starts outside `panel()` and the island, and lets the
 * press go on (capture phase, nothing prevented). Returns the disposer.
 */
export function closeOnOutsidePress(panel: () => Element | null): () => void {
  const onPress = (event: PointerEvent) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (panel()?.contains(target)) return;
    if (target instanceof Element && target.closest(KEEPS_OPEN)) return;
    setDrawerOpen(false);
  };
  window.addEventListener('pointerdown', onPress, { capture: true });
  return () => window.removeEventListener('pointerdown', onPress, { capture: true });
}

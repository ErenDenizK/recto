/**
 * The Esc ladder of the Markup palette and of the Fill & sign bar (`03-markup` §5): Esc disarms
 * to Select, then closes Markup.
 */
import { type KeyboardEvent, useEffect } from 'react';

import { clearAnnotationTools, hasAnnotationToolState } from '../annotations/commands';
import { isEditableTarget } from '../commands/use-shortcuts';
import { isMarkupOpenActive } from '../state/ui-store';
import { closeMarkupDoor } from './doors';

/**
 * The ladder inside the palette and its strip: Esc disarms to Select, then closes Markup. Keys
 * React carries from portals (the editors, menus) are theirs.
 */
export function paletteEscape(event: KeyboardEvent<HTMLElement>): void {
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
  event.preventDefault();
  event.stopPropagation();
  if (hasAnnotationToolState()) clearAnnotationTools();
  else closeMarkupDoor();
}

/**
 * The ladder's last step from the page (§5): with nothing armed or selected (the window's
 * Escape disarmed it on the press before), Esc closes Markup and focus stays on the page. In
 * the bubble phase on the document, so a widget that takes Esc (an editor, a menu, the
 * lasso, a dialog) claims it first, and before the window's shortcut listener.
 */
export function usePageEscape(): void {
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
      const target = event.target;
      if (isEditableTarget(target)) return;
      if (target instanceof Element && target.closest('[aria-modal="true"], [role="dialog"]')) {
        return;
      }
      if (target instanceof Element && target.closest('[data-markup-palette]')) return;
      if (hasAnnotationToolState() || !isMarkupOpenActive()) return;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) return;
      closeMarkupDoor();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}

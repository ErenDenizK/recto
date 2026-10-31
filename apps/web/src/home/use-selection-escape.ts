/**
 * The Library's Esc ladder from anywhere in the view (`02-library` L1 §6): Esc clears the checks,
 * then leaves Select mode; it never navigates. The grid handles its own Esc and marks it
 * handled; an Esc inside a dialog or menu is theirs. Shared by the Library and the desk
 * (DSN-87).
 */
import type { DocumentId } from '@pdf-editor/document-model';
import { useEffect } from 'react';

import { useUiStore } from '../state/ui-store';
import { enterSelecting, setSelecting } from './library-store';

export function useSelectionEscape(selecting: boolean, selection: readonly DocumentId[]): void {
  useEffect(() => {
    if (!selecting) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('[role="dialog"], [role="menu"]')) {
        return;
      }
      if (selection.length > 0) {
        enterSelecting();
        useUiStore.getState().setHomeSelection([], null);
      } else setSelecting(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selecting, selection]);
}

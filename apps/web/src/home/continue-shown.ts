/**
 * Whether the Continue card is on screen (DSN-66): the view has one lime (ADR-0023, C-5), so while
 * the card shows, Continue keeps it and Open PDFs / Open PDF drops to the secondary fill; without
 * the card, Open is the primary again. The card sets it (`ContinueView`); the full edition's
 * launcher and the phone's dock read it. Tiny and dependency-free, so the phone's chunk can read it.
 */
import { create } from 'zustand';

export const useContinueShown = create<{ readonly shown: boolean }>()(() => ({ shown: false }));

export function setContinueShown(shown: boolean): void {
  useContinueShown.setState({ shown });
}

/**
 * The selection chrome the annotation layer draws, replaceable by an edition
 * (`design/phone-2026-10/README.md` §4 "Placing a signature selects it, with handles sized for
 * touch"; code-audit risks: "AnnotationBar handles too small for touch"). The full edition keeps
 * the default: 8 px handles on every side and the contextual bar (`AnnotationBar`). The phone's
 * editing chunk installs touch chrome (`shell/compact/mark/touch-chrome.ts`): corner handles
 * drawn larger, each inside a 48 px hit square (Q-9), and its own small bar in place of the
 * desktop one.
 */
import type { Annotation } from '@pdf-editor/engine';
import { type ComponentType, useSyncExternalStore } from 'react';

import type { PageTarget } from './annotation-store';
import type { PageFrame } from './geometry';

/** What the selection's bar receives (as `AnnotationBar`, without a lasso). */
export interface SelectionBarProps {
  readonly target: PageTarget;
  readonly annotations: readonly Annotation[];
  readonly frame: PageFrame;
}

export interface SelectionChrome {
  /** The drawn handle's side, CSS px. */
  readonly handle: number;
  /** The invisible hit square around each handle, CSS px (0: the drawn handle only). */
  readonly hit: number;
  /** Only the four corners resize (a touch target on every side would crowd a small box). */
  readonly cornersOnly: boolean;
  /** The bar shown for a selection other than a lasso's; null keeps `AnnotationBar`. */
  readonly Bar: ComponentType<SelectionBarProps> | null;
}

export const DEFAULT_SELECTION_CHROME: SelectionChrome = {
  handle: 8,
  hit: 0,
  cornersOnly: false,
  Bar: null,
};

let chrome: SelectionChrome = DEFAULT_SELECTION_CHROME;
const listeners = new Set<() => void>();

/** Replaces the selection chrome; the disposer restores the default. */
export function setSelectionChrome(next: SelectionChrome): () => void {
  chrome = next;
  for (const listener of listeners) listener();
  return () => {
    if (chrome !== next) return;
    chrome = DEFAULT_SELECTION_CHROME;
    for (const listener of listeners) listener();
  };
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => chrome;

/** The selection chrome in force, followed. */
export function useSelectionChrome(): SelectionChrome {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

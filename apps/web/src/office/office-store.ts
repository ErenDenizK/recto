/**
 * The Office conversion's state (ADR-0035 §5): which files wait, and the step the sheet shows.
 * Kept tiny and free of the package code, so the open path can hand files over without loading
 * any of it (the flow, the sheet and the download manager are a lazy chunk).
 */
import { create } from 'zustand';

import type { OfficeFailure } from './office-error';

export type OfficeStep =
  /** Looking for the package on the device (or for the stash after the reload). */
  | { readonly kind: 'checking' }
  /** The package is missing: the one-time question. */
  | { readonly kind: 'consent'; readonly downloadBytes: number }
  | { readonly kind: 'downloading'; readonly loaded: number; readonly total: number }
  /** Stashing the files and reloading into cross-origin isolation. */
  | { readonly kind: 'reloading' }
  | {
      readonly kind: 'converting';
      readonly name: string;
      readonly index: number;
      readonly count: number;
      readonly phase: 'starting' | 'converting';
      readonly percent: number | null;
    }
  | {
      readonly kind: 'failed';
      readonly reason: OfficeFailure;
      readonly name?: string | undefined;
      /** Whether "Try again" downloads again (else it converts again). */
      readonly retry: 'download' | 'convert' | null;
    };

export interface OfficeState {
  /** The files to convert; null when the sheet is closed. */
  readonly files: readonly File[] | null;
  /** The files are in the stash: this load follows the reload into isolation. */
  readonly resume: boolean;
  readonly step: OfficeStep;
}

const CLOSED: OfficeState = { files: null, resume: false, step: { kind: 'checking' } };

export const useOfficeStore = create<OfficeState>()(() => CLOSED);

/** Opens the flow for `files` (or for the stash, `resume`). */
export function openOffice(files: readonly File[], resume = false): void {
  useOfficeStore.setState({ files, resume, step: { kind: 'checking' } });
}

export function setOfficeStep(step: OfficeStep): void {
  if (useOfficeStore.getState().files === null) return;
  useOfficeStore.setState({ step });
}

/** Closes the sheet; the flow forgets its files. */
export function closeOffice(): void {
  useOfficeStore.setState(CLOSED);
}

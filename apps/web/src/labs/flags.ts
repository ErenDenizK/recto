/**
 * The flag registry (DSN-82): one list of every feature flag in the app, for the Labs panel in
 * Settings. The readers stay where they are (`office/flag.ts`, `margin-map-flag.ts`, …); each passes
 * its Labs toggle in as its stored value (`labsStored`), so the order is the address, the Labs
 * toggle, what the flag kept itself (`legacy`), then the default. No default is changed here.
 *
 * Pure data and pure functions, no messages: the panel's texts are `labs-text.ts`.
 *
 * - **Switch** flags are `'1'` (on) or `'0'` (off) in Labs and in `legacy`; the address turns
 *   one on with its `on` word (`?home=search`) and off with `0`.
 * - **Choice** flags keep the value itself.
 * - `scan` has no reader on this branch (`scan/scan-flag.ts` lands with its own change); its
 *   row waits here and the reader gets the same one-line `labsStored` call.
 */
import type { LabsState } from './stored';

export type LabsKey =
  | 'margin'
  | 'strip'
  | 'palette'
  | 'labels'
  | 'receipt'
  | 'office'
  | 'open-page'
  | 'open-light'
  | 'home-search'
  | 'home-continue'
  | 'top'
  | 'drawer'
  | 'phone-capsule'
  | 'textpre'
  | 'scan'
  | 'paragraph-frame'
  | 'paragraph-outlines';

export type LabsEdition = 'full' | 'compact' | 'all';

export interface LabsFlag {
  readonly key: LabsKey;
  /** The address parameter. */
  readonly param: string;
  /** `switch` is on or off; `choice` is one of `values`. */
  readonly kind: 'switch' | 'choice';
  /** Switch: the address word that turns it on. Choice: unused. */
  readonly on: string;
  /** Choice: the values, the default among them. */
  readonly values: readonly string[];
  /** The value when nothing sets it. */
  readonly fallback: string;
  /** `prototype` is being tried; `soon` is about to become the default. */
  readonly status: 'prototype' | 'soon';
  /** The edition(s) it changes: desktop and tablet, the phone, or all. */
  readonly edition: LabsEdition;
  /** What the flag keeps by itself, read for the panel and cleared by Reset all. */
  readonly legacy?: { readonly area: 'local' | 'session'; readonly key: string } | undefined;
}

const SWITCH = ['0', '1'] as const;
const sw = (
  key: LabsKey,
  param: string,
  edition: LabsEdition,
  status: LabsFlag['status'],
  legacy?: LabsFlag['legacy'],
  on = '1',
): LabsFlag => ({
  key,
  param,
  kind: 'switch',
  on,
  values: SWITCH,
  fallback: '0',
  status,
  edition,
  legacy,
});
const choice = (
  key: LabsKey,
  param: string,
  values: readonly string[],
  edition: LabsEdition,
  legacy: LabsFlag['legacy'],
): LabsFlag => ({
  key,
  param,
  kind: 'choice',
  on: '1',
  values,
  fallback: values[0] ?? '',
  status: 'prototype',
  edition,
  legacy,
});
const local = (key: string) => ({ area: 'local', key }) as const;
const session = (key: string) => ({ area: 'session', key }) as const;

export const LABS_FLAGS: readonly LabsFlag[] = [
  sw('margin', 'margin', 'full', 'prototype', local('pdf-editor:margin:v1')),
  sw('strip', 'strip', 'all', 'prototype', local('pdf-editor:strip:v1')),
  choice('palette', 'palette', ['row', 'groups', 'labels'], 'full', local('pdf-editor:palette:v1')),
  sw('labels', 'labels', 'full', 'prototype', local('pdf-editor:labels:v1')),
  sw('receipt', 'receipt', 'full', 'soon', session('pdf-editor:receipt:v1')),
  sw('office', 'office', 'all', 'prototype', local('pdf-editor:office:v1')),
  sw('open-page', 'open', 'all', 'prototype', local('pdf-editor:open-page:v1'), 'page'),
  sw('open-light', 'open', 'all', 'prototype', local('pdf-editor:open-light:v1'), 'light'),
  sw('home-search', 'home', 'all', 'soon', local('pdf-editor:home-search:v1'), 'search'),
  sw('home-continue', 'home', 'all', 'soon', local('pdf-editor:home-continue:v1'), 'continue'),
  choice('top', 'top', ['split', 'capsule'], 'compact', session('pdf-editor:top:v1')),
  choice('drawer', 'drawer', ['tiles', 'list'], 'compact', session('pdf-editor:drawer:v1')),
  sw('phone-capsule', 'phonebar', 'compact', 'prototype'),
  sw('textpre', 'textpre', 'all', 'prototype'),
  sw('scan', 'scan', 'all', 'prototype'),
  sw('paragraph-frame', 'paraframe', 'full', 'prototype'),
  sw('paragraph-outlines', 'paraoutlines', 'full', 'prototype'),
];

/** Where a flag's value came from. */
export type LabsSource = 'url' | 'labs' | 'own' | 'default';

export interface LabsResolved {
  readonly value: string;
  readonly source: LabsSource;
}

/** `raw` as one of the flag's values, or undefined (a switch also takes its address word). */
function parse(
  flag: LabsFlag,
  raw: string | null | undefined,
  address: boolean,
): string | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (flag.kind === 'choice') return flag.values.includes(raw) ? raw : undefined;
  if (raw === '0') return '0';
  return raw === (address ? flag.on : '1') ? '1' : undefined;
}

/** The order of DSN-82: the address, the Labs toggle, the flag's own kept value, the default. */
export function resolveFlag(
  flag: LabsFlag,
  search: string,
  labs: LabsState['flags'],
  own: string | null,
): LabsResolved {
  const asked = parse(flag, new URLSearchParams(search).get(flag.param), true);
  if (asked !== undefined) return { value: asked, source: 'url' };
  const toggled = parse(flag, labs[flag.key], false);
  if (toggled !== undefined) return { value: toggled, source: 'labs' };
  const kept = parse(flag, own, false);
  if (kept !== undefined) return { value: kept, source: 'own' };
  return { value: flag.fallback, source: 'default' };
}

function storage(area: 'local' | 'session'): Storage | undefined {
  try {
    return area === 'local' ? localStorage : sessionStorage;
  } catch {
    return undefined;
  }
}

/** What the flag kept by itself (null: nothing, or storage blocked). */
export function ownValue(flag: LabsFlag): string | null {
  if (!flag.legacy) return null;
  try {
    return storage(flag.legacy.area)?.getItem(flag.legacy.key) ?? null;
  } catch {
    return null;
  }
}

/** Forgets what the flag kept by itself (Reset all). */
export function forgetOwnValue(flag: LabsFlag): void {
  if (!flag.legacy) return;
  try {
    storage(flag.legacy.area)?.removeItem(flag.legacy.key);
  } catch {
    // Blocked storage keeps nothing to forget.
  }
}

/** Every flag as it resolves now, for the address `search`. */
export function resolveAll(
  search: string,
  labs: LabsState['flags'],
): ReadonlyMap<LabsKey, LabsResolved> {
  return new Map(
    LABS_FLAGS.map((flag) => [flag.key, resolveFlag(flag, search, labs, ownValue(flag))]),
  );
}

/** Whether any flag is away from its default because of the address (it shows the panel). */
export function anyFlagOnByAddress(search: string): boolean {
  return LABS_FLAGS.some((flag) => {
    const { value, source } = resolveFlag(flag, search, {}, null);
    return source === 'url' && value !== flag.fallback;
  });
}

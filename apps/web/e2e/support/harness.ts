/**
 * The rendered-pixel harness from the spec's side (components/09-primitives.md §28, spec 09.11;
 * docs/specs/redesign.md D3-1): the coverage registry and the harness's backdrops, and opening
 * the harness on one scene.
 *
 * The registry (`src/styles/coverage-registry.ts`) and the backdrops (`harness/backdrops.ts`)
 * belong to the app's TypeScript project, which references this Node one: a static import here
 * would put them in both, which `tsc` refuses (TS6305). So they load at run time, the one copy
 * the harness itself renders from, and the shapes this side reads are restated below; a field
 * that drifts fails the spec on its first scene.
 */
import { expect, type Page } from '@playwright/test';

import { HARNESS_URL } from './harness-server';
import type { Rgb } from './pixels';

export type GlassMode = 'clear' | 'tinted' | 'solid';
export type Theme = 'dark' | 'light';
/** What a module rule composes from `global.css` (`coverage-registry.ts`). */
export type GlassComposition = 'glass' | 'glass glass-menu' | 'glass-frame';

/** The fields of a coverage registry entry the pixel spec reads. */
export interface RegistryEntry {
  readonly id: string;
  readonly composes: GlassComposition;
  /** Its filter token, `--glass-filter` and the like. */
  readonly filter: string;
  readonly minWidth: number;
  readonly minHeight: number;
}

/** A harness backdrop (`harness/backdrops.ts`). */
export interface Backdrop {
  readonly name: string;
  readonly label: string;
  readonly under: Rgb | `--${string}`;
  readonly beyond?: Rgb;
}

export interface HarnessQuery {
  readonly entry: string;
  readonly backdrop: string;
  readonly glass: GlassMode;
  readonly theme: Theme;
}

interface BackdropsModule {
  readonly BACKDROPS: readonly Backdrop[];
  readonly HARNESS_VIEWPORT: { readonly width: number; readonly height: number };
  readonly harnessSearch: (query: HarnessQuery) => string;
  readonly surfaceOrigin: (
    width: number,
    height: number,
  ) => { readonly x: number; readonly y: number };
}

interface RegistryModule {
  readonly COVERAGE_REGISTRY: readonly RegistryEntry[];
}

const load = async <T>(path: string): Promise<T> =>
  (await import(new URL(path, import.meta.url).href)) as T;

const backdrops = await load<BackdropsModule>('../../harness/backdrops.ts');
const registry = await load<RegistryModule>('../../src/styles/coverage-registry.ts');

export const { BACKDROPS, HARNESS_VIEWPORT, harnessSearch, surfaceOrigin } = backdrops;
export const { COVERAGE_REGISTRY } = registry;

/** Opens the harness on one scene and waits until it has painted. */
export async function openHarness(page: Page, query: HarnessQuery): Promise<void> {
  await page.goto(`${HARNESS_URL}${harnessSearch(query)}`);
  const outcome = await page.waitForFunction(() => {
    const { harnessReady, harnessError } = document.documentElement.dataset;
    return harnessError !== undefined ? `error: ${harnessError}` : harnessReady;
  });
  expect(await outcome.jsonValue(), `the harness renders ${harnessSearch(query)}`).toBe('true');
}

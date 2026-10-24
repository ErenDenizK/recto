/**
 * The rename to Recto (ADR-0015, presentation spec §7) changes the names people read, not
 * the names browsers store things under. Renaming a storage name would orphan what users
 * keep on their device (offline packs, recipes, settings), so ADR-0015 §3 keeps them. This
 * test pins those names, plus the display name, so a later search-and-replace cannot move
 * them by accident.
 */
import { RECIPE_FORMAT } from '@pdf-editor/document-model';
import { OCR_CACHE_NAME } from '@pdf-editor/engine';
import { describe, expect, it } from 'vitest';

import viteConfigSource from '../../../vite.config.ts?raw';
import recipesStoreSource from '../../batch/recipes-store.ts?raw';
import openFilesSource from '../../files/open-files.ts?raw';
import recentsSource from '../../files/recents.ts?raw';
import savedSignaturesSource from '../../signatures/saved-signatures.ts?raw';
import { PRODUCT_NAME, REPOSITORY_URL } from './build-info';

/** Every application source file (not tests, not generated messages), as text. */
const appSources = import.meta.glob<string>(
  ['../../**/*.{ts,tsx}', '!../../**/*.test.{ts,tsx}', '!../../i18n/paraglide/**'],
  {
    query: '?raw',
    import: 'default',
    eager: true,
  },
);

/** The quoted string literals in `source` that start with `prefix`. */
function literals(source: string, prefix: string): string[] {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`['"\`](${escaped}[^'"\`\\s]*)['"\`]`, 'g');
  return [...source.matchAll(pattern)].map((match) => match[1] ?? '');
}

describe('names kept by ADR-0015 §3', () => {
  it('shows the product as Recto', () => {
    expect(PRODUCT_NAME).toBe('Recto');
    expect(REPOSITORY_URL).toBe('https://github.com/ErenDenizK/recto');
  });

  it('keeps the three runtime Cache Storage names', () => {
    const cacheNames = [...viteConfigSource.matchAll(/cacheName:\s*'([^']+)'/g)].map(
      (match) => match[1],
    );
    expect(cacheNames).toEqual(['pdf-editor-ocr', 'pdf-editor-wasm', 'pdf-editor-fonts']);
    // The OCR pack loader writes the same cache the service worker reads.
    expect(OCR_CACHE_NAME).toBe('pdf-editor-ocr');
  });

  it('renames the manifest but not the description', () => {
    expect(viteConfigSource).toMatch(/\bname: 'Recto',/);
    expect(viteConfigSource).toMatch(/\bshort_name: 'Recto',/);
  });

  it('keeps the recipe store names: IndexedDB database and OPFS folder', () => {
    expect(recipesStoreSource).toMatch(/const DB_NAME = 'pdf-editor-recipes';/);
    expect(recipesStoreSource).toMatch(/getDirectoryHandle\('recipes'/);
  });

  it('keeps the recents IndexedDB database name', () => {
    expect(recentsSource).toMatch(/export const RECENTS_DB_NAME = 'pdf-editor:recents:v1';/);
  });

  it('keeps the saved signatures IndexedDB database name', () => {
    expect(savedSignaturesSource).toMatch(
      /export const SAVED_SIGNATURES_DB = 'pdf-editor:signatures:v1';/,
    );
  });

  it('keeps the recipe format identifier that shared recipe files carry', () => {
    expect(RECIPE_FORMAT).toBe('pdf-editor-recipe');
  });

  it('keeps the file-picker ids that remember folders', () => {
    expect(literals(openFilesSource, 'pdf-editor-').sort()).toEqual([
      'pdf-editor-images',
      'pdf-editor-open',
      'pdf-editor-text',
    ]);
  });

  it('keeps every persisted localStorage key under pdf-editor:', () => {
    expect(Object.keys(appSources).length).toBeGreaterThan(100);
    const keys = new Set<string>();
    for (const [file, source] of Object.entries(appSources)) {
      for (const key of literals(source, 'pdf-editor:')) keys.add(key);
      // A key under a new prefix would be a rename (ADR-0015 §3).
      expect(literals(source, 'recto:'), `${file} stores under recto:`).toEqual([]);
    }
    expect([...keys].sort()).toEqual([
      'pdf-editor:annotations:author-asked:v1',
      'pdf-editor:annotations:author:v1',
      'pdf-editor:appearance:v1',
      'pdf-editor:bates-last-number',
      // The tab's last reload for a failed launch chunk (sessionStorage, pwa/boot-reload.ts).
      'pdf-editor:boot-reload:v1',
      'pdf-editor:dev:glass-stats',
      'pdf-editor:dev:ink-stats',
      'pdf-editor:drawer:v1',
      'pdf-editor:edit-policy:v1',
      // The session's ?edition override (sessionStorage, shell/frame/edition.ts).
      'pdf-editor:edition:v1',
      // The Fill & sign bar flag, ?fillbar=1|0 (markup/fill-bar-flag.ts, DSN-75).
      'pdf-editor:fillbar:v1',
      // Not stored: the window event an applied undo or redo fires (history/history-applied.ts).
      'pdf-editor:history-applied',
      // The Library's Continue flag, ?home=continue|0 (home/home-flags.ts, DSN-66).
      'pdf-editor:home-continue:v1',
      // The Library's recents search flag, ?home=search|0 (home/home-flags.ts, Epic 3).
      'pdf-editor:home-search:v1',
      // Today's edit-policy:v1, migrated once (state/input-policy-store.ts, redesign spec §7).
      'pdf-editor:input-policy:v1',
      // The one-time `1` migration notice (commands/keymap-notice.ts, D2-7).
      'pdf-editor:keymap-notice:v1',
      // The labelled palette flag, ?labels=1|0, and its session count (markup/palette-labels.ts, DSN-71).
      'pdf-editor:labels-sessions:v1',
      'pdf-editor:labels:v1',
      'pdf-editor:locale:v1',
      // The margin map flag, ?margin=1|0 (shell/frame/margin/margin-map-flag.ts, DSN-72).
      'pdf-editor:margin:v1',
      // The one reload into cross-origin isolation (sessionStorage, office/flag.ts, ADR-0035 §4).
      'pdf-editor:office-reload:v1',
      // The Office conversion flag, ?office=1|0 (office/flag.ts, ADR-0035 §6).
      'pdf-editor:office:v1',
      // Open one file from the Library to its page, ?open=page|0 (home/home-flags.ts, Epic 3).
      // The open moment flag, ?open=light|0 (home/home-flags.ts, R26 concept 2, DSN-64).
      'pdf-editor:open-light:v1',
      'pdf-editor:open-page:v1',
      // The Markup palette flag, ?palette=groups|labels|row (markup/palette-variant.ts, R25-7).
      'pdf-editor:palette:v1',
      'pdf-editor:receipt:v1',
      'pdf-editor:recents:v1',
      // "Don't ask again for this file" on Save's Replace question (files/save.ts, ADR-0032 §2.1).
      'pdf-editor:save:replace-ok:v1',
      // The private-window notice dismissed on this device (session/session.ts, FB9).
      'pdf-editor:session:not-kept-dismissed:v1',
      // This tab's id across reloads (sessionStorage, session/session.ts, ADR-0032 §2.5).
      'pdf-editor:session:tab:v1',
      // The saved signatures' IndexedDB database (signatures/saved-signatures.ts, spec X26).
      'pdf-editor:signatures:v1',
      // The page strip flag, ?strip=1|0 (shell/frame/strip/strip-hold.ts, R26 concept 1).
      'pdf-editor:strip:v1',
      // The phone reader's ?top variant for this tab (sessionStorage, shell/compact/top-variant.ts).
      'pdf-editor:top:v1',
      'pdf-editor:ui:colour-view:v1',
      'pdf-editor:ui:eraser:v1',
      // Each tool's recent colours in the ink strip (markup/ink-recents.ts, G8).
      'pdf-editor:ui:ink-recents:v1',
      'pdf-editor:ui:pen-presets:v1',
      'pdf-editor:ui:pen-presets:v2',
      'pdf-editor:ui:recent-colours:v1',
      'pdf-editor:ui:saved-colours:v1',
      'pdf-editor:ui:tool-styles:v1',
      'pdf-editor:ui:tool-styles:v2',
      'pdf-editor:ui:v1',
      'pdf-editor:ui:v2',
      // The panel layout in the redesign's shape (state/ui-store.ts, redesign spec §7, X26).
      'pdf-editor:ui:v3',
      'pdf-editor:viewer:positions:v1',
    ]);
  });
});

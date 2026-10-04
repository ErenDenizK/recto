/**
 * The compact edition (ADR-0033 §2.3, spec redesign D0-14): a finished, small, read-only
 * PDF reader for phones, built as its own shell. It reuses the engine, the workspace store,
 * file intake, Recents, the page renderer, search, the outline, i18n and today's tokens, and
 * never mounts the full shell (`AppShell`): `main.tsx` loads this module, in its own chunk,
 * instead of `app.tsx` when the edition is compact.
 *
 * Two places: the **Library** (Open PDF, Recents, the reading-only line) and the **reader**
 * (pages, a collapsible top bar and bottom capsule, the Pages, Contents, Go to page,
 * Document info and About sheets, Find). Markup, tools, the dock, tabs, page operations,
 * Save, Compare, conversions and every editing sheet are absent, not hidden.
 *
 * The page opts into the full screen here (`viewport-fit=cover`, so the safe-area insets are
 * real, and `interactive-widget=resizes-content`, so the keyboard shrinks the layout instead
 * of covering Find), without touching `index.html`, which the full edition keeps as it is.
 */
import { useEffect, useLayoutEffect } from 'react';

import { getEngineService } from '../../engine/engine-service';
import { loadRecents } from '../../files/recents';
import { LocaleBoundary } from '../../i18n/LocaleBoundary';
import { requestPassword } from '../../state/password-store';
import { useWorkspaceStore } from '../../state/workspace-store';
import { clearLinksForSource } from '../../viewer/LinkLayer';
import { installCopyHandler } from '../../viewer/text-spans';
import { LiveRegion } from '../LiveRegion';
import styles from './CompactApp.module.css';
import { CompactLibrary } from './CompactLibrary';
import { CompactPassword } from './CompactPassword';
import { CompactReader } from './CompactReader';
import { showLibrary, useCompactStore } from './compact-store';

const VIEWPORT =
  'width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content';

/** Sets the compact edition's viewport meta; returns a function that restores the old one. */
function applyViewport(): () => void {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'viewport';
    document.head.append(meta);
  }
  const previous = meta.content;
  meta.content = VIEWPORT;
  return () => {
    if (meta) meta.content = previous;
  };
}

export function CompactApp() {
  useLayoutEffect(() => applyViewport(), []);
  // Encrypted files ask for their password in the compact sheet.
  useEffect(() => {
    const engine = getEngineService();
    engine.setPasswordPrompt(requestPassword);
    return () => engine.setPasswordPrompt(undefined);
  }, []);
  // The link cache is per source page; drop a source's links when it closes.
  useEffect(() => getEngineService().onSourceClosed(clearLinksForSource), []);
  // Copy from the text layer assembles lines and pages, as in the full edition.
  useEffect(() => installCopyHandler(), []);
  useEffect(() => {
    void loadRecents();
  }, []);
  return (
    <LocaleBoundary>
      <CompactRoot />
      <CompactPassword />
      <LiveRegion />
    </LocaleBoundary>
  );
}

function CompactRoot() {
  const place = useCompactStore((s) => s.place);
  const hasDocument = useWorkspaceStore((s) => s.workspace.activeDocument !== undefined);
  // The reader needs a document; without one (a failed reopen) the Library shows.
  useEffect(() => {
    if (place === 'reader' && !hasDocument) showLibrary();
  }, [place, hasDocument]);
  return (
    <div className={styles.root} data-testid="compact-app" data-place={place}>
      {place === 'reader' && hasDocument ? <CompactReader /> : <CompactLibrary />}
    </div>
  );
}

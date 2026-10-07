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
import { loadSampleFile } from '../../sample/sample-file';
import { openSampleFromLink } from '../../sample/sample-link';
import { isDocumentChanged, startSession } from '../../session/session';
import { watchSessionNotice } from '../../session/session-toast';
import { useAppearanceRoot } from '../../state/appearance-store';
import { requestPassword } from '../../state/password-store';
import { useWorkspaceStore } from '../../state/workspace-store';
import { ToastRegion } from '../../ui/Toast/ToastRegion';
import { clearLinksForSource } from '../../viewer/LinkLayer';
import { installCopyHandler } from '../../viewer/text-spans';
import { LiveRegion } from '../LiveRegion';
import styles from './CompactApp.module.css';
import { CompactLibrary } from './CompactLibrary';
import { CompactPassword } from './CompactPassword';
import { CompactReader } from './CompactReader';
import { openPdf, shareOrDownload } from './compact-actions';
import { capsuleAway, showLibrary, showReader, useCompactStore } from './compact-store';

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
  // The appearance settings reach the root here too: Reduce motion (About's row, or kept from
  // the full edition on this device) and Glass with its start state and cost ladder, which the
  // materials read.
  useAppearanceRoot();
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
  // Kept documents restore here too (ADR-0033 §2.3): the active one, at its page; one with
  // changes made in the full edition opens with them and offers Download a copy, which
  // goes through the export because it is not the file as opened.
  useEffect(
    () =>
      startSession({
        edition: 'compact',
        onRestored: ([id]) => {
          const doc =
            id === undefined ? undefined : useWorkspaceStore.getState().workspace.documents[id];
          if (doc === undefined) return;
          useCompactStore.setState({ openedDocument: isDocumentChanged(doc.id) ? null : doc });
          showReader();
        },
      }),
    [],
  );
  // `?sample` from the about page opens the teaching sample in the reader (D4-2).
  useEffect(
    () =>
      openSampleFromLink(async (locale) => {
        const file = await loadSampleFile(locale, []);
        if (file !== undefined) await openPdf(file);
      }),
    [],
  );
  // The session's notice is a toast, with Download a copy for a restored changed document.
  useEffect(() => watchSessionNotice({ onDownloadCopy: () => void shareOrDownload() }), []);
  return (
    <LocaleBoundary>
      <CompactRoot />
      <CompactPassword />
      <CompactToasts />
      <LiveRegion />
    </LocaleBoundary>
  );
}

/**
 * The toast stack (`08-feedback` FB4; D0-5) in the compact edition: the same region, above
 * the reader's capsule, or above the home indicator when the capsule is away or absent.
 */
function CompactToasts() {
  const away = useCompactStore((s) => s.place !== 'reader' || capsuleAway(s));
  return <ToastRegion edition="compact" band={away ? 'away' : 'shown'} />;
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

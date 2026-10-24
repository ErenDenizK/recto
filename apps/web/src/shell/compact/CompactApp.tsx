/**
 * The compact edition (ADR-0033 §2.3, spec redesign D0-14): a finished, small, read-only
 * PDF reader for phones, built as its own shell. It reuses the engine, the workspace store,
 * file intake, Recents, the page renderer, search, the outline, i18n and today's tokens, and
 * never mounts the full shell (`AppShell`): `main.tsx` loads this module, in its own chunk,
 * instead of `app.tsx` when the edition is compact.
 *
 * Two places: the **Library** (Open PDF, Recents, the reading-only line) and the **reader**
 * (pages, a collapsible top bar and bottom capsule, the Pages, Contents, Go to page,
 * Document info and Settings sheets, Find). Markup, tools, the dock, tabs, page operations,
 * Save, Compare, conversions and every editing sheet are absent, not hidden.
 *
 * The page opts into the full screen here (`viewport-fit=cover`, so the safe-area insets are
 * real, and `interactive-widget=resizes-content`, so the keyboard shrinks the layout instead
 * of covering Find), without touching `index.html`, which the full edition keeps as it is.
 */
import { lazy, Suspense, useEffect, useLayoutEffect, useState } from 'react';

import { getEngineService } from '../../engine/engine-service';
import { loadRecents } from '../../files/recents';
import { Aura } from '../../home/Aura';
import { LocaleBoundary } from '../../i18n/LocaleBoundary';
import { loadSampleFile } from '../../sample/sample-file';
import { openSampleFromLink } from '../../sample/sample-link';
import { isDocumentChanged, startSession } from '../../session/session';
import { watchSessionNotice } from '../../session/session-toast';
import { useAppearanceRoot, useAppearanceStore } from '../../state/appearance-store';
import { requestPassword } from '../../state/password-store';
import { useWorkspaceStore } from '../../state/workspace-store';
import { useToastStore } from '../../ui/Toast/toast-store';
import { clearLinksForSource } from '../../viewer/link-cache';
import { FIND_MAP } from '../../viewer/find-map-flag';
import { installCopyHandler } from '../../viewer/text-spans';
import { LiveRegion } from '../LiveRegion';
import styles from './CompactApp.module.css';
import { CompactLibrary } from './CompactLibrary';
import { CompactReader } from './CompactReader';
import { openPdf, shareOrDownload } from './compact-actions';
import { capsuleAway, showLibrary, showReader, useCompactStore } from './compact-store';

/** The toast region loads with the first toast: most sessions never show one (PRC-11). */
const ToastRegion = lazy(() =>
  import('../../ui/Toast/ToastRegion').then((module) => ({ default: module.ToastRegion })),
);

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
  // The app's one scroll bar over every scroller, the phone's lists and sheets too (GLS-26).
  // It loads after the first paint (bundle budget, PRC-11), and with it the toast region and the
  // link layer, so a first toast or an early link tap never waits on a chunk.
  useEffect(() => {
    void import('../../ui/Toast/ToastRegion');
    void import('../../viewer/LinkLayer');
    let installed: (() => void) | undefined;
    let cancelled = false;
    void import('../../ui/scroll-thumbs').then(({ installScrollThumbs }) => {
      if (!cancelled) installed = installScrollThumbs();
    });
    return () => {
      cancelled = true;
      installed?.();
    };
  }, []);
  // The find map's rail: Find's hit ticks on the reader's edge (R26, DSN-65; `?findmap=1`).
  useEffect(() => {
    if (FIND_MAP) void import('../../viewer/search-ticks');
  }, []);
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
  // `?sample` from the about page opens the teaching sample's phone cut in the reader (D4-2,
  // MOB-12).
  useEffect(
    () =>
      openSampleFromLink(async (locale) => {
        const file = await loadSampleFile(locale, 'compact', []);
        if (file !== undefined) await openPdf(file);
      }),
    [],
  );
  // The session's notice is a toast, with Download a copy for a restored changed document.
  useEffect(() => watchSessionNotice({ onDownloadCopy: () => void shareOrDownload() }), []);
  return (
    <LocaleBoundary>
      <CompactRoot />
      <CompactToasts />
      <LiveRegion />
    </LocaleBoundary>
  );
}

/**
 * The toast stack (`08-feedback` FB4; D0-5) in the compact edition: the same region, above
 * the reader's capsule or the Library's Open PDF dock (the same 56 px piece in the same place,
 * DSN-31), or above the home indicator when the capsule is away. The page overview's bar is the
 * capsule's piece in the capsule's place (MOB-3), so its toasts (Undo) stand above it too.
 * While a scrim sheet is open the stack steps aside (DSN-56).
 */
function CompactToasts() {
  const away = useCompactStore(
    (s) => s.place === 'reader' && capsuleAway(s) && s.overview === 'closed',
  );
  const covered = useCompactStore((s) => s.scrimSheets > 0);
  const shown = useToastStore((s) => s.shown.length > 0);
  const [wanted, setWanted] = useState(false);
  if (shown && !wanted) setWanted(true);
  if (!wanted) return null;
  return (
    <Suspense fallback={null}>
      <ToastRegion edition="compact" band={away ? 'away' : 'shown'} covered={covered} />
    </Suspense>
  );
}

function CompactRoot() {
  const place = useCompactStore((s) => s.place);
  const hasDocument = useWorkspaceStore((s) => s.workspace.activeDocument !== undefined);
  const glow = useAppearanceStore((s) => s.glow);
  // The reader needs a document; without one (a failed reopen) the Library shows.
  useEffect(() => {
    if (place === 'reader' && !hasDocument) showLibrary();
  }, [place, hasDocument]);
  const reading = place === 'reader' && hasDocument;
  // The background light (DSN-24), as in the full edition's shell: one layer fixed to the
  // window behind everything, the Library's drifting aura or, with Settings › Background glow
  // on, the reader's still glow behind its canvas (G5). The pages stay white over it.
  const aura = reading ? (glow ? 'reader' : null) : 'library';
  // The Library scrolls the document, the reader its own pages (DSN-33, CompactApp.module.css).
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.compactPlace = reading ? 'reader' : 'library';
    return () => {
      delete root.dataset.compactPlace;
    };
  }, [reading]);
  return (
    <div className={styles.root} data-testid="compact-app" data-place={place}>
      {aura ? (
        <Aura tone={aura} testId={aura === 'library' ? 'library-aura' : 'reader-glow'} />
      ) : null}
      {reading ? <CompactReader /> : <CompactLibrary />}
    </div>
  );
}

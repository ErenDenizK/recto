/**
 * The compact edition's Home (EDN-29, DSN-93; ADR-0033 §2.3; spec `colophon-plan.md` L4): the
 * same product as the full Home, laid out for one hand, over the beam of light. Top to bottom:
 *
 * 1. **Header.** The Recto mark with the wordmark, and the gear (DSN-51: Settings, About's rows,
 *    one tap away before a file is open; the compact closure carries only the button, the sheet is
 *    `CompactSheets`'). No language switch (DSN-46).
 * 2. **Continue.** The document open and read last: its page left (`ContinueCover`, lazy), the
 *    name in the serif, "Page 2 of 4", a 2 px progress line and Continue, the view's one lime
 *    (DSN-89). It resumes the page, zoom and offset (`compact-resume`). On the first visit the
 *    same slot holds the Margin cover, its name and "Try the sample" as a lime link.
 * 3. **Recent.** A horizontal shelf of covers (`ShelfCovers`, lazy) 200 high, the serif title
 *    under each, on the shelf line. A tap reopens (`openRecentEntry`: "Reading now" goes back to
 *    the reader, a file without a kept handle asks for the dialog); a long press opens the row
 *    menu, Remove. The sample is the shelf's last tile once there are files. Clear forgets them.
 * 4. **The dock.** A smoked capsule over the home indicator: Open (`compact-library-dock`), the
 *    lime primary, or a ghost pill while Continue shows (owner, one lime per view), and Scan as a
 *    glyph slot when the device has a camera (EDN-23). Combine and Sign are not on the phone.
 *
 * A file that did not open leaves one line saying why (`role="alert"`), under the shelf.
 */
import { ContextMenu } from '@base-ui/react/context-menu';
import type { DocumentId } from '@pdf-editor/document-model';
import { type CSSProperties, lazy, Suspense, useState } from 'react';

import { BrandMark } from '../../brand/BrandMark';
import {
  canReopenRecent,
  clearRecents,
  type RecentEntry,
  removeRecent,
  useRecentsStore,
} from '../../files/recents';
import { presentError } from '../../errors/present';
import { formatFileSize, relativeTime } from '../../home/home-model';
import { getLocale, m } from '../../i18n';
import { SampleCover } from '../../sample/SampleCover';
import { progressOf, type ResumePoint, useResumeStore } from '../../session/resume';
import { pagesPhrase, useWorkspaceStore } from '../../state/workspace-store';
import { Icon } from '../../ui/Icon';
import menuStyles from '../../ui/Menu.module.css';
import { announce } from '../announcer';
import { PRODUCT_NAME } from '../about/build-info';
import { CompactBeam } from './CompactBeam';
import { CompactSheets, loadMoreSheets } from './CompactSheets';
import { ScanButton } from './scan/ScanEntry';
import { isOpenEntry, openRecentEntry, pickAndOpen, trySample } from './compact-actions';
import { openSheet, useCompactStore } from './compact-store';
import styles from './CompactLibrary.module.css';
import type { CoverOf } from './ShelfCovers';

/** The page left and the covers load after the first paint (PF-23). */
const ContinueCover = lazy(() => import('./ContinueCover'));
const ShelfCovers = lazy(() => import('./ShelfCovers'));

/** The sample's name on the first visit, in the language of the cut the person would open. */
const SAMPLE_TITLE: Readonly<Record<string, string>> = {
  en: 'Margin, No. 07',
  tr: 'Kenar, Sayı 07',
};

/** A page's proportion when no cover is stored yet: A4, a paper sheet. */
const PAPER_RATIO = 210 / 297;

interface ContinueSource {
  readonly id: DocumentId;
  readonly title: string;
  readonly point: ResumePoint;
}

/** The document the Continue block stands for: the one read last that is still open. */
function useContinue(): ContinueSource | undefined {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const points = useResumeStore((s) => s.points);
  const last = useResumeStore((s) => s.last);
  const id =
    last !== null && workspace.documents[last] !== undefined
      ? last
      : (workspace.activeDocument ?? undefined);
  const doc = id === undefined ? undefined : workspace.documents[id];
  const point = id === undefined ? undefined : points[id];
  if (doc === undefined || point === undefined) return undefined;
  return { id: doc.id, title: doc.title, point };
}

export function CompactLibrary() {
  const opening = useCompactStore((s) => s.opening);
  const openError = useCompactStore((s) => s.openError);
  const loaded = useRecentsStore((s) => s.loaded);
  const entries = useRecentsStore((s) => s.entries);
  const resume = useContinue();
  const continued = resume !== undefined;
  const firstRun = loaded && entries.length === 0 && !continued;
  return (
    <main
      className={styles.library}
      data-testid="compact-library"
      data-first-run={firstRun || undefined}
      data-continued={continued || undefined}
    >
      <CompactBeam />
      <header className={styles.header}>
        <h1 className={styles.brand}>
          <BrandMark size={22} className={styles.mark} />
          <span className={styles.wordmark}>{PRODUCT_NAME}</span>
        </h1>
        <button
          type="button"
          className={styles.gear}
          aria-label={m.settings_title()}
          aria-haspopup="dialog"
          data-testid="compact-library-more"
          onPointerDown={() => void loadMoreSheets().catch(() => undefined)}
          onClick={() => openSheet('settings')}
        >
          <Icon name="gear-six" size={24} />
        </button>
      </header>
      <div className={styles.body}>
        {resume ? (
          <Continue resume={resume} />
        ) : firstRun ? (
          <FirstVisit disabled={opening} />
        ) : loaded ? null : (
          <div className={styles.holder} aria-hidden="true" />
        )}
        <Recent continued={continued} />
        {openError ? (
          <p className={styles.error} role="alert" data-testid="compact-open-error">
            {openError}
          </p>
        ) : null}
      </div>
      <div className={styles.dock}>
        <div className={styles.dockPiece} data-testid="compact-library-dock">
          <button
            type="button"
            className={styles.open}
            data-ghost={continued || undefined}
            aria-label={opening ? m.compact_opening() : m.compact_open_pdf()}
            aria-busy={opening || undefined}
            disabled={opening}
            onClick={() => void pickAndOpen()}
          >
            <Icon name="folder-open" size={24} />
            {m.home_open_short()}
          </button>
          <ScanButton className={styles.slot} />
        </div>
      </div>
      <CompactSheets />
    </main>
  );
}

/** Continue: the page left, the name, where it stands and the one lime (DSN-66, DSN-89). */
function Continue({ resume }: { readonly resume: ContinueSource }) {
  const { id, title, point } = resume;
  const page = point.page + 1;
  const total = point.total;
  const progress = progressOf(point);
  return (
    <section className={styles.hero} aria-labelledby="continue-name" data-testid="continue-card">
      <div className={styles.cover} aria-hidden="true">
        <Suspense fallback={<span className={styles.sheet} data-empty="" />}>
          <ContinueCover id={id} page={point.page} />
        </Suspense>
      </div>
      <div className={styles.heroText}>
        <h2 id="continue-name" className={styles.title} data-testid="continue-name">
          {title}
        </h2>
        <p className={styles.page} data-testid="continue-page">
          {m.continue_page({ page, total })}
        </p>
        <div
          className={styles.progress}
          role="progressbar"
          aria-label={m.continue_progress()}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <span className={styles.fill} style={{ width: `${progress * 100}%` }} />
        </div>
        <button
          type="button"
          className={styles.go}
          aria-label={m.continue_resume_named({ name: title, page, total })}
          data-testid="continue-resume"
          onClick={() => void import('./compact-resume').then((v) => v.resumeCompact(id, point))}
        >
          {m.continue_resume()}
        </button>
      </div>
    </section>
  );
}

/** The first visit: the Margin cover, its name and the sample as a lime link (EDN-29). */
function FirstVisit({ disabled }: { readonly disabled: boolean }) {
  return (
    <section className={styles.hero} aria-labelledby="first-visit-name">
      <div className={styles.cover}>
        <SampleCover className={styles.sheetSvg} />
      </div>
      <div className={styles.heroText}>
        <h2 id="first-visit-name" className={styles.title}>
          {SAMPLE_TITLE[getLocale()] ?? SAMPLE_TITLE.en}
        </h2>
        <button
          type="button"
          className={styles.sampleLink}
          disabled={disabled}
          data-testid="compact-sample"
          onClick={() => void trySample()}
        >
          {m.home_try_sample()}
        </button>
      </div>
    </section>
  );
}

const NO_COVERS: CoverOf = () => undefined;

/** Recent: the shelf of covers, newest first, and Clear. Nothing before the first file. */
function Recent({ continued }: { readonly continued: boolean }) {
  const entries = useRecentsStore((s) => s.entries);
  const loaded = useRecentsStore((s) => s.loaded);
  const note = useRecentsStore((s) => s.note);
  if (!loaded || entries.length === 0) return null;
  // The open document first, then the rest newest first; while Continue shows the open one, its
  // tile would say it twice (DSN-66).
  const ordered = [
    ...(continued ? [] : entries.filter(isOpenEntry)),
    ...entries.filter((e) => !isOpenEntry(e)),
  ];
  const shelf = (coverOf: CoverOf) => <Shelf entries={ordered} coverOf={coverOf} />;
  return (
    <section className={styles.recent} aria-labelledby="compact-recents-heading">
      <div className={styles.recentHead}>
        <h2 id="compact-recents-heading" className={styles.recentTitle}>
          {m.home_recent()}
        </h2>
        <button
          type="button"
          className={styles.clear}
          aria-label={m.recents_clear()}
          onClick={() => {
            void clearRecents().then((cleared) => {
              if (cleared) announce(m.recents_announce_cleared());
              else presentError({ kind: 'message', text: m.recents_clear_failed() });
            });
          }}
        >
          {m.home_clear()}
        </button>
      </div>
      <Suspense fallback={shelf(NO_COVERS)}>
        <ShelfCovers>{shelf}</ShelfCovers>
      </Suspense>
      {note ? (
        <p className={styles.note} data-testid="compact-recent-note">
          {note.kind === 'open-again'
            ? m.recents_note_open_again({ name: note.name })
            : m.recents_note_unavailable({ name: note.name })}
        </p>
      ) : null}
    </section>
  );
}

function Shelf({
  entries,
  coverOf,
}: {
  readonly entries: readonly RecentEntry[];
  readonly coverOf: CoverOf;
}) {
  const access = useRecentsStore((s) => s.access);
  const locale = getLocale();
  // Relative times ("5 minutes ago") are read once per visit.
  const [now] = useState(() => Date.now());
  return (
    <div className={styles.shelf}>
      <ul className={styles.list} aria-label={m.recents_list_label()} data-testid="compact-recents">
        {entries.map((entry) => (
          <RecentTile
            key={entry.id}
            entry={entry}
            cover={coverOf(entry)}
            reading={isOpenEntry(entry)}
            hint={recentHint(entry, access[entry.id])}
            time={relativeTime(entry.openedAt, now, locale)}
            locale={locale}
          />
        ))}
        <SampleTile />
      </ul>
    </div>
  );
}

/** What reopening needs, as Home says it: nothing, permission, or the file dialog. */
function recentHint(entry: RecentEntry, access: string | undefined): string | undefined {
  // A kept snapshot reopens by itself on every browser (ADR-0032 §2.6).
  if (entry.kept !== undefined) return entry.kept.changed ? m.recents_hint_kept() : undefined;
  if (!canReopenRecent(entry) || access === 'unavailable') return m.recents_hint_open_again();
  if (access === 'prompt') return m.recents_hint_permission();
  return undefined;
}

function RecentTile({
  entry,
  cover,
  reading,
  hint,
  time,
  locale,
}: {
  readonly entry: RecentEntry;
  readonly cover:
    | { readonly url: string; readonly width: number; readonly height: number }
    | undefined;
  readonly reading: boolean;
  readonly hint: string | undefined;
  readonly time: string;
  readonly locale: string;
}) {
  const details = [
    entry.pages === undefined ? undefined : pagesPhrase(entry.pages),
    formatFileSize(entry.size, locale),
  ]
    .filter(Boolean)
    .join(' · ');
  const status = reading ? m.compact_recent_reading() : hint;
  const label = [entry.name, details, reading ? undefined : time, status]
    .filter(Boolean)
    .join(', ');
  const ratio = cover === undefined ? PAPER_RATIO : cover.width / cover.height;
  const edited = entry.kept?.changed === true;
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger
        render={<li className={styles.item} style={{ '--cover-ratio': ratio } as CSSProperties} />}
      >
        <button
          type="button"
          className={styles.tile}
          aria-label={label}
          aria-current={reading || undefined}
          data-reading={reading || undefined}
          data-testid="compact-recent"
          // No await before the reopen: a permission prompt needs this tap's activation.
          onClick={(event) => void openRecentEntry(entry, event.currentTarget)}
        >
          <span className={styles.sheet} data-empty={cover === undefined || undefined}>
            {cover === undefined ? (
              <Icon name="file" size={24} className={styles.glyph} />
            ) : (
              <img
                className={styles.image}
                src={cover.url}
                width={cover.width}
                height={cover.height}
                alt=""
                decoding="async"
                draggable={false}
              />
            )}
          </span>
          <span className={styles.name} aria-hidden="true">
            {edited ? <span className={styles.dot} /> : null}
            <span className={styles.nameText}>{entry.name.replace(/\.pdf$/i, '')}</span>
          </span>
        </button>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Positioner sideOffset={8} collisionPadding={8}>
          <ContextMenu.Popup className={menuStyles.popup} data-testid="compact-recent-menu">
            <ContextMenu.Item
              className={menuStyles.item}
              onClick={() => {
                void removeRecent(entry.id);
                announce(m.recents_announce_removed({ name: entry.name }));
              }}
            >
              <Icon name="trash" />
              <span className={menuStyles.label}>{m.recents_remove()}</span>
            </ContextMenu.Item>
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

/** The sample, the shelf's last tile: its cover drawn small, no engine until it is chosen. */
function SampleTile() {
  const opening = useCompactStore((s) => s.opening);
  return (
    <li className={styles.item} style={{ '--cover-ratio': PAPER_RATIO } as CSSProperties}>
      <button
        type="button"
        className={styles.tile}
        disabled={opening}
        data-testid="compact-sample"
        onClick={() => void trySample()}
      >
        <SampleCover className={styles.sheetSvg} />
        <span className={styles.name}>
          <span className={styles.nameText}>{m.home_try_sample()}</span>
        </span>
      </button>
    </li>
  );
}

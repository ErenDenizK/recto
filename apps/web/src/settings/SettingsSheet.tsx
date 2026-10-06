/**
 * S3, the Settings sheet (components/07-sheets.md §5; flows.md §9.5; ADR-0031 §2 item 13: one
 * sheet, INV-20; spec redesign D0-10, 07.8, 07.Q2): the one place for every preference that
 * exists today, About Recto inside it. It replaces the Document menu's Appearance submenu, the
 * palette-only language switch and the About dialog (07 §25).
 *
 * - **Presentation** (`ui/sheet/presentation.ts`, kind `settings`): a 480 px side sheet over a
 *   scrim from the expanded class up, a form sheet (≤ 640) on medium, a bottom sheet at 92 % on
 *   a compact desktop window. One grouped scroll at every size; Kept documents, Saved
 *   signatures, Privacy and About Recto push a page (‹ Back in the header, the catalogue's
 *   *sheet push*, X8: 24 px and a fade on the smooth spring, a 150 ms fade under reduced
 *   motion, transform and opacity only, cleared at the end, quality-bar Q-2, Q-7).
 * - **Search** (`search-index.ts`): filters rows by their EN and TR titles and keywords without
 *   diacritics; a match inside a pushed page shows that page's row with what it found. The
 *   field is `role="search"`, the result count is polite, and no match says "No setting matches
 *   “x”". What was typed is the sheet's draft for the session (07 §2.5). It stays pinned under
 *   the header: only the list under it scrolls, in a scroll area whose edges fade where the
 *   list goes on (09 §21), so no presentation cuts a row off at its bottom edge.
 * - **Openers** name a target (`open-settings.ts`): a section is scrolled to, a row is scrolled
 *   to, tinted once and its control focused, a row that pushes a page opens that page.
 * - **Focus** (07 S3 §6): the target's control; else the search field on a fine pointer and the
 *   first row on a coarse one (no keyboard pops up). Pushing a page focuses ‹ Back; Back
 *   returns focus to the row that pushed it.
 * - Every control applies at once and persists in its store; there is no Save button.
 *
 * Loaded on first use (quality-bar Q-11) through `SettingsHost.tsx`.
 */
import { Fragment, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { m } from '../i18n';
import { sheetPush } from '../motion';
import { useLastInput, usePointerCapabilities } from '../shell/frame/input-modality';
import { ScrollArea } from '../ui/ScrollArea';
import { SearchField } from '../ui/SearchField';
import { Sheet, useSheetDraft, useSheetOpen } from '../ui/sheet';
import {
  closeSettings,
  landingOf,
  settingsReturnFocus,
  SETTINGS_SHEET_ID,
  type SettingsTarget,
  targetOf,
} from './open-settings';
import { AboutPage, KeptPage, PrivacyPage } from './pages';
import { SavedSignaturesPage, SavedSignaturesRow } from './SavedSignatures';
import { Section } from './rows';
import {
  pageById,
  queryWords,
  rowById,
  SETTINGS_ROWS,
  SETTINGS_SECTIONS,
  type SettingsPageId,
  type SettingsRowId,
  searchSettings,
} from './search-index';
import {
  AboutRow,
  CommentNameRow,
  GlassRow,
  KeptDocumentsRow,
  LanguageRow,
  type MainRowId,
  PenDrawsRow,
  PrivacyRow,
  RecentsRow,
  ShortcutsRow,
  ShowTipsRow,
} from './sections';
import { ReduceMotionRow } from './ReduceMotionRow';
import { ThemeRow } from './ThemeRow';
import styles from './Settings.module.css';

type Push = (page: SettingsPageId) => void;

/** Each row of the main list; `hint` lists what search found inside a pushed page. */
const ROWS: Readonly<
  Record<MainRowId, (props: { onPush: Push; hint: string | undefined }) => ReactNode>
> = {
  theme: () => <ThemeRow />,
  glass: () => <GlassRow />,
  reduceMotion: () => <ReduceMotionRow />,
  language: () => <LanguageRow />,
  penDrawsInEdit: () => <PenDrawsRow />,
  keptDocuments: (props) => <KeptDocumentsRow {...props} />,
  savedSignatures: (props) => <SavedSignaturesRow {...props} />,
  recents: () => <RecentsRow />,
  commentName: () => <CommentNameRow />,
  showTips: () => <ShowTipsRow />,
  privacy: (props) => <PrivacyRow {...props} />,
  shortcuts: () => <ShortcutsRow />,
  about: (props) => <AboutRow {...props} />,
};

/** The pushed pages. */
const PAGES: Readonly<Record<SettingsPageId, () => ReactNode>> = {
  kept: () => <KeptPage />,
  signatures: () => <SavedSignaturesPage />,
  privacy: () => <PrivacyPage />,
  about: () => <AboutPage />,
};

/** What can take focus inside a row: its switch, segment, field or button. */
const ROW_CONTROL =
  'input:not([type="hidden"], [aria-hidden="true"]), [role="switch"], [role="radio"][data-checked], [role="radio"][aria-checked="true"], [role="combobox"], button, a[href]';

function panel(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-sheet="${SETTINGS_SHEET_ID}"]`);
}

function controlOf(target: SettingsTarget, root: ParentNode | null): HTMLElement | null {
  if (!root) return null;
  if ('section' in target) {
    return root.querySelector<HTMLElement>(
      `[data-section="${target.section}"] [data-row] :is(${ROW_CONTROL})`,
    );
  }
  return root.querySelector<HTMLElement>(`[data-row="${target.row}"] :is(${ROW_CONTROL})`);
}

/** Scrolls the target into view and tints a row once (`.row[data-revealed]`). */
function revealTarget(target: SettingsTarget, root: ParentNode | null): void {
  if (!root) return;
  const selector =
    'section' in target ? `[data-section="${target.section}"]` : `[data-row="${target.row}"]`;
  const element = root.querySelector<HTMLElement>(selector);
  if (!element) return;
  element.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  if ('section' in target) return;
  element.removeAttribute('data-revealed');
  // A fresh start for the tint when the same row is named twice.
  void element.getBoundingClientRect();
  element.setAttribute('data-revealed', '');
  element.addEventListener('animationend', () => element.removeAttribute('data-revealed'), {
    once: true,
  });
}

export default function SettingsSheet() {
  const open = useSheetOpen(SETTINGS_SHEET_ID);
  const [query, setQuery] = useSheetDraft<string>(SETTINGS_SHEET_ID, null, '');
  const [spoken, setSpoken] = useState(query);
  const initial = landingOf(targetOf(open?.preset ?? null));
  const [page, setPage] = useState<SettingsPageId | null>(initial.page);
  const [reveal, setReveal] = useState<SettingsTarget | null>(initial.reveal);
  const pointers = usePointerCapabilities();
  const keyboardSeen = useLastInput() === 'keyboard';
  const coarse = pointers.primary === 'coarse';
  const searchRef = useRef<HTMLInputElement>(null);
  const focusRef = useRef<HTMLElement | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // A new request to open (each `openSettings` call) lands on its target.
  const handled = useRef<typeof open>(null);
  useLayoutEffect(() => {
    if (!open || handled.current === open) return;
    const first = handled.current === null;
    handled.current = open;
    const landing = landingOf(targetOf(open.preset));
    if (landing.page !== null || landing.reveal !== null) setQuery('');
    if (first) return;
    setPage(landing.page);
    setReveal(landing.reveal);
  }, [open, setQuery]);
  useEffect(() => {
    if (!open) handled.current = null;
  }, [open]);

  // Where focus starts: the target's control, else the search field (fine) or the first row.
  // Read by `FocusTarget`, the body's last child, so it is set before the popup moves focus.
  const chooseFocus = () => {
    // The body's own ref attaches after its children's layout effects: find it in the panel.
    const root = panel()?.querySelector<HTMLElement>('[data-settings-page]') ?? null;
    if (reveal) return controlOf(reveal, root);
    if (page === null && !coarse) return searchRef.current;
    return root?.querySelector<HTMLElement>(`[data-row] :is(${ROW_CONTROL})`) ?? null;
  };

  // Page changes: the push motion, the body back to its top, and focus to ‹ Back or the row.
  const shownPage = useRef(page);
  useLayoutEffect(() => {
    const previous = shownPage.current;
    if (previous === page) return;
    shownPage.current = page;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    sheetPush(bodyRef.current, page === null ? -1 : 1);
    if (!panel()?.contains(document.activeElement) && document.activeElement !== document.body) {
      return;
    }
    if (page !== null) {
      panel()?.querySelector<HTMLElement>('[data-bar="sheet-header"] button')?.focus();
    } else if (previous !== null) {
      const row = pageById(previous)?.row;
      bodyRef.current?.querySelector<HTMLElement>(`[data-row="${row}"] button`)?.focus();
    }
  }, [page]);

  const push: Push = (next) => {
    setReveal(null);
    setPage(next);
  };

  const shown = SETTINGS_ROWS.filter((row) => row.id !== 'shortcuts' || !coarse || keyboardSeen);
  const searching = queryWords(query).length > 0;
  const hits = searching ? searchSettings(query, shown) : shown;
  const found = new Set<SettingsRowId>();
  const inside = new Map<SettingsPageId, string[]>();
  for (const row of hits) {
    if (!row.page) {
      found.add(row.id);
      continue;
    }
    const owner = pageById(row.page)?.row;
    if (owner) found.add(owner);
    if (searching) inside.set(row.page, [...(inside.get(row.page) ?? []), row.title()]);
  }

  const sections = SETTINGS_SECTIONS.map((section) => ({
    section,
    rows: shown.filter(
      (row): row is typeof row & { id: MainRowId } =>
        row.section === section.id && !row.page && found.has(row.id),
    ),
  })).filter((entry) => entry.rows.length > 0);
  const count = sections.reduce((sum, entry) => sum + entry.rows.length, 0);

  const pageTitle = page ? pageById(page)?.title() : undefined;
  const returnTo = settingsReturnFocus();

  return (
    <Sheet
      id={SETTINGS_SHEET_ID}
      kind="settings"
      open={open !== null}
      onClose={() => closeSettings()}
      title={pageTitle ?? m.settings_title()}
      back={page ? () => setPage(null) : undefined}
      restored={query !== '' && reveal === null}
      initialFocus={focusRef}
      finalFocus={returnTo ? { current: returnTo } : undefined}
      testId="settings-sheet"
    >
      <div ref={bodyRef} className={styles.frame} data-settings-page={page ?? 'main'}>
        {page === null ? (
          <div className={styles.search} role="search">
            <SearchField
              ref={searchRef}
              label={m.settings_search_label()}
              placeholder={m.settings_search_label()}
              autoComplete="off"
              spellCheck={false}
              value={query}
              onValueChange={(next) => {
                setReveal(null);
                setQuery(next);
              }}
              onSearch={setSpoken}
            />
            <p className="visually-hidden" role="status">
              {queryWords(spoken).length === 0
                ? ''
                : count === 0
                  ? m.settings_no_match({ query: spoken.trim() })
                  : m.settings_results({ count })}
            </p>
          </div>
        ) : null}
        <ScrollArea
          className={styles.scroller}
          viewportClassName={styles.viewport}
          viewportRef={scrollRef}
        >
          {page ? (
            PAGES[page]()
          ) : sections.length === 0 ? (
            <p className={styles.empty}>{m.settings_no_match({ query: query.trim() })}</p>
          ) : (
            sections.map(({ section, rows }) => (
              <Section
                key={section.id}
                id={section.id}
                title={section.title ? section.title() : null}
                label={m.settings_section_more()}
              >
                {rows.map((row) => {
                  const pageId = rowById(row.id)?.opens;
                  const within = pageId ? inside.get(pageId) : undefined;
                  return (
                    <Fragment key={row.id}>
                      {ROWS[row.id]({ onPush: push, hint: within?.join(', ') })}
                    </Fragment>
                  );
                })}
              </Section>
            ))
          )}
        </ScrollArea>
        <FocusTarget
          choose={() => {
            focusRef.current = chooseFocus();
          }}
          reveal={open ? reveal : null}
        />
      </div>
    </Sheet>
  );
}

/**
 * Points the sheet's `initialFocus` at the chosen control, and reveals the opener's target. A
 * descendant's layout effect runs once the portal has mounted the rows, before the popup's own
 * and after the rows before it, so the target exists when the popup reads the ref. A target
 * named while the sheet is already open takes focus here.
 */
function FocusTarget({
  choose,
  reveal,
}: {
  /** Points the sheet's `initialFocus` ref at the control to focus. */
  readonly choose: () => void;
  readonly reveal: SettingsTarget | null;
}) {
  useLayoutEffect(() => {
    choose();
  });
  useLayoutEffect(() => {
    if (!reveal) return;
    const root = panel()?.querySelector<HTMLElement>('[data-settings-page]') ?? null;
    revealTarget(reveal, root);
    const control = controlOf(reveal, root);
    if (control && panel()?.contains(document.activeElement)) control.focus();
  }, [reveal]);
  return null;
}

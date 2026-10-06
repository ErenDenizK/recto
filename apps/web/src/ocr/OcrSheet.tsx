/**
 * S10 Recognize text (`components/07-sheets.md` §12; spec recognize-and-compare §1.5; spec
 * D2-9): a tool sheet on the one Sheet primitive, so the pages stay live beside it and the
 * recognised words land on them as they come, with
 *
 * - pages: those without visible text by default (from `ocrPageFacts`), all pages, the
 *   current page or a range;
 * - languages: the UI language and English by default, each with its size and whether it is
 *   on this device or downloads first; names from `Intl.DisplayNames`; "Manage languages…"
 *   pushes the language manager (`OcrLanguages.tsx`), ‹ Back returns;
 * - quality: Standard (the scan's own resolution, 200–400 dpi) or High (400 dpi);
 * - "Replace existing invisible text", shown when a page already has some: this app's earlier
 *   layer (a re-run; ticked by default) or another tool's (kept unless ticked);
 * - the honesty text, and a warning when a source is signed (the export removes signatures).
 *
 * The primary is "Recognize 2 pages", dimmed with its reason. While a run works the sheet shows
 * its progress with Cancel recognition and Continue in background: closing it leaves the run
 * going, its progress on the toast stack's capsule (`ocr-job.ts`). A finished run shows its
 * counts; **Show results** opens the sidebar's Review on Words to check (spec X33), where the
 * inspector's OCR section went, and the low-confidence words step with J / K.
 */
import type { DocumentId, SourceId } from '@pdf-editor/document-model';
import { type OcrLanguagePack, parsePageRange } from '@pdf-editor/engine';
import { type ReactNode, useEffect, useId, useMemo, useState } from 'react';

import { formatNumber, getLocale, m } from '../i18n';
import { useSignatureStore } from '../signatures/signature-store';
import { useViewStore } from '../state/view-store';
import { useWorkspaceStore } from '../state/workspace-store';
import toolStyles from '../tools/ToolDialog.module.css';
import { Button } from '../ui/Button';
import { Sheet, type SheetPrimary } from '../ui/sheet';
import { useRetained } from '../ui/use-retained';
import { pageProgress, qualityLabel } from './labels';
import styles from './Ocr.module.css';
import { OcrLanguages } from './OcrLanguages';
import { ocrDependencies } from './ocr-deps';
import {
  defaultLanguages,
  defaultReplace,
  defaultScope,
  documentTargets,
  type FactsBySource,
  formatMegabytes,
  invisibleTextOf,
  languageName,
  languagesKey,
  lacksVisibleText,
  type OcrScope,
  scopeTargets,
} from './ocr-model';
import { showWordsToCheck } from './ocr-review';
import {
  cancelOcrRun,
  closeOcrDialog,
  type OcrRun,
  setOcrDialogView,
  startOcrRun,
  useOcrStore,
} from './ocr-store';

export const OCR_SHEET = 'ocr';

export default function OcrSheet() {
  const dialog = useOcrStore((s) => s.dialog);
  // The sheet keeps what it showed while it plays its exit.
  const [shown] = useRetained(dialog);
  if (!shown) return null;
  return (
    <OcrSheetFor
      key={shown.documentId ?? 'languages'}
      open={dialog !== null}
      view={shown.view}
      documentId={shown.documentId}
    />
  );
}

function OcrSheetFor({
  open,
  view,
  documentId,
}: {
  readonly open: boolean;
  readonly view: 'run' | 'languages';
  readonly documentId: DocumentId | undefined;
}) {
  const run = useOcrStore((s) => s.run);
  const form = useRunForm(documentId);
  const close = () => closeOcrDialog();

  let title = m.ocr_title();
  let body: ReactNode;
  let primary: SheetPrimary | undefined;
  let secondary: ReactNode;
  let back: (() => void) | undefined;
  let cancel: false | undefined;
  if (view === 'languages' || documentId === undefined) {
    // The language manager, pushed from the form (or opened alone from ⌘K).
    title = m.ocr_languages_title();
    body = <OcrLanguages />;
    back = documentId === undefined ? undefined : () => setOcrDialogView('run');
  } else if (run.kind === 'running') {
    // One run at a time: its progress shows whichever document the sheet opened on.
    body = <Progress run={run} />;
    primary = { label: m.ocr_hide(), onPress: close };
    cancel = false;
    secondary = (
      <Button variant="quiet" disabled={run.phase === 'write'} onClick={cancelOcrRun}>
        {m.ocr_cancel_run()}
      </Button>
    );
  } else if (run.kind !== 'idle' && run.documentId === documentId) {
    // An outcome belongs to its document; another document's sheet offers a new run.
    const again = () => useOcrStore.setState({ run: { kind: 'idle' } });
    body = <Outcome run={run} />;
    cancel = false;
    if (run.kind === 'done') {
      primary = {
        label: m.ocr_show_results(),
        onPress: () => {
          showWordsToCheck();
          close();
        },
      };
      secondary = (
        <Button variant="quiet" onClick={again}>
          {m.ocr_run_again()}
        </Button>
      );
    } else {
      primary = { label: m.ocr_back(), onPress: again };
    }
  } else {
    body = form.body;
    primary = form.primary;
  }

  return (
    <Sheet
      id={OCR_SHEET}
      kind="tool"
      open={open}
      onClose={close}
      title={title}
      back={back}
      primary={primary}
      secondary={secondary}
      {...(cancel === false ? { cancel } : {})}
      testId="ocr-dialog"
    >
      {body}
    </Sheet>
  );
}

type Loaded<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly value: T }
  | { readonly status: 'failed'; readonly message: string };

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Facts of every source of the document, and the language packs. */
function useRunInputs(sources: readonly SourceId[]) {
  const [facts, setFacts] = useState<Loaded<FactsBySource>>({ status: 'loading' });
  const [packs, setPacks] = useState<Loaded<readonly OcrLanguagePack[]>>({ status: 'loading' });
  const key = sources.join('|');
  useEffect(() => {
    let live = true;
    const deps = ocrDependencies();
    const ids = key === '' ? [] : (key.split('|') as SourceId[]);
    Promise.all(ids.map(async (id) => [id, await deps.facts(id)] as const)).then(
      (entries) => {
        if (live) setFacts({ status: 'ready', value: new Map(entries) });
      },
      (error: unknown) => {
        if (live) setFacts({ status: 'failed', message: message(error) });
      },
    );
    deps
      .packs()
      .then((store) => store.list())
      .then(
        (list) => {
          if (live) setPacks({ status: 'ready', value: list });
        },
        (error: unknown) => {
          if (live) setPacks({ status: 'failed', message: message(error) });
        },
      );
    return () => {
      live = false;
    };
  }, [key]);
  return { facts, packs };
}

function useRunForm(documentId: DocumentId | undefined): {
  readonly body: ReactNode;
  readonly primary: SheetPrimary | undefined;
} {
  const doc = useWorkspaceStore((s) =>
    documentId === undefined ? undefined : s.workspace.documents[documentId],
  );
  const sourceFlags = useWorkspaceStore((s) => s.workspace.sources);
  const signatures = useSignatureStore((s) => s.entries);
  const currentPage = useViewStore((s) => s.currentPage);
  const targets = useMemo(() => (doc ? documentTargets(doc) : []), [doc]);
  const sources = useMemo(() => [...new Set(targets.map((t) => t.source))], [targets]);
  const { facts, packs } = useRunInputs(sources);
  const locale = getLocale();
  const pageCount = doc?.pages.length ?? 0;
  const factsMap: FactsBySource = facts.status === 'ready' ? facts.value : new Map();

  const [scope, setScope] = useState<OcrScope | null>(null);
  const [range, setRange] = useState('');
  const [chosen, setChosen] = useState<readonly string[] | null>(null);
  const [quality, setQuality] = useState<'standard' | 'high'>('standard');
  const [replace, setReplace] = useState<boolean | null>(null);
  const scopeName = useId();
  const qualityName = useId();
  const rangeHint = useId();

  const effectiveScope = scope ?? defaultScope(targets, factsMap);
  const parsedRange = parsePageRange(range, pageCount);
  const selected =
    scopeTargets(targets, effectiveScope, {
      facts: factsMap,
      currentPage: Math.min(currentPage, Math.max(0, pageCount - 1)),
      range: parsedRange,
    }) ?? null;
  const withoutText = targets.filter((t) => lacksVisibleText(factsMap, t)).length;
  const invisible = invisibleTextOf(selected ?? [], factsMap);
  const replaceShown = invisible.ours + invisible.foreign > 0;
  const replaceChecked = replaceShown && (replace ?? defaultReplace(invisible));

  const available = packs.status === 'ready' ? packs.value : [];
  const languages =
    chosen ??
    defaultLanguages(
      locale,
      available.map((p) => p.code),
    );
  const download = available
    .filter((p) => languages.includes(p.code))
    .reduce((sum, p) => sum + p.downloadBytes, 0);
  const signedSources = [...new Set((selected ?? []).map((t) => t.source))].filter((id) => {
    if (sourceFlags[id]?.flags.hasSignatures !== true) return false;
    const entry = signatures[id];
    return !(entry?.status === 'ready' && entry.reports.length === 0);
  });

  const ready = facts.status === 'ready' && packs.status === 'ready';
  const count = selected?.length ?? 0;
  const canRun = ready && count > 0 && languages.length > 0;

  const toggleLanguage = (code: string, on: boolean) => {
    setChosen(
      on ? [...languages.filter((c) => c !== code), code] : languages.filter((c) => c !== code),
    );
  };

  const submit = () => {
    if (!canRun || !selected || documentId === undefined) return;
    void startOcrRun({
      documentId,
      targets: selected,
      facts: factsMap,
      languages,
      quality,
      replace: replaceChecked,
    });
  };

  if (!doc) return { body: null, primary: undefined };
  const reason = !ready
    ? m.ocr_checking_pages()
    : count === 0
      ? m.ocr_no_pages()
      : languages.length === 0
        ? m.ocr_languages_none()
        : undefined;
  return {
    primary: {
      label: m.ocr_run({ count }),
      onPress: submit,
      disabled: !canRun,
      reason,
    },
    body: (
      <div className={styles.body} data-testid="ocr-form">
        <fieldset className={toolStyles.fieldset}>
          <legend className={toolStyles.legend}>{m.ocr_pages()}</legend>
          {facts.status === 'loading' ? (
            <p className={toolStyles.hint} role="status">
              {m.ocr_checking_pages()}
            </p>
          ) : facts.status === 'failed' ? (
            <p className={toolStyles.error} role="alert">
              {m.ocr_facts_failed({ reason: facts.message })}
            </p>
          ) : null}
          <div className={styles.stack}>
            {(['without-text', 'all', 'current', 'range'] as const).map((option) => (
              <label key={option} className={toolStyles.check}>
                <input
                  type="radio"
                  name={scopeName}
                  value={option}
                  checked={effectiveScope === option}
                  disabled={option === 'without-text' && withoutText === 0}
                  onChange={() => setScope(option)}
                />
                <span>
                  {option === 'without-text'
                    ? m.ocr_scope_without_text({ count: withoutText })
                    : option === 'all'
                      ? m.ocr_scope_all({ count: targets.length })
                      : option === 'current'
                        ? m.ocr_scope_current({
                            page: Math.min(currentPage, Math.max(0, pageCount - 1)) + 1,
                          })
                        : m.ocr_scope_range()}
                </span>
              </label>
            ))}
          </div>
          {effectiveScope === 'range' ? (
            <label className={toolStyles.field}>
              <span className="visually-hidden">{m.ocr_scope_range()}</span>
              <input
                className={toolStyles.input}
                value={range}
                placeholder={`1-${pageCount}`}
                aria-invalid={parsedRange === null}
                aria-describedby={rangeHint}
                onChange={(event) => setRange(event.target.value)}
              />
              <span id={rangeHint} className={toolStyles.hint}>
                {parsedRange === null
                  ? m.images_pages_invalid({ count: pageCount })
                  : m.images_pages_hint()}
              </span>
            </label>
          ) : null}
          {targets.length < pageCount ? (
            <p className={toolStyles.hint}>{m.ocr_scope_skipped()}</p>
          ) : null}
        </fieldset>

        <fieldset className={toolStyles.fieldset}>
          <legend className={toolStyles.legend}>{m.ocr_languages()}</legend>
          {packs.status === 'failed' ? (
            <p className={toolStyles.error} role="alert">
              {m.ocr_packs_failed({ reason: packs.message })}
            </p>
          ) : null}
          <ul className={styles.languages} aria-label={m.ocr_languages()}>
            {available.map((pack) => (
              <li key={pack.code}>
                <label className={styles.language}>
                  <input
                    type="checkbox"
                    checked={languages.includes(pack.code)}
                    onChange={(event) => toggleLanguage(pack.code, event.target.checked)}
                  />
                  <span className={styles.languageName}>{languageName(pack.code, locale)}</span>
                  <span className={styles.meta} data-testid="ocr-language-state">
                    {pack.onDevice
                      ? m.ocr_pack_on_device({ size: formatMegabytes(pack.bytes, locale) })
                      : m.ocr_pack_downloads({ size: formatMegabytes(pack.downloadBytes, locale) })}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className={styles.row}>
            <span className={toolStyles.hint} data-testid="ocr-languages-key">
              {languages.length > 0
                ? m.ocr_languages_order({ languages: languagesKey(languages) })
                : m.ocr_languages_none()}
            </span>
            <span className={toolStyles.spacer} />
            <button
              type="button"
              className={styles.link}
              onClick={() => setOcrDialogView('languages')}
            >
              {m.ocr_manage_languages()}
            </button>
          </div>
          {download > 0 ? (
            <p className={toolStyles.hint}>
              {m.ocr_download_note({ size: formatMegabytes(download, locale) })}
            </p>
          ) : null}
        </fieldset>

        <fieldset className={toolStyles.fieldset}>
          <legend className={toolStyles.legend}>{m.ocr_quality()}</legend>
          <div className={styles.presets}>
            {(['standard', 'high'] as const).map((option) => (
              <label key={option} className={toolStyles.preset}>
                <input
                  type="radio"
                  name={qualityName}
                  value={option}
                  checked={quality === option}
                  onChange={() => setQuality(option)}
                />
                <span className={toolStyles.presetName}>
                  {option === 'standard' ? m.ocr_quality_standard() : m.ocr_quality_high()}
                </span>
                <span className={toolStyles.hint}>
                  {option === 'standard'
                    ? m.ocr_quality_standard_hint()
                    : m.ocr_quality_high_hint()}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {replaceShown ? (
          <div className={styles.stack}>
            <label className={toolStyles.check}>
              <input
                type="checkbox"
                checked={replaceChecked}
                onChange={(event) => setReplace(event.target.checked)}
              />
              <span>{m.ocr_replace()}</span>
            </label>
            <p className={toolStyles.hint} data-testid="ocr-replace-hint">
              {invisible.foreign > 0
                ? m.ocr_replace_foreign({ count: invisible.foreign })
                : m.ocr_replace_ours({ count: invisible.ours })}
            </p>
          </div>
        ) : null}

        {signedSources.length > 0 ? (
          <p className={styles.notice} data-testid="ocr-signed-warning">
            {m.ocr_signed_warning()}
          </p>
        ) : null}
        <p className={styles.notice} data-testid="ocr-honesty">
          {m.ocr_honesty()}
        </p>
      </div>
    ),
  };
}

function phaseText(run: Extract<OcrRun, { kind: 'running' }>): string {
  switch (run.phase) {
    case 'prepare':
      return m.ocr_phase_prepare();
    case 'download':
      return run.download
        ? m.ocr_phase_download({
            count: run.languages,
            done: formatMegabytes(run.download.done, getLocale()),
            total: formatMegabytes(run.download.total, getLocale()),
          })
        : m.ocr_phase_prepare();
    case 'start':
      return m.ocr_phase_start();
    case 'recognize':
      return m.ocr_phase_recognize(pageProgress(run));
    case 'recheck':
      return m.ocr_phase_recheck(pageProgress(run));
    case 'write':
      return m.ocr_phase_write();
  }
}

function Progress({ run }: { readonly run: Extract<OcrRun, { kind: 'running' }> }) {
  const value =
    run.phase === 'download' && run.download && run.download.total > 0
      ? run.download.done / run.download.total
      : run.total > 0
        ? run.done / run.total
        : 0;
  return (
    <div className={styles.body} data-testid="ocr-progress">
      <p className={toolStyles.description} role="status">
        {phaseText(run)}
      </p>
      <progress
        className={toolStyles.progress}
        max={1}
        value={value}
        aria-label={m.ocr_progress_label()}
      />
      <p className={toolStyles.hint}>{m.ocr_progress_continues()}</p>
    </div>
  );
}

function Outcome({ run }: { readonly run: Exclude<OcrRun, { kind: 'idle' | 'running' }> }) {
  if (run.kind === 'done') {
    const { result } = run;
    const parts = (['good', 'review', 'poor', 'no-text'] as const)
      .filter((q) => result.byQuality[q] > 0)
      .map((q) => `${qualityLabel(q)}: ${formatNumber(result.byQuality[q])}`);
    return (
      <div className={styles.body} data-testid="ocr-result">
        <p className={toolStyles.strong}>{result.label}</p>
        <p className={toolStyles.description}>{parts.join(' · ')}</p>
        <p className={toolStyles.hint}>
          {m.ocr_result_words({
            words: formatNumber(result.words),
            low: formatNumber(result.lowConfidence),
          })}
        </p>
        {result.timedOut > 0 ? (
          <p className={styles.notice}>{m.ocr_result_timed_out({ count: result.timedOut })}</p>
        ) : null}
        {result.reducedDpi > 0 ? (
          <p className={toolStyles.hint}>
            {m.ocr_result_reduced_dpi({ count: result.reducedDpi })}
          </p>
        ) : null}
        <p className={styles.notice}>{m.ocr_honesty()}</p>
      </div>
    );
  }
  return (
    <div className={styles.body} data-testid="ocr-outcome">
      {run.kind === 'failed' ? (
        <p className={toolStyles.error} role="alert">
          {m.ocr_failed({ reason: run.message })}
        </p>
      ) : (
        <p className={toolStyles.description} role="status">
          {m.ocr_cancelled()}
        </p>
      )}
    </div>
  );
}

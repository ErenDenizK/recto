/**
 * S19 Apply redactions (`components/07-sheets.md` §20; spec redaction-and-text-editing §1.2): a
 * confirmation on the one Sheet primitive that says exactly what will happen (ticked marks
 * become permanent removals, irreversible once exported, attachments removed unless kept, fill
 * and overlay text, "area only"), then the apply with its self-check, then the result with
 * every report, or, when the gate or the self-check stopped it, the stage and the findings with
 * the document unchanged.
 *
 * - **One surface.** The sheet is mounted in the shell (`AppShell`), so the markup bar's Apply
 *   redactions… opens it alone; the Review sidebar stays as it was (§20.1: pending bar → Apply,
 *   title → Apply redactions…). The Marks filter's button opens the same sheet.
 * - **Controls** are the primitives' (quality-bar Q-9): the fill is a swatch row (black, white)
 *   beside the colour well for a custom colour, as in the ink strip (`10-ink` §5); the overlay
 *   text is a text field; the options are checkboxes with their descriptions; the honesty line
 *   is the FB9 notice. Labels are sentence case (T-9).
 * - **The act** is the danger label with the `redact` glyph, never lime (§20.3, §27.14), and
 *   takes focus on open: the apply can be undone while the document is open (§20.6).
 *
 * Short text under the ticked marks (fewer than 4 characters, e.g. "NDA") is removed inside
 * the marks only; the form lists it with a tick per string to search and scrub it
 * document-wide as well. The result says which short strings were left to the areas, and
 * which streams the self-check could not decode and so did not search.
 *
 * The run and its outcome live in apply-store.ts: the sheet cannot be closed while it works
 * (Esc is ignored and a confirmation's scrim ignores presses), and it shows the outcome until
 * closed.
 */
import type { ForensicReport, RedactionGateReport } from '@pdf-editor/engine';
import { type ReactNode, useEffect, useState } from 'react';

import { useAnnotationStore } from '../annotations/annotation-store';
import { formatNumber, m } from '../i18n';
import { pagesPhrase, useWorkspaceStore } from '../state/workspace-store';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { ColourPicker } from '../ui/colour/ColourPicker';
import { Icon } from '../ui/Icon';
import { Notice } from '../ui/Notice';
import { Progress } from '../ui/Progress';
import { Sheet, type SheetPrimary } from '../ui/sheet';
import { Swatch } from '../ui/Swatch';
import { SwatchGroup } from '../ui/SwatchGroup';
import { TextField } from '../ui/TextField';
import {
  type ApplyChoices,
  type ApplyOutcome,
  DEFAULT_CHOICES,
  type ShortText,
  type SourceRedaction,
  shortTextUnderMarks,
} from './apply';
import { dismissApplyOutcome, runApply, useApplyDialogStore } from './apply-store';
import styles from './ApplySheet.module.css';
import { collectMarks, type MarkEntry, useRedactionStore } from './redaction-store';
import { checkName, failingCheckLines, leftoverName } from './report-text';

/** The sheet's id (the one-at-a-time rule; `[data-sheet]` in tests). */
export const APPLY_SHEET = 'redaction-apply';

const BLACK = '#000000';
const WHITE = '#FFFFFF';

/** Mount once in the shell: the sheet, from its first opening on. */
export function ApplyRedactionsSheet() {
  const open = useApplyDialogStore((s) => s.open);
  const opened = useApplyDialogStore((s) => s.opened);
  if (opened === 0) return null;
  // A new key per opening: the form's choices start afresh, and the closing sheet keeps what
  // it showed while it leaves.
  return <ApplyFlow key={opened} open={open} />;
}

interface TickCounts {
  readonly ticked: number;
  readonly unticked: number;
  /** One entry per ticked mark (a page shown twice lists its marks once). */
  readonly marks: readonly MarkEntry[];
}

function useTickCounts(): TickCounts {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const pages = useAnnotationStore((s) => s.pages);
  const excluded = useRedactionStore((s) => s.excluded);
  const byKey = new Map<string, MarkEntry>();
  for (const entry of collectMarks(workspace, pages).entries) {
    if (!byKey.has(entry.markKey)) byKey.set(entry.markKey, entry);
  }
  const marks = [...byKey.values()].filter((e) => !excluded.has(e.markKey));
  return { ticked: marks.length, unticked: byKey.size - marks.length, marks };
}

/** Short text under the ticked marks (see `shortTextUnderMarks`); empty while reading. */
function useShortTexts(marks: readonly MarkEntry[]): readonly ShortText[] {
  // `marks` is rebuilt every render; the key holds what the search reads, and changes only
  // when that does.
  const key = JSON.stringify(
    marks.map((e) => ({
      source: e.source,
      mark: { pageIndex: e.mark.pageIndex, quads: e.mark.quads },
    })),
  );
  const [found, setFound] = useState<{ key: string; texts: readonly ShortText[] }>();
  useEffect(() => {
    let live = true;
    void shortTextUnderMarks(JSON.parse(key) as Parameters<typeof shortTextUnderMarks>[0]).then(
      (texts) => {
        if (live) setFound({ key, texts });
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [key]);
  return found?.key === key ? found.texts : [];
}

const shortKey = (s: ShortText) => `${s.source}\u0000${s.text}`;

/** The fill as one colour: what the well shows and the swatch row checks. */
function fillColour(choices: ApplyChoices): string {
  if (choices.fill === 'black') return BLACK;
  if (choices.fill === 'white') return WHITE;
  return choices.customColor.toUpperCase();
}

/** A colour chosen in the well or the row: black and white are their own choices. */
function fillOf(colour: string): Pick<ApplyChoices, 'fill'> & Partial<ApplyChoices> {
  const hex = colour.toUpperCase();
  if (hex === BLACK) return { fill: 'black' };
  if (hex === WHITE) return { fill: 'white' };
  return { fill: 'custom', customColor: hex.toLowerCase() };
}

function ApplyFlow({ open }: { readonly open: boolean }) {
  const run = useApplyDialogStore((s) => s.run);
  const close = () => useApplyDialogStore.getState().setOpen(false);
  const [choices, setChoices] = useState<ApplyChoices>(DEFAULT_CHOICES);
  const { ticked, unticked, marks } = useTickCounts();
  const shortTexts = useShortTexts(run.kind === 'idle' ? marks : []);
  const [searched, setSearched] = useState<ReadonlySet<string>>(new Set());
  const set = (patch: Partial<ApplyChoices>) => setChoices((c) => ({ ...c, ...patch }));

  // The result's Close takes focus when the work ends (a field that submitted is gone).
  useEffect(() => {
    if (run.kind !== 'done') return;
    document
      .querySelector<HTMLElement>(`[data-sheet="${APPLY_SHEET}"] [data-sheet-primary]`)
      ?.focus();
  }, [run.kind]);

  const apply = () => {
    const alsoSearch = shortTexts.filter((s) => searched.has(shortKey(s)));
    void runApply({ ...choices, alsoSearch });
  };

  let title = m.redaction_apply_title();
  let description: ReactNode;
  let body: ReactNode;
  let primary: SheetPrimary;
  let secondary: ReactNode;
  if (run.kind === 'done') {
    title =
      run.outcome.kind === 'applied'
        ? m.redaction_result_title()
        : run.outcome.kind === 'blocked'
          ? m.redaction_blocked_title()
          : m.redaction_apply_title();
    body = <Outcome outcome={run.outcome} />;
    primary = { label: m.common_close(), onPress: close };
    secondary =
      run.outcome.kind === 'applied' ? undefined : (
        <Button variant="quiet" onClick={dismissApplyOutcome}>
          {m.common_back()}
        </Button>
      );
  } else {
    const working = run.kind === 'working';
    description = working ? undefined : (
      <>
        {m.redaction_apply_scope({ count: ticked, countText: formatNumber(ticked) })}{' '}
        {unticked > 0
          ? m.redaction_apply_unticked({ count: unticked, countText: formatNumber(unticked) })
          : null}
      </>
    );
    primary = {
      label: m.redaction_apply_confirm(),
      onPress: apply,
      danger: true,
      icon: <Icon name="redact" />,
      disabled: ticked === 0,
      reason: ticked === 0 ? m.redaction_apply_none() : undefined,
      busy: working,
      testId: 'redaction-apply-confirm',
    };
    body = working ? (
      <div role="status" className={styles.working}>
        <Progress value={null} label={m.redaction_applying()} hideValue />
      </div>
    ) : (
      <ApplyForm
        choices={choices}
        set={set}
        shortTexts={shortTexts}
        searched={searched}
        setSearched={setSearched}
      />
    );
  }

  return (
    <Sheet
      id={APPLY_SHEET}
      kind="confirmation"
      open={open}
      onClose={close}
      title={title}
      description={description}
      primary={primary}
      secondary={secondary}
      {...(run.kind === 'idle' ? {} : { cancel: false as const })}
      initialFocus="primary"
      testId="redaction-apply-dialog"
    >
      {body}
    </Sheet>
  );
}

function ApplyForm({
  choices,
  set,
  shortTexts,
  searched,
  setSearched,
}: {
  readonly choices: ApplyChoices;
  readonly set: (patch: Partial<ApplyChoices>) => void;
  readonly shortTexts: readonly ShortText[];
  readonly searched: ReadonlySet<string>;
  readonly setSearched: (next: ReadonlySet<string>) => void;
}) {
  const colour = fillColour(choices);
  return (
    <div className={styles.form} data-testid="redaction-apply-form">
      <p className={styles.text}>{m.redaction_apply_what()}</p>
      <Notice>{m.redaction_apply_irreversible()}</Notice>
      <div className={styles.group}>
        <p className={styles.legend}>{m.redaction_apply_fill()}</p>
        <div className={styles.fills}>
          <SwatchGroup
            label={m.redaction_apply_fill()}
            value={colour === BLACK || colour === WHITE ? colour : null}
            onValueChange={(value) => set(fillOf(value))}
            className={styles.swatches}
          >
            <Swatch value={BLACK} name={m.redaction_fill_black()} />
            <Swatch value={WHITE} name={m.redaction_fill_white()} />
          </SwatchGroup>
          <span className={styles.divider} aria-hidden="true" />
          <ColourPicker
            value={colour}
            label={m.redaction_fill_custom_label()}
            onChange={(value) => set(fillOf(value))}
            side="right"
          />
        </div>
      </div>
      <TextField
        label={m.redaction_overlay_label()}
        value={choices.overlayText}
        onValueChange={(overlayText) => set({ overlayText })}
        placeholder={m.redaction_overlay_placeholder()}
        maxLength={60}
        spellCheck={false}
        autoComplete="off"
      />
      <div className={styles.group}>
        <Checkbox
          checked={choices.keepAttachments}
          onCheckedChange={(keepAttachments) => set({ keepAttachments })}
          label={m.redaction_keep_attachments()}
          description={m.redaction_keep_attachments_hint()}
        />
        <Checkbox
          checked={choices.areaOnly}
          onCheckedChange={(areaOnly) => set({ areaOnly })}
          label={m.redaction_area_only()}
          description={m.redaction_area_only_hint()}
        />
      </div>
      {shortTexts.length > 0 && !choices.areaOnly ? (
        <div className={styles.group} data-testid="redaction-short-texts">
          <p className={styles.legend}>{m.redaction_short_title()}</p>
          <p className={styles.note}>{m.redaction_short_hint()}</p>
          {shortTexts.map((short) => {
            const key = shortKey(short);
            return (
              <Checkbox
                key={key}
                checked={searched.has(key)}
                onCheckedChange={(on) => {
                  const next = new Set(searched);
                  if (on) next.add(key);
                  else next.delete(key);
                  setSearched(next);
                }}
                label={m.redaction_short_search({ text: short.text })}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** The result sheet of an apply (also shown by "Crop pages…" with discard, crop/). */
export function Outcome({ outcome }: { readonly outcome: ApplyOutcome }) {
  if (outcome.kind === 'applied') {
    return (
      <div className={styles.stack} data-testid="redaction-result">
        {outcome.sources.map((source) => (
          <SourceResult key={source.source} source={source} showName={outcome.sources.length > 1} />
        ))}
        <p className={styles.note}>{m.redaction_result_export_note()}</p>
      </div>
    );
  }
  if (outcome.kind === 'blocked') {
    const { failure } = outcome;
    const failing = failure.forensic?.checks.filter((c) => !c.passed).map((c) => c.id) ?? [];
    const lines =
      outcome.stage === 'gate' && failure.gate
        ? gateLines(failure.gate)
        : failure.forensic
          ? failingCheckLines(failure.forensic)
          : [];
    return (
      <div className={styles.stack} data-testid="redaction-blocked">
        <p className={styles.error} role="alert" data-stage={outcome.stage}>
          {outcome.stage === 'gate' ? m.redaction_blocked_gate() : m.redaction_blocked_forensic()}
        </p>
        {outcome.name ? (
          <p className={styles.note}>{m.redaction_blocked_source({ name: outcome.name })}</p>
        ) : null}
        {lines.length > 0 ? (
          <ul className={styles.findings} data-testid="redaction-findings">
            {lines.map((line, index) => (
              <li key={`${index}:${line}`}>{line}</li>
            ))}
          </ul>
        ) : null}
        {failing.includes('no-search-hits') ? (
          <p className={styles.note}>{m.redaction_blocked_hint_search()}</p>
        ) : null}
        {failure.plan.keepAttachments &&
        (failure.forensic?.unverifiedAttachments.length ?? 0) > 0 &&
        (failing.includes('object-strings') || failing.includes('byte-grep')) ? (
          <p className={styles.note}>{m.redaction_blocked_hint_attachments()}</p>
        ) : null}
        {failure.forensic ? <CheckList report={failure.forensic} /> : null}
      </div>
    );
  }
  if (outcome.kind === 'error') {
    return (
      <p className={styles.error} role="alert">
        {m.redaction_apply_failed()} {outcome.message}
      </p>
    );
  }
  return <p className={styles.text}>{m.redaction_apply_none()}</p>;
}

function gateLines(gate: RedactionGateReport): string[] {
  return gate.areas
    .filter((area) => !area.blank)
    .map((area) =>
      m.redaction_blocked_area({
        page: area.pageIndex + 1,
        area: area.areaIndex + 1,
        kinds: area.remaining.map(leftoverName).join(', '),
      }),
    );
}

function SourceResult({
  source,
  showName,
}: {
  readonly source: SourceRedaction;
  readonly showName: boolean;
}) {
  const { result } = source;
  const pages = new Set(result.plan.areas.map((a) => a.pageIndex)).size;
  const areas = m.redaction_result_areas({
    count: result.plan.areas.length,
    countText: formatNumber(result.plan.areas.length),
    pages: pagesPhrase(pages),
  });
  const report = result.redaction;
  const facts: [string, number][] = [
    [m.redaction_result_paths(), result.engine.pathsRemoved],
    [m.redaction_result_images(), result.engine.imagesRemoved],
    [m.redaction_result_annotations(), report.annotationsRemoved],
    [m.redaction_result_fields(), report.fieldsCleared],
    [m.redaction_result_strings(), report.stringsReplaced],
    [m.redaction_result_searched(), result.plan.strings.length],
    [m.redaction_result_attachments(), report.attachments.removed],
    [m.redaction_result_kept_marks(), source.keptMarks],
  ];
  // Short text left to the areas: captured but not in the searched strings.
  const searched = new Set(result.plan.strings.map((s) => s.normalize('NFKC').toLowerCase()));
  const skipped = result.captured.skipped.filter(
    (s) => !searched.has(s.normalize('NFKC').toLowerCase()),
  );
  return (
    <section className={styles.stack} data-redaction-source="">
      <h3 className={styles.sourceTitle} data-testid="redaction-result-areas">
        {showName ? m.redaction_result_source({ name: source.name, areas }) : areas}
      </h3>
      <dl className={styles.facts}>
        {facts.map(([label, value]) => (
          <div key={label} className={styles.fact}>
            <dt>{label}</dt>
            <dd>{formatNumber(value)}</dd>
          </div>
        ))}
      </dl>
      {source.removedMarks > 0 ? (
        <p className={styles.note} data-testid="redaction-removed-marks">
          {m.redaction_result_removed_marks({
            count: source.removedMarks,
            countText: formatNumber(source.removedMarks),
          })}
        </p>
      ) : null}
      {skipped.length > 0 ? (
        <p className={styles.note} data-testid="redaction-skipped">
          {m.redaction_result_skipped({ strings: skipped.map((s) => `“${s}”`).join(', ') })}
        </p>
      ) : null}
      {report.attachments.unverified.length > 0 ? (
        <p className={styles.note}>
          {m.redaction_result_unverified({ names: report.attachments.unverified.join(', ') })}
        </p>
      ) : null}
      {report.structure === 'pruned' ? (
        <p className={styles.note}>{m.redaction_result_tags_pruned()}</p>
      ) : report.structure === 'untagged' ? (
        <p className={styles.note}>{m.redaction_result_tags_removed()}</p>
      ) : null}
      {result.gate.ok ? <p className={styles.verified}>{m.redaction_result_gate()}</p> : null}
      <CheckList report={result.forensic} />
    </section>
  );
}

/**
 * Streams the self-check could not decode, grouped by filter: entries read
 * "object 12 (DCTDecode)" or "object 7 (JBIG2Decode, FlateDecode)" (engine forensic-objects.ts).
 */
export function notSearchedGroups(entries: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const named = /\(([^)]*)\)\s*$/.exec(entry)?.[1]?.trim() ?? '';
    const filter = named === '' ? m.redaction_not_searched_unknown() : named;
    counts.set(filter, (counts.get(filter) ?? 0) + 1);
  }
  return [...counts]
    .map(([filter, count]) =>
      m.redaction_not_searched_group({ filter, count: formatNumber(count) }),
    )
    .join(', ');
}

function CheckList({ report }: { readonly report: ForensicReport }) {
  const passed = report.checks.filter((c) => c.passed).length;
  return (
    <>
      {report.notSearched.length > 0 ? (
        <p className={styles.note} data-testid="redaction-not-searched">
          {m.redaction_result_not_searched({
            count: report.notSearched.length,
            groups: notSearchedGroups(report.notSearched),
          })}
        </p>
      ) : null}
      <p className={styles.note} data-testid="redaction-checks-summary">
        {m.redaction_result_checks({
          passed: formatNumber(passed),
          total: formatNumber(report.checks.length),
        })}
      </p>
      <ul
        className={styles.checks}
        aria-label={m.redaction_result_checks({ passed, total: report.checks.length })}
      >
        {report.checks.map((check) => (
          <li
            key={check.id}
            data-check={check.id}
            data-passed={String(check.passed)}
            data-testid="redaction-check"
          >
            <span>{checkName(check.id)}</span>
            <span className={styles.status}>
              {check.passed ? m.redaction_check_passed() : m.redaction_check_failed()}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

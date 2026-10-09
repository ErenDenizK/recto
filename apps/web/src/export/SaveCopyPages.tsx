/**
 * The pages Save a copy pushes (components/07-sheets.md §4.6; §2.1 the one result page):
 *
 * - **What gets smaller**: the analysis of today's Compress dialog, the estimate, every image
 *   with what the chosen size does to it and why one is left alone, and a before and after of
 *   one page at 200 % once the person asks to compare (the compression runs then).
 * - **Details**: the last copy's summary, what was kept, rewritten, renamed or removed
 *   (`export/summary.ts`), reached from the success toast.
 */
import {
  type CompressionAnalysis,
  type CompressionResult,
  type CompressionSettings,
  estimateCompression,
  planImage,
} from '@pdf-editor/engine/client';
import { useEffect, useRef, useState } from 'react';

import { formatNumber, formatSize, m } from '../i18n';
import { getCompressor } from '../tools/compress-client';
import { deltaPercent } from '../tools/compress-math';
import { openScratch, type ScratchDocument, toolRenderer } from '../tools/engine-access';
import { skipReason } from '../tools/labels';
import { Select } from '../ui/Select';
import { SheetResult } from '../ui/sheet';
import { Switch } from '../ui/Switch';
import type { CopySummary } from './export-store';
import styles from './SaveCopySheet.module.css';

// ---------------------------------------------------------------------------
// What gets smaller
// ---------------------------------------------------------------------------

type Comparison =
  | { readonly state: 'off' }
  | { readonly state: 'working' }
  | { readonly state: 'ready'; readonly result: CompressionResult }
  | { readonly state: 'failed'; readonly message: string };

export function WhatGetsSmaller({
  analysis,
  source,
  settings,
  sizeLabel,
}: {
  readonly analysis: CompressionAnalysis | null;
  /** The assembled bytes the analysis read. */
  readonly source: ArrayBuffer | null;
  /** The chosen size's compression (Smaller when the choice is Same as original). */
  readonly settings: CompressionSettings;
  /** The chosen size's name ("Smaller"). */
  readonly sizeLabel: string;
}) {
  const [comparison, setComparison] = useState<Comparison>({ state: 'off' });
  const [page, setPage] = useState(0);
  const settingsKey = JSON.stringify(settings);
  const [comparedKey, setComparedKey] = useState(settingsKey);
  // A new size makes the comparison stale: run it again for the new settings.
  if (comparedKey !== settingsKey) {
    setComparedKey(settingsKey);
    if (comparison.state !== 'off') setComparison({ state: 'working' });
  }

  useEffect(() => {
    if (comparison.state !== 'working' || source === null) return undefined;
    const abort = new AbortController();
    void (async () => {
      try {
        const compressor = await getCompressor();
        const result = await compressor.compress(source.slice(0), settings, {
          signal: abort.signal,
        });
        if (abort.signal.aborted) return;
        let best = 0;
        let saved = 0;
        for (const p of result.pages) {
          if (p.before - p.after > saved) {
            saved = p.before - p.after;
            best = p.page;
          }
        }
        setPage(best);
        setComparison({ state: 'ready', result });
      } catch (error) {
        if (!abort.signal.aborted) {
          setComparison({
            state: 'failed',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    })();
    return () => abort.abort();
    // `settingsKey` names `settings`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparison.state, source, settingsKey]);

  if (analysis === null) {
    return (
      <p className={styles.note} role="status">
        {m.compress_preparing()}
      </p>
    );
  }
  const estimate = estimateCompression(analysis, settings);
  return (
    <div className={styles.section} data-testid="save-copy-what-smaller-page">
      <p className={styles.note}>
        {m.compress_summary({
          size: formatSize(analysis.totalBytes),
          images: m.tools_images_count({ count: analysis.images.length }),
          fonts: m.tools_fonts_count({ count: analysis.fonts.length }),
          objects: analysis.objectCount,
        })}
      </p>
      <p className={styles.note} data-testid="compress-estimate">
        <strong>{sizeLabel}</strong> ·{' '}
        {m.compress_estimate({
          before: formatSize(estimate.before),
          after: formatSize(estimate.after),
          delta: deltaPercent(estimate.before, estimate.after),
        })}
      </p>
      {estimate.worthwhile ? null : <p className={styles.note}>{m.compress_estimate_low()}</p>}
      {analysis.images.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption>{m.compress_table_label()}</caption>
            <thead>
              <tr>
                <th scope="col">{m.compress_col_page()}</th>
                <th scope="col">{m.compress_col_pixels()}</th>
                <th scope="col">{m.compress_col_colour()}</th>
                <th scope="col">{m.compress_col_dpi()}</th>
                <th scope="col">{m.compress_col_bytes()}</th>
              </tr>
            </thead>
            <tbody>
              {analysis.images.map((image) => {
                const plan = settings.images ? planImage(image, settings) : null;
                const planText =
                  plan === null
                    ? '–'
                    : plan.action === 'skip'
                      ? skipReason(plan.reason)
                      : plan.downsample
                        ? m.compress_plan_downsample({ width: plan.width, height: plan.height })
                        : m.compress_plan_recompress();
                // The plan takes a row of its own under the image, so the table fits the sheet.
                return [
                  <tr key={image.ref} data-image="">
                    <td>{image.page === null ? '–' : image.page + 1}</td>
                    <td>
                      {image.width}×{image.height}
                    </td>
                    <td>
                      {image.colorSpace}
                      {image.hasSMask ? ' + α' : ''}
                    </td>
                    <td>{image.dpi ? Math.min(image.dpi.x, image.dpi.y) : m.compress_unknown()}</td>
                    <td>{formatSize(image.bytes)}</td>
                  </tr>,
                  <tr key={`${image.ref}-plan`} data-plan="">
                    <td
                      colSpan={5}
                      data-skip={plan?.action === 'skip' || plan === null || undefined}
                    >
                      {m.compress_col_plan()}: {planText}
                    </td>
                  </tr>,
                ];
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={styles.note}>{m.compress_no_images()}</p>
      )}
      <Switch
        label={m.compress_compare()}
        checked={comparison.state !== 'off'}
        busy={comparison.state === 'working'}
        onCheckedChange={(on) => setComparison(on ? { state: 'working' } : { state: 'off' })}
      />
      {comparison.state === 'failed' ? (
        <p className={styles.error} role="alert">
          {m.compress_failed({ reason: comparison.message })}
        </p>
      ) : null}
      {comparison.state === 'ready' && source ? (
        <>
          <p className={styles.note} data-testid="compress-result" role="status">
            {comparison.result.unchanged
              ? m.compress_result_unchanged()
              : m.compress_result({
                  before: formatSize(comparison.result.before),
                  after: formatSize(comparison.result.after),
                  delta: deltaPercent(comparison.result.before, comparison.result.after),
                })}
          </p>
          <BeforeAfter
            before={source}
            after={comparison.result.bytes}
            page={page}
            pageCount={analysis.pageCount}
            onPage={setPage}
          />
        </>
      ) : null}
    </div>
  );
}

/** The same page before and after at 200 %, scrolled together. */
function BeforeAfter({
  before,
  after,
  page,
  pageCount,
  onPage,
}: {
  readonly before: ArrayBuffer;
  readonly after: ArrayBuffer;
  readonly page: number;
  readonly pageCount: number;
  readonly onPage: (page: number) => void;
}) {
  const [docs, setDocs] = useState<readonly ScratchDocument[] | null>(null);
  const left = useRef<HTMLDivElement>(null);
  const right = useRef<HTMLDivElement>(null);
  const [renderedPage, setRenderedPage] = useState<number | null>(null);
  const rendering = renderedPage !== page;

  useEffect(() => {
    let cancelled = false;
    let opened: ScratchDocument[] = [];
    void Promise.all([openScratch(before.slice(0)), openScratch(after.slice(0))]).then((pair) => {
      opened = pair;
      if (cancelled) {
        for (const d of pair) void d.close();
        return;
      }
      setDocs(pair);
    });
    return () => {
      cancelled = true;
      for (const d of opened) void d.close();
    };
  }, [before, after]);

  useEffect(() => {
    if (!docs) return undefined;
    const controller = new AbortController();
    void (async () => {
      const renderer = await toolRenderer();
      for (const [doc, host] of [
        [docs[0], left.current],
        [docs[1], right.current],
      ] as const) {
        if (!doc || !host || controller.signal.aborted) continue;
        const rendered = await renderer.renderPage(doc.id, page, {
          scale: 2,
          signal: controller.signal,
        });
        const canvas = document.createElement('canvas');
        canvas.width = rendered.width;
        canvas.height = rendered.height;
        canvas.getContext('2d')?.drawImage(rendered.bitmap, 0, 0);
        rendered.bitmap.close();
        canvas.style.width = `${rendered.width / (window.devicePixelRatio || 1)}px`;
        host.replaceChildren(canvas);
      }
      if (!controller.signal.aborted) setRenderedPage(page);
    })().catch(() => {
      if (!controller.signal.aborted) setRenderedPage(page);
    });
    return () => controller.abort();
  }, [docs, page]);

  const sync = (from: HTMLDivElement | null, to: HTMLDivElement | null) => {
    if (!from || !to) return;
    to.scrollTop = from.scrollTop;
    to.scrollLeft = from.scrollLeft;
  };

  return (
    <div className={styles.compare} data-testid="compress-compare">
      <Select
        block
        label={m.compress_compare_page()}
        value={String(page)}
        onValueChange={(next) => onPage(Number(next))}
        options={Array.from({ length: pageCount }, (_, i) => ({
          value: String(i),
          label: formatNumber(i + 1),
        }))}
      />
      {rendering ? (
        <p className={styles.note} role="status">
          {m.compress_compare_rendering()}
        </p>
      ) : null}
      {(
        [
          [left, right, m.compress_compare_before()],
          [right, left, m.compress_compare_after()],
        ] as const
      ).map(([ref, other, label]) => (
        <div key={label} className={styles.pane}>
          <span className={styles.paneLabel}>
            {label} · {m.compress_compare_zoom()}
          </span>
          <div
            ref={ref}
            className={styles.viewport}
            // A scrollable region must be reachable by keyboard (WCAG 2.1.1).
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
            role="img"
            aria-label={label}
            onScroll={() => sync(ref.current, other.current)}
          />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

export function CopyDetails({ summary }: { readonly summary: CopySummary }) {
  const size = formatSize(summary.size);
  return (
    <div className={styles.section} data-testid="save-copy-details">
      <SheetResult
        tone="success"
        title={m.save_copy_details_title({ name: summary.name })}
        body={
          summary.verified && summary.seconds !== null
            ? `${size} · ${m.export_verified({ seconds: summary.seconds.toFixed(1) })}`
            : size
        }
      />
      {summary.receipt ? (
        <p className={styles.note} data-testid="save-copy-receipt">
          {summary.receipt}
        </p>
      ) : null}
      {summary.items.length > 0 ? (
        <ul className={styles.summary} aria-label={m.export_summary_label()}>
          {summary.items.map((item) => (
            <li key={item.id} data-tone={item.tone} data-summary-item={item.id}>
              {item.text}
              {item.details && item.details.length > 0 ? (
                <details className={styles.summaryDetails}>
                  <summary>{m.export_show_details({ count: item.details.length })}</summary>
                  <ul>
                    {item.details.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.note}>{m.export_nothing_changed()}</p>
      )}
    </div>
  );
}

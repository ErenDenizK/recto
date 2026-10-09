/**
 * S17 Resize pages (`components/07-sheets.md` §19; M4 page resize), a task sheet on the Sheet
 * primitive in the sheet grammar (system-audit-2026-10 §3.6.1: inset grouped lists of M rows):
 * Size (a paper preset or a custom width and height in mm, in or pt, the orientation, keep each
 * page's orientation), Content (Fit, Scale, Canvas, stretch, a 3 × 3 anchor grid), Apply to
 * (selection, the whole document, or every page of the first page's size) and a live preview
 * of the first page drawn by the same page canvas the grid uses (low priority). Every control
 * is a `ui/` one: no native radios or checkboxes (Q-9, Q-14).
 * Guard `pages` (a locked document shows the sheet's lock banner). Commits one history entry
 * (`resizePagesTo`); the model's `resizePages` converts the displayed request per page.
 */
import {
  type Anchor,
  type DocumentId,
  MAX_PAGE_SIDE,
  MIN_PAGE_SIDE,
  matchPaperSize,
  PAPER_SIZES,
  type PageId,
  type PaperSizeId,
  pageContentSize,
  pageDisplaySize,
  pagesOfSize,
  pageTotalRotation,
  type ResizeMode,
  type ResizeRequest,
  resizeContentPlacement,
  resizeForPage,
  type Size,
  type VirtualPage,
  type Workspace,
} from '@pdf-editor/document-model';
import { useId, useRef, useState } from 'react';

import { RENDER_PRIORITY } from '../engine/engine-service';
import { formatNumber, m } from '../i18n';
import { PageCanvas } from '../pages/PageCanvas';
import { displaySize, fitInBox } from '../pages/page-geometry';
import { openTitleMenu } from '../shell/frame/frame-store';
import { useChangeRefusal } from '../state/guard';
import { pagesPhrase, useWorkspaceStore } from '../state/workspace-store';
import parts from '../pages-sheets/PagesSheets.module.css';
import { AnchorGrid } from '../ui/AnchorGrid';
import { Checkbox } from '../ui/Checkbox';
import { NumberField } from '../ui/NumberField';
import { RadioGroup } from '../ui/RadioGroup';
import { Segmented } from '../ui/Segmented';
import { Select } from '../ui/Select';
import { Sheet, SheetGroup, SheetRow } from '../ui/sheet';
import own from './ResizeDialog.module.css';
import { ResizedContent } from './ResizedContent';
import { resizePagesTo } from './section-operations';

export type ResizeUnit = 'mm' | 'in' | 'pt';
export type ResizePreset = PaperSizeId | 'custom' | 'original';
export type ResizeScope = 'selection' | 'document' | 'same-size';

const PRESETS: readonly PaperSizeId[] = ['a4', 'a3', 'a5', 'letter', 'legal', 'tabloid'];
const POINTS_PER: Readonly<Record<ResizeUnit, number>> = { pt: 1, mm: 72 / 25.4, in: 72 };
const DIGITS: Readonly<Record<ResizeUnit, number>> = { pt: 2, mm: 1, in: 2 };
const PREVIEW_BOX = 148;

export function toUnit(points: number, unit: ResizeUnit): number {
  const factor = 10 ** DIGITS[unit];
  return Math.round((points / POINTS_PER[unit]) * factor) / factor;
}

export function fromUnit(value: number, unit: ResizeUnit): number {
  return value * POINTS_PER[unit];
}

function presetName(id: PaperSizeId): string {
  switch (id) {
    case 'a4':
      return 'A4';
    case 'a3':
      return 'A3';
    case 'a5':
      return 'A5';
    case 'letter':
      return m.resize_preset_letter();
    case 'legal':
      return m.resize_preset_legal();
    case 'tabloid':
      return m.resize_preset_tabloid();
  }
}

function unitName(unit: ResizeUnit): string {
  switch (unit) {
    case 'mm':
      return m.resize_unit_mm();
    case 'in':
      return m.resize_unit_in();
    case 'pt':
      return m.resize_unit_pt();
  }
}

function anchorName(anchor: Anchor): string {
  switch (anchor) {
    case 'top-left':
      return m.resize_anchor_top_left();
    case 'top-center':
      return m.resize_anchor_top();
    case 'top-right':
      return m.resize_anchor_top_right();
    case 'middle-left':
      return m.resize_anchor_left();
    case 'center':
      return m.resize_anchor_center();
    case 'middle-right':
      return m.resize_anchor_right();
    case 'bottom-left':
      return m.resize_anchor_bottom_left();
    case 'bottom-center':
      return m.resize_anchor_bottom();
    case 'bottom-right':
      return m.resize_anchor_bottom_right();
  }
}

const oriented = (size: Size, landscape: boolean): Size =>
  landscape === size.width > size.height ? size : { width: size.height, height: size.width };

/** "210 × 297 mm", or "A4 (210 × 297 mm)" for a paper size in either orientation. */
export function sizeLabel(size: Size, unit: ResizeUnit): string {
  const dims = m.resize_size_dims({
    width: formatNumber(toUnit(size.width, unit)),
    height: formatNumber(toUnit(size.height, unit)),
    unit: unitName(unit),
  });
  const paper = matchPaperSize(size, 0.5);
  return paper ? m.resize_size_named({ name: presetName(paper.id), size: dims }) : dims;
}

/** The pages a scope covers, in document order. */
function scopePages(
  ws: Workspace,
  documentId: DocumentId,
  scope: ResizeScope,
  selection: readonly PageId[],
  reference: Size | undefined,
): PageId[] {
  const doc = ws.documents[documentId];
  if (doc === undefined) return [];
  switch (scope) {
    case 'selection':
      return [...selection];
    case 'document':
      return doc.pages.map((p) => p.id);
    case 'same-size':
      return reference === undefined ? [] : pagesOfSize(ws, documentId, reference);
  }
}

function findPage(ws: Workspace, id: PageId | undefined): VirtualPage | undefined {
  if (id === undefined) return undefined;
  for (const docId of ws.documentOrder) {
    const page = ws.documents[docId]?.pages.find((p) => p.id === id);
    if (page) return page;
  }
  return undefined;
}

export function ResizeDialog({
  documentId,
  pageIds,
  open = true,
  onClose,
}: {
  readonly documentId: DocumentId;
  readonly pageIds: readonly PageId[];
  readonly open?: boolean;
  readonly onClose: () => void;
}) {
  const ws = useWorkspaceStore((s) => s.workspace);
  const refusal = useChangeRefusal(documentId, 'pages');
  const doc = ws.documents[documentId];
  const selection = pageIds.filter((id) => findPage(ws, id) !== undefined);
  const firstPage = findPage(ws, selection[0]) ?? doc?.pages[0];
  const [reference] = useState<Size | undefined>(() =>
    firstPage === undefined ? undefined : displaySize(ws, firstPage),
  );

  const [preset, setPreset] = useState<ResizePreset>('a4');
  const [landscape, setLandscape] = useState(
    () => reference !== undefined && reference.width > reference.height,
  );
  const [custom, setCustom] = useState<Size>(() => reference ?? PAPER_SIZES.a4);
  const [unit, setUnit] = useState<ResizeUnit>('mm');
  const [matchOrientation, setMatchOrientation] = useState(true);
  const [mode, setMode] = useState<ResizeMode>('fit');
  const [stretch, setStretch] = useState(false);
  const [anchor, setAnchor] = useState<Anchor>('center');
  const [scope, setScope] = useState<ResizeScope>(selection.length > 0 ? 'selection' : 'document');
  const presetRef = useRef<HTMLButtonElement>(null);
  const sizeErrorId = useId();
  const widthId = useId();
  const heightId = useId();
  const presetId = useId();

  if (doc === undefined) return null;

  const size: Size | undefined =
    preset === 'original'
      ? undefined
      : preset === 'custom'
        ? custom
        : oriented(PAPER_SIZES[preset], landscape);
  const shownSize = size ?? reference ?? PAPER_SIZES.a4;
  const sizeValid =
    size === undefined ||
    [size.width, size.height].every(
      (side) => Number.isFinite(side) && side >= MIN_PAGE_SIDE && side <= MAX_PAGE_SIDE,
    );
  const request: ResizeRequest | undefined =
    size === undefined
      ? undefined
      : {
          width: size.width,
          height: size.height,
          mode,
          anchor,
          ...(mode === 'scale' && stretch ? { stretch: true } : {}),
          matchOrientation,
        };
  const targets = scopePages(ws, documentId, scope, selection, reference);
  const ready = targets.length > 0 && sizeValid;
  const anchorDisabled = mode === 'scale' && stretch;

  const setSide = (side: 'width' | 'height', value: number) => {
    const next = { ...shownSize, [side]: fromUnit(value, unit) };
    setCustom(next);
    setLandscape(next.width > next.height);
    setPreset('custom');
  };

  const swapOrientation = (toLandscape: boolean) => {
    if (toLandscape === landscape) return;
    setLandscape(toLandscape);
    if (preset === 'custom') setCustom({ width: custom.height, height: custom.width });
  };

  const submit = () => {
    if (!ready) return;
    resizePagesTo(targets, request, size === undefined ? '' : sizeLabel(size, unit));
    onClose();
  };

  const field = (side: 'width' | 'height', id: string) => (
    <NumberField
      id={id}
      className={parts.number}
      label={side === 'width' ? m.resize_width() : m.resize_height()}
      value={toUnit(shownSize[side], unit)}
      step={unit === 'pt' ? 1 : unit === 'mm' ? 1 : 0.1}
      format={{ maximumFractionDigits: DIGITS[unit], useGrouping: false }}
      disabled={preset === 'original'}
      aria-describedby={sizeValid ? undefined : sizeErrorId}
      data-testid={`resize-${side}`}
      onValueChange={(next) => {
        if (next !== null && Number.isFinite(next)) setSide(side, next);
      }}
    />
  );

  const referenceLabel = reference === undefined ? '' : sizeLabel(reference, unit);
  const original = preset === 'original';

  return (
    <Sheet
      id="resize"
      kind="task"
      open={open}
      onClose={onClose}
      title={m.resize_title()}
      testId="resize-dialog"
      initialFocus={presetRef}
      locked={
        refusal?.kind === 'locked'
          ? { name: doc.title, onUnlock: () => openTitleMenu('menu') }
          : undefined
      }
      primary={{ label: m.resize_confirm(), onPress: submit, disabled: !ready }}
    >
      <SheetGroup
        label={m.resize_size_label()}
        footnote={
          sizeValid ? undefined : (
            <span id={sizeErrorId} className={parts.error}>
              {m.resize_error_size({
                min: formatNumber(toUnit(MIN_PAGE_SIDE, unit)),
                max: formatNumber(toUnit(MAX_PAGE_SIDE, unit)),
                unit: unitName(unit),
              })}
            </span>
          )
        }
      >
        <SheetRow title={m.resize_preset_label()} labelFor={presetId}>
          <Select<ResizePreset>
            triggerRef={presetRef}
            id={presetId}
            label={m.resize_preset_label()}
            value={preset}
            data-testid="resize-preset"
            onValueChange={setPreset}
            options={[
              ...PRESETS.map((id) => ({ value: id, label: presetName(id) })),
              { value: 'custom', label: m.resize_preset_custom() },
              { value: 'original', label: m.resize_preset_original() },
            ]}
          />
        </SheetRow>
        <SheetRow title={m.resize_width()} labelFor={widthId}>
          {field('width', widthId)}
        </SheetRow>
        <SheetRow title={m.resize_height()} labelFor={heightId}>
          {field('height', heightId)}
        </SheetRow>
        <SheetRow title={m.resize_unit_label()}>
          <Segmented<ResizeUnit>
            frameClassName={parts.segmented}
            label={m.resize_unit_label()}
            value={unit}
            onValueChange={setUnit}
            options={(['mm', 'in', 'pt'] as const).map((u) => ({ value: u, label: unitName(u) }))}
          />
        </SheetRow>
        <SheetRow title={m.resize_orientation_label()}>
          <Segmented<'portrait' | 'landscape'>
            frameClassName={parts.segmented}
            label={m.resize_orientation_label()}
            value={landscape ? 'landscape' : 'portrait'}
            onValueChange={(next) => swapOrientation(next === 'landscape')}
            options={[
              { value: 'portrait', label: m.resize_portrait(), disabled: original },
              { value: 'landscape', label: m.resize_landscape(), disabled: original },
            ]}
          />
        </SheetRow>
        <SheetRow full>
          <Checkbox
            label={m.resize_match_orientation()}
            description={m.resize_match_orientation_hint()}
            checked={matchOrientation}
            disabled={original}
            onCheckedChange={setMatchOrientation}
          />
        </SheetRow>
      </SheetGroup>

      <SheetGroup label={m.resize_mode_label()}>
        <RadioGroup<ResizeMode>
          className={parts.choices}
          label={m.resize_mode_label()}
          value={mode}
          disabled={original}
          onValueChange={setMode}
          options={(['fit', 'scale', 'canvas'] as const).map((value) => ({
            value,
            label: modeTitle(value),
            description: modeHint(value),
          }))}
        />
        <SheetRow full>
          <Checkbox
            label={m.resize_stretch()}
            checked={stretch}
            disabled={mode !== 'scale' || original}
            onCheckedChange={setStretch}
          />
        </SheetRow>
        <SheetRow title={<span id={`${presetId}-anchor`}>{m.resize_anchor_label()}</span>}>
          <AnchorGrid
            value={anchor}
            disabled={anchorDisabled || original}
            labelledBy={`${presetId}-anchor`}
            names={anchorName}
            data-testid="resize-anchor"
            onChange={setAnchor}
          />
        </SheetRow>
      </SheetGroup>

      <SheetGroup label={m.resize_scope_label()}>
        <RadioGroup<ResizeScope>
          className={parts.choices}
          label={m.resize_scope_label()}
          value={scope}
          onValueChange={setScope}
          options={[
            ...(selection.length > 0
              ? [
                  {
                    value: 'selection' as const,
                    label: m.resize_scope_selection({ count: selection.length }),
                  },
                ]
              : []),
            {
              value: 'document' as const,
              label: m.resize_scope_document({ title: doc.title, count: doc.pages.length }),
            },
            ...(reference === undefined
              ? []
              : [
                  {
                    value: 'same-size' as const,
                    label: m.resize_scope_same_size({
                      size: referenceLabel,
                      count: pagesOfSize(ws, documentId, reference).length,
                    }),
                  },
                ]),
          ]}
        />
      </SheetGroup>

      <SheetGroup>
        <SheetRow full className={parts.previewRow}>
          <Preview ws={ws} pageId={targets[0]} request={sizeValid ? request : undefined} />
          <p
            className={parts.summary}
            role="status"
            data-problem={ready ? undefined : ''}
            data-testid="resize-summary"
          >
            {targets.length === 0
              ? m.resize_nothing()
              : size === undefined
                ? m.resize_preview_original({ pages: pagesPhrase(targets.length) })
                : m.resize_preview({
                    pages: pagesPhrase(targets.length),
                    size: sizeLabel(size, unit),
                  })}
          </p>
        </SheetRow>
      </SheetGroup>
    </Sheet>
  );
}

function modeTitle(mode: ResizeMode): string {
  switch (mode) {
    case 'scale':
      return m.resize_mode_scale();
    case 'fit':
      return m.resize_mode_fit();
    case 'canvas':
      return m.resize_mode_canvas();
  }
}

function modeHint(mode: ResizeMode): string {
  switch (mode) {
    case 'scale':
      return m.resize_mode_scale_hint();
    case 'fit':
      return m.resize_mode_fit_hint();
    case 'canvas':
      return m.resize_mode_canvas_hint();
  }
}

/** The first target page at its new size, content placed as the export will draw it. */
function Preview({
  ws,
  pageId,
  request,
}: {
  readonly ws: Workspace;
  readonly pageId: PageId | undefined;
  readonly request: ResizeRequest | undefined;
}) {
  const page = findPage(ws, pageId);
  if (page === undefined) return <div className={own.previewBox} aria-hidden="true" />;
  let shown: Size;
  let frame: ReturnType<typeof resizeContentPlacement> | undefined;
  let contentShown: Size;
  try {
    const rotation = pageTotalRotation(ws, page);
    const content = pageContentSize(ws, page);
    const quarter = rotation === 90 || rotation === 270;
    contentShown = quarter ? { width: content.height, height: content.width } : content;
    // "Original size" (no request) and a request that changes nothing show the content box.
    const resize = request === undefined ? undefined : resizeForPage(ws, page, request);
    if (resize === undefined) {
      shown = contentShown;
      frame = undefined;
    } else {
      shown = quarter ? { width: resize.height, height: resize.width } : resize;
      frame = resizeContentPlacement(content, resize, rotation);
    }
  } catch {
    shown = pageDisplaySize(ws, page);
    contentShown = shown;
    frame = undefined;
  }
  const sheet = fitInBox(shown, PREVIEW_BOX, PREVIEW_BOX);
  const ref = page.ref;
  return (
    <div className={own.previewBox} aria-label={m.resize_preview_label()} role="img">
      <div
        className={own.previewSheet}
        style={{ width: sheet.width, height: sheet.height }}
        data-testid="resize-preview-sheet"
      >
        <ResizedContent frame={frame}>
          <PageCanvas
            sourceId={ref.kind === 'source' ? ref.source : undefined}
            blobId={ref.kind === 'image' ? ref.blob : undefined}
            index={ref.kind === 'source' ? ref.index : 0}
            rotation={page.rotation}
            widthPt={contentShown.width}
            heightPt={contentShown.height}
            cssWidth={sheet.width * (frame?.width ?? 1)}
            priority={RENDER_PRIORITY.offscreen}
          />
        </ResizedContent>
      </div>
    </div>
  );
}

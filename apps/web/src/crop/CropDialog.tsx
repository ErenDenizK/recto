/**
 * "Crop pages…" (M4 §3; S12 in components/07-sheets.md), a task sheet on the Sheet primitive in
 * the sheet grammar (system-audit-2026-10 §3.6.1), its controls all `ui/` ones (Q-9, Q-14):
 * margins from the displayed page's edges (pt, mm or in), a live
 * preview of the first page it crops with the crop rectangle over it (edges and corners
 * drag; the edge handles are sliders for the keyboard), "Draw crop area" (a rectangle
 * dragged on the page in Read mode, CropLayer.tsx), "Reset crop", the pages to crop
 * (selection, the whole document, or every page of the first page's size) and, honesty
 * first, whether to also remove the content outside the crop through the redaction
 * pipeline. A plain crop commits at once; with the removal the sheet shows the
 * redaction's progress and then its result (redaction/ApplySheet.tsx).
 * The run and its outcome live in crop-store.ts: the sheet cannot close while it works.
 * Before the removal it warns about redaction marks reaching outside the crop (deleted,
 * not applied).
 *
 * On resized pages the margins are measured on the original page (the crop is taken of the
 * source content, which the resize then fits to the new page size again): the summary
 * says so and names both sizes.
 *
 * "Trim to content" is left out: the engine reports text and annotation bounds, but not
 * the bounds of images and vector drawings, so a trim computed from text would cut them.
 */
import {
  type DocumentId,
  type PageId,
  pageTotalRotation,
  type Size,
  type VirtualPage,
  type Workspace,
} from '@pdf-editor/document-model';
import { type KeyboardEvent, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

import { useAnnotationStore } from '../annotations/annotation-store';
import { RENDER_PRIORITY } from '../engine/engine-service';
import { formatNumber, m } from '../i18n';
import { PageCanvas } from '../pages/PageCanvas';
import { fitInBox } from '../pages/page-geometry';
import { Outcome } from '../redaction/ApplySheet';
import parts from '../pages-sheets/PagesSheets.module.css';
import { closeOperationDialog } from '../stage/operation-dialogs-store';
import { fromUnit, type ResizeUnit, sizeLabel, toUnit } from '../stage/ResizeDialog';
import { pagesPhrase, useWorkspaceStore } from '../state/workspace-store';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { NumberField } from '../ui/NumberField';
import { Progress } from '../ui/Progress';
import { RadioGroup } from '../ui/RadioGroup';
import { Select } from '../ui/Select';
import { Sheet, SheetGroup, SheetRow } from '../ui/sheet';
import {
  cropAndDiscard,
  cropPages,
  displayedSizeOf,
  marksOutsideCrop,
  planCrops,
  planDiscard,
  scopePages,
  startCropDrawing,
} from './actions';
import own from './Crop.module.css';
import {
  type CropScope,
  clearResume,
  dismissCropOutcome,
  isCropWorking,
  peekResume,
  useCropStore,
} from './crop-store';
import { pageBoxOf } from './display';
import {
  dragMargins,
  type Handle,
  isNoCrop,
  type Margins,
  marginsFromCrop,
  marginsProblem,
  NO_MARGINS,
  roundMargins,
  SIDES,
  type Side,
  turned,
} from './geometry';

const PREVIEW_BOX = 220;
const HANDLES: readonly Handle[] = ['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw'];
/** Edge handles are sliders (keyboard); corners are for the pointer only. */
const EDGE_SIDE: Readonly<Partial<Record<Handle, Side>>> = {
  n: 'top',
  e: 'right',
  s: 'bottom',
  w: 'left',
};

function findPage(ws: Workspace, id: PageId | undefined): VirtualPage | undefined {
  if (id === undefined) return undefined;
  for (const docId of ws.documentOrder) {
    const page = ws.documents[docId]?.pages.find((p) => p.id === id);
    if (page) return page;
  }
  return undefined;
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

function sideName(side: Side): string {
  switch (side) {
    case 'top':
      return m.crop_margin_top();
    case 'right':
      return m.crop_margin_right();
    case 'bottom':
      return m.crop_margin_bottom();
    case 'left':
      return m.crop_margin_left();
  }
}

/** The page's current crop as displayed margins (none for an uncropped page). */
function currentMargins(ws: Workspace, page: VirtualPage | undefined): Margins {
  const crop = page?.cropBox;
  if (page === undefined || crop === undefined) return NO_MARGINS;
  try {
    return roundMargins(marginsFromCrop(pageBoxOf(page), crop, pageTotalRotation(ws, page)));
  } catch {
    return NO_MARGINS;
  }
}

/** The page box as displayed and its rotation; undefined when the page cannot be read. */
function shownBox(ws: Workspace, page: VirtualPage | undefined): Size | undefined {
  if (page === undefined) return undefined;
  try {
    return turned(pageBoxOf(page), pageTotalRotation(ws, page));
  } catch {
    return undefined;
  }
}

export function CropDialog({
  documentId,
  pageIds,
  open = true,
}: {
  readonly documentId: DocumentId;
  readonly pageIds: readonly PageId[];
  readonly open?: boolean;
}) {
  const ws = useWorkspaceStore((s) => s.workspace);
  const doc = ws.documents[documentId];
  const selection = pageIds.filter((id) => findPage(ws, id) !== undefined);
  const firstId = selection[0] ?? doc?.pages[0]?.id;
  // Opening again after "Draw crop area": the sheet comes back as it was, with the drawing.
  const [resume] = useState(() => peekResume(documentId));
  useEffect(() => clearResume(), []);
  // A new opening starts from the form: an earlier removal's result was seen (OperationDialogs
  // mounts the sheet afresh for each opening).
  useLayoutEffect(() => {
    const before = useCropStore.getState().run;
    if (before.kind === 'done' && before.documentId === documentId) dismissCropOutcome(documentId);
  }, [documentId]);
  const [reference] = useState<Size | undefined>(() => displayedSizeOf(ws, firstId));
  const [margins, setMargins] = useState<Margins>(
    () => resume?.margins ?? currentMargins(ws, findPage(ws, firstId)),
  );
  const [unit, setUnit] = useState<ResizeUnit>(resume?.unit ?? 'mm');
  const [scope, setScope] = useState<CropScope>(
    resume?.scope ?? (selection.length > 0 ? 'selection' : 'document'),
  );
  const [discard, setDiscard] = useState(resume?.discard ?? false);
  const run = useCropStore((s) => s.run);
  const annotationPages = useAnnotationStore((s) => s.pages);
  const ensurePage = useAnnotationStore((s) => s.ensurePage);
  const errorId = useId();
  const unitId = useId();
  const baseId = useId();

  const targets = doc === undefined ? [] : scopePages(ws, documentId, scope, selection, reference);
  // Read the annotations of the pages to crop: marks there are deleted by the removal.
  const targetKey = targets.join(',');
  useEffect(() => {
    const current = useWorkspaceStore.getState().workspace;
    for (const id of targetKey === '' ? [] : targetKey.split(',')) {
      const page = findPage(current, id as PageId);
      if (page?.ref.kind === 'source') ensurePage(page.ref.source, page.ref.index);
    }
  }, [targetKey, ensurePage]);

  if (doc === undefined) return null;

  const previewPage = findPage(ws, targets[0] ?? firstId);
  const previewSize = shownBox(ws, previewPage);
  const problem = previewSize === undefined ? undefined : marginsProblem(margins, previewSize);
  const clear = isNoCrop(margins);
  const plan = planCrops(ws, targets, margins);
  const hasCrop = targets.some((id) => findPage(ws, id)?.cropBox !== undefined);
  const ready = problem === undefined && plan.crops.length > 0 && (!clear || hasCrop);
  const removing = discard && !clear;
  const discardPlan = removing && ready ? planDiscard(ws, plan.crops) : undefined;
  const shared = discardPlan?.shared ?? 0;
  const marksOutside =
    discardPlan === undefined ? 0 : marksOutsideCrop(ws, annotationPages, discardPlan.plans);
  const resized = targets.some((id) => findPage(ws, id)?.resize !== undefined);
  const previewPageSize =
    previewPage?.resize === undefined ? undefined : displayedSizeOf(ws, previewPage.id);
  const croppedSize =
    previewSize === undefined || problem !== undefined
      ? undefined
      : {
          width: previewSize.width - margins.left - margins.right,
          height: previewSize.height - margins.top - margins.bottom,
        };

  const setSide = (side: Side, value: number) =>
    setMargins((current) => ({ ...current, [side]: fromUnit(value, unit) }));

  // A run for this document (the removal): its progress, then its result sheet.
  const mine = run.kind !== 'idle' && run.documentId === documentId ? run : undefined;

  const submit = async () => {
    if (!ready || mine !== undefined) return;
    if (!removing) {
      await cropPages(targets, margins, { discard: false });
      closeOperationDialog();
      return;
    }
    await cropAndDiscard(documentId, targets, margins);
  };

  const draw = () =>
    startCropDrawing({ documentId, pageIds: selection, margins, unit, scope, discard }, targets[0]);

  // Esc, ✕ and the scrim do nothing while a crop removes content (crop-store.ts).
  const close = () => {
    if (!isCropWorking()) closeOperationDialog();
  };

  const frame = {
    id: 'crop',
    kind: 'task' as const,
    open,
    onClose: close,
    title: m.crop_title(),
    testId: 'crop-dialog',
  };

  if (mine?.kind === 'working') {
    return (
      <Sheet
        {...frame}
        busy
        cancel={false}
        primary={{
          label: m.crop_confirm_discard(),
          onPress: () => undefined,
          busy: true,
          busyLabel: m.crop_removing(),
        }}
      >
        <SheetGroup>
          <SheetRow full>
            <p className={parts.summary} role="status">
              {m.crop_removing()}
            </p>
            <Progress value={null} label={m.crop_removing()} />
          </SheetRow>
        </SheetGroup>
      </Sheet>
    );
  }

  if (mine?.kind === 'done') {
    return (
      <Sheet
        {...frame}
        cancel={false}
        secondary={
          mine.outcome.kind === 'applied' ? null : (
            <Button variant="quiet" onClick={() => dismissCropOutcome(documentId)}>
              {m.common_back()}
            </Button>
          )
        }
        primary={{ label: m.common_close(), onPress: closeOperationDialog }}
      >
        <div data-testid="crop-result">
          <Outcome outcome={mine.outcome} />
        </div>
      </Sheet>
    );
  }

  const summary =
    targets.length === 0
      ? m.crop_nothing()
      : problem === 'invalid'
        ? m.crop_error_invalid()
        : problem === 'too-small'
          ? m.crop_error_too_small()
          : clear
            ? hasCrop
              ? m.crop_preview_reset({ pages: pagesPhrase(plan.crops.length) })
              : m.crop_preview_none()
            : previewPageSize !== undefined
              ? m.crop_preview_resized({
                  pages: pagesPhrase(plan.crops.length),
                  size: croppedSize === undefined ? '' : sizeLabel(croppedSize, unit),
                  pageSize: sizeLabel(previewPageSize, unit),
                })
              : m.crop_preview({
                  pages: pagesPhrase(plan.crops.length),
                  size: croppedSize === undefined ? '' : sizeLabel(croppedSize, unit),
                });

  return (
    <Sheet
      {...frame}
      primary={{
        label:
          clear && hasCrop
            ? m.crop_confirm_reset()
            : removing
              ? m.crop_confirm_discard()
              : m.crop_confirm(),
        onPress: () => void submit(),
        disabled: !ready,
      }}
    >
      <SheetGroup footnote={m.crop_notice()}>
        <SheetRow full className={`${parts.previewRow} ${own.previewStack}`}>
          <CropPreview
            ws={ws}
            page={previewPage}
            size={previewSize}
            margins={margins}
            unit={unit}
            onChange={setMargins}
          />
          <div className={own.previewSide}>
            <p
              className={parts.summary}
              role="status"
              data-problem={ready ? undefined : ''}
              data-testid="crop-summary"
            >
              {summary}
            </p>
            {plan.notPdf > 0 ? (
              <p className={parts.note}>{m.crop_skipped_not_pdf({ count: plan.notPdf })}</p>
            ) : null}
            {plan.tooSmall > 0 && problem === undefined ? (
              <p className={parts.note}>{m.crop_skipped_too_small({ count: plan.tooSmall })}</p>
            ) : null}
            <div className={parts.actions}>
              <Button
                size="sm"
                data-testid="crop-draw"
                disabled={targets.length === 0}
                onClick={draw}
              >
                {m.crop_draw()}
              </Button>
              <Button
                size="sm"
                variant="quiet"
                data-testid="crop-reset"
                disabled={clear}
                onClick={() => setMargins(NO_MARGINS)}
              >
                {m.crop_reset()}
              </Button>
            </div>
          </div>
        </SheetRow>
      </SheetGroup>

      <SheetGroup
        label={m.crop_margins_label()}
        footnote={
          problem === undefined ? (
            resized ? (
              <span data-testid="crop-resized-notice">{m.crop_resized_notice()}</span>
            ) : undefined
          ) : (
            <span id={errorId} className={parts.error}>
              {problem === 'invalid' ? m.crop_error_invalid() : m.crop_error_too_small()}
            </span>
          )
        }
      >
        {SIDES.map((side) => {
          const id = `${baseId}-${side}`;
          return (
            <SheetRow key={side} title={sideName(side)} labelFor={id}>
              <NumberField
                id={id}
                className={parts.number}
                label={sideName(side)}
                value={toUnit(margins[side], unit)}
                min={0}
                step={unit === 'in' ? 0.1 : 1}
                format={{ maximumFractionDigits: unit === 'mm' ? 1 : 2, useGrouping: false }}
                aria-describedby={problem === undefined ? undefined : errorId}
                data-testid={`crop-${side}`}
                onValueChange={(next) => {
                  if (next !== null && Number.isFinite(next)) setSide(side, next);
                }}
              />
            </SheetRow>
          );
        })}
        <SheetRow title={m.resize_unit_label()} labelFor={unitId}>
          <Select
            id={unitId}
            label={m.resize_unit_label()}
            value={unit}
            data-testid="crop-unit"
            onValueChange={setUnit}
            options={(['mm', 'in', 'pt'] as const).map((u) => ({
              value: u,
              label: unitName(u),
            }))}
          />
        </SheetRow>
      </SheetGroup>

      <SheetGroup label={m.resize_scope_label()}>
        <RadioGroup<CropScope>
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
                      size: sizeLabel(reference, unit),
                      count: scopePages(ws, documentId, 'same-size', selection, reference).length,
                    }),
                  },
                ]),
          ]}
        />
      </SheetGroup>

      <SheetGroup>
        <SheetRow full>
          <Checkbox
            label={m.crop_discard()}
            description={m.crop_discard_hint()}
            checked={discard}
            onCheckedChange={setDiscard}
          />
        </SheetRow>
        {removing ? (
          <SheetRow full>
            <p className={parts.note} data-tone="warning" role="note">
              {m.crop_discard_warning()}
            </p>
          </SheetRow>
        ) : null}
        {shared > 0 ? (
          <SheetRow full>
            <p className={parts.note}>{m.crop_discard_shared({ count: shared })}</p>
          </SheetRow>
        ) : null}
        {marksOutside > 0 ? (
          <SheetRow full>
            <p
              className={parts.note}
              data-tone="warning"
              role="note"
              data-testid="crop-discard-marks"
            >
              {m.crop_discard_marks({ count: marksOutside })}
            </p>
          </SheetRow>
        ) : null}
      </SheetGroup>
    </Sheet>
  );
}

interface PreviewDrag {
  readonly handle: Handle;
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
  readonly start: Margins;
}

/**
 * The first page to crop, whole (its page box, as displayed), with the crop rectangle over
 * it: the scrim shows what the crop hides. Everything here is in display space; the model
 * conversion happens per page when the crop is applied (geometry.ts).
 */
function CropPreview({
  ws,
  page,
  size,
  margins,
  unit,
  onChange,
}: {
  readonly ws: Workspace;
  readonly page: VirtualPage | undefined;
  readonly size: Size | undefined;
  readonly margins: Margins;
  readonly unit: ResizeUnit;
  readonly onChange: (margins: Margins) => void;
}) {
  const drag = useRef<PreviewDrag | null>(null);
  if (page === undefined || size === undefined) {
    return <div className={own.previewBox} aria-hidden="true" />;
  }
  const sheet = fitInBox(size, PREVIEW_BOX, PREVIEW_BOX);
  const scale = sheet.width / size.width;
  const valid = marginsProblem(margins, size) === undefined;
  const shown = valid ? margins : NO_MARGINS;
  const rect = {
    left: shown.left * scale,
    top: shown.top * scale,
    width: (size.width - shown.left - shown.right) * scale,
    height: (size.height - shown.top - shown.bottom) * scale,
  };
  const ref = page.ref;
  let rotation: number;
  try {
    rotation = pageTotalRotation(ws, page);
  } catch {
    rotation = 0;
  }

  const nudge = (handle: Handle) => (event: KeyboardEvent<HTMLElement>) => {
    const step = fromUnit(1, unit) * (event.shiftKey ? 10 : 1);
    const vertical = handle === 'n' || handle === 's';
    let d: number;
    switch (event.key) {
      case 'ArrowUp':
        d = vertical ? -step : 0;
        break;
      case 'ArrowDown':
        d = vertical ? step : 0;
        break;
      case 'ArrowLeft':
        d = vertical ? 0 : -step;
        break;
      case 'ArrowRight':
        d = vertical ? 0 : step;
        break;
      default:
        return;
    }
    event.preventDefault();
    if (d === 0 || !valid) return;
    const next = vertical
      ? dragMargins(margins, handle, 0, d, size)
      : dragMargins(margins, handle, d, 0, size);
    onChange(roundMargins(next));
  };

  const handleAt = (handle: Handle) => ({
    left:
      rect.left + (handle.includes('w') ? 0 : handle.includes('e') ? rect.width : rect.width / 2),
    top:
      rect.top + (handle.includes('n') ? 0 : handle.includes('s') ? rect.height : rect.height / 2),
  });

  return (
    <div className={own.previewBox} data-testid="crop-preview">
      <div
        className={own.previewSheet}
        style={{ width: sheet.width, height: sheet.height }}
        data-testid="crop-preview-sheet"
        // One set of pointer handlers for the rectangle and its handles (`data-handle`).
        onPointerDown={(event) => {
          const target = event.target as HTMLElement;
          const handle = target.dataset.handle as Handle | undefined;
          if (handle === undefined || event.button !== 0 || !valid) return;
          event.preventDefault();
          event.stopPropagation();
          target.setPointerCapture(event.pointerId);
          drag.current = {
            handle,
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            start: margins,
          };
        }}
        onPointerMove={(event) => {
          const current = drag.current;
          if (current?.pointerId !== event.pointerId) return;
          const dx = (event.clientX - current.x) / scale;
          const dy = (event.clientY - current.y) / scale;
          onChange(roundMargins(dragMargins(current.start, current.handle, dx, dy, size)));
        }}
        onPointerUp={(event) => {
          if (drag.current?.pointerId === event.pointerId) drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <PageCanvas
          sourceId={ref.kind === 'source' ? ref.source : undefined}
          blobId={ref.kind === 'image' ? ref.blob : undefined}
          index={ref.kind === 'source' ? ref.index : 0}
          rotation={page.rotation}
          widthPt={size.width}
          heightPt={size.height}
          cssWidth={sheet.width}
          priority={RENDER_PRIORITY.offscreen}
        />
        <div className={own.shade} style={{ left: 0, top: 0, right: 0, height: rect.top }} />
        <div
          className={own.shade}
          style={{ left: 0, right: 0, top: rect.top + rect.height, bottom: 0 }}
        />
        <div
          className={own.shade}
          style={{ left: 0, top: rect.top, width: rect.left, height: rect.height }}
        />
        <div
          className={own.shade}
          style={{
            left: rect.left + rect.width,
            right: 0,
            top: rect.top,
            height: rect.height,
          }}
        />
        <div
          className={own.cropRect}
          data-testid="crop-rect"
          data-handle="move"
          data-rotation={rotation}
          style={rect}
          aria-hidden="true"
        />
        {HANDLES.map((handle) => {
          const side = EDGE_SIDE[handle];
          const at = handleAt(handle);
          if (side === undefined) {
            return (
              <span
                key={handle}
                className={own.handle}
                data-handle={handle}
                style={at}
                aria-hidden="true"
              />
            );
          }
          const max = side === 'top' || side === 'bottom' ? size.height : size.width;
          return (
            <span
              key={handle}
              role="slider"
              tabIndex={0}
              className={own.handle}
              data-handle={handle}
              style={at}
              aria-label={m.crop_edge_label({ side: sideName(side) })}
              aria-orientation={side === 'top' || side === 'bottom' ? 'vertical' : 'horizontal'}
              aria-valuemin={0}
              aria-valuemax={toUnit(max, unit)}
              aria-valuenow={toUnit(margins[side], unit)}
              aria-valuetext={`${formatNumber(toUnit(margins[side], unit))} ${unitName(unit)}`}
              onKeyDown={nudge(handle)}
            />
          );
        })}
      </div>
    </div>
  );
}

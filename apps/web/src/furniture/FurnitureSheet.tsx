/**
 * S11 Page furniture (document-tools spec §2; components/07-sheets.md S11): Page numbers,
 * Header and footer, Bates numbering and Watermark, each a tool sheet on the Sheet primitive
 * in the sheet grammar (system-audit-2026-10 §3.6.1). A tool sheet has no scrim and keeps the
 * pages live beside it, so they show the preview (furniture-store.ts) while settings change;
 * Apply commits one history entry; Cancel, ✕ and Esc drop the preview; Remove deletes that kind
 * of furniture (one history entry).
 *
 * - Groups with sentence-case labels; each setting is a row: its name leading and its control
 *   trailing (`ui/NumberField`, `ui/Select`, `ui/ColourPicker`), or a full row (`ui/Checkbox`,
 *   `ui/Slider`, the slot fields). Number fields take the coarse size on touch, their − and +
 *   beside the well, never over the value.
 * - Presets are `ui/Segmented` (page-number formats, watermark kind, rotation, layer); the
 *   anchor is a 3 × 3 radio group laid out as the page.
 * - The footer (Remove · Cancel · Apply) is the sheet's, inside its room on every size.
 */
import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import type {
  Anchor,
  BatesConfig,
  BlobId,
  DocumentId,
  OverlayOp,
  TextOverlay,
} from '@pdf-editor/document-model';
import { formatBates } from '@pdf-editor/engine/overlay-geometry';
import { type ReactNode, useEffect, useState } from 'react';

import { decodeImageFile } from '../files/images';
import { pickFiles } from '../files/open-files';
import { formatNumber, formatPercent, m } from '../i18n';
import { announce } from '../shell/announcer';
import { readJson, writeJson } from '../state/safe-storage';
import { pagesPhrase, useTabItems, useWorkspaceStore } from '../state/workspace-store';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { ColourPicker } from '../ui/colour/ColourPicker';
import { NumberField as NumberInput } from '../ui/NumberField';
import { Segmented } from '../ui/Segmented';
import { Select } from '../ui/Select';
import { Sheet, SheetGroup, SheetRow } from '../ui/sheet';
import { Slider } from '../ui/Slider';
import { TextField } from '../ui/TextField';
import { useRetained } from '../ui/use-retained';
import {
  applyBatesRun,
  applyFurniture,
  batesOverlay,
  type BatesSettings,
  clampRotation,
  defaultHeaderFooter,
  defaultPageNumbers,
  defaultWatermark,
  FONT_FAMILIES,
  type FurnitureKind,
  firstPosition,
  furnitureOf,
  type HeaderFooterSettings,
  headerFooterOverlays,
  type PageNumberPreset,
  type PageNumberSettings,
  pageNumberOverlay,
  planBatesRun,
  presetOf,
  presetTemplate,
  type RangeChoice,
  type RangeMode,
  readBates,
  readHeaderFooter,
  readPageNumbers,
  readWatermark,
  removeFurniture,
  SLOTS,
  type TextStyle,
  type WatermarkSettings,
  watermarkOverlay,
} from './furniture-model';
import { closeFurnitureDialog, setFurniturePreview, useFurnitureStore } from './furniture-store';
import styles from './FurnitureSheet.module.css';
import { dropPreviewBlob, isPreviewBlob, putPreviewBlob, takePreviewBlob } from './preview-blobs';

export const FURNITURE_SHEET = 'furniture';

/** Mounted once in the shell: the sheet of the furniture the store names. */
export function FurnitureSheet() {
  const dialog = useFurnitureStore((s) => s.dialog);
  // The form stays shown while the sheet plays its exit.
  const [shown] = useRetained(dialog);
  if (shown === null) return null;
  return (
    <Content
      key={shown.nonce}
      kind={shown.kind}
      documentId={shown.documentId}
      open={dialog !== null && dialog.nonce === shown.nonce}
    />
  );
}

function Content({
  kind,
  documentId,
  open,
}: {
  readonly kind: FurnitureKind;
  readonly documentId: DocumentId;
  readonly open: boolean;
}) {
  switch (kind) {
    case 'page-numbers':
      return <PageNumbersDialog documentId={documentId} open={open} />;
    case 'header-footer':
      return <HeaderFooterDialog documentId={documentId} open={open} />;
    case 'bates':
      return <BatesDialog documentId={documentId} open={open} />;
    case 'watermark':
      return <WatermarkDialog documentId={documentId} open={open} />;
  }
}

export function furnitureName(kind: FurnitureKind): string {
  switch (kind) {
    case 'page-numbers':
      return m.furniture_title_page_numbers();
    case 'header-footer':
      return m.furniture_title_header_footer();
    case 'bates':
      return m.furniture_title_bates();
    case 'watermark':
      return m.furniture_title_watermark();
  }
}

export function removeLabel(kind: FurnitureKind): string {
  switch (kind) {
    case 'page-numbers':
      return m.cmd_remove_page_numbers();
    case 'header-footer':
      return m.cmd_remove_header_footer();
    case 'bates':
      return m.cmd_remove_bates();
    case 'watermark':
      return m.cmd_remove_watermark();
  }
}

/** Removes one kind of furniture from a document as one history entry. */
export function removeFurnitureFrom(documentId: DocumentId, kind: FurnitureKind): boolean {
  const done = useWorkspaceStore
    .getState()
    .applyOperation((ws) => removeFurniture(ws, documentId, kind), removeLabel(kind));
  if (done) announce(m.announce_furniture_removed({ name: furnitureName(kind) }));
  return done;
}

// ---------------------------------------------------------------------------
// Frame and shared controls
// ---------------------------------------------------------------------------

function Frame({
  kind,
  documentId,
  open,
  existing,
  canApply,
  onApply,
  children,
}: {
  readonly kind: FurnitureKind;
  readonly documentId: DocumentId;
  readonly open: boolean;
  readonly existing: boolean;
  readonly canApply: boolean;
  readonly onApply: () => void;
  readonly children: ReactNode;
}) {
  return (
    <Sheet
      id={FURNITURE_SHEET}
      kind="tool"
      open={open}
      onClose={() => closeFurnitureDialog()}
      title={furnitureName(kind)}
      primary={{ label: m.furniture_apply(), onPress: onApply, disabled: !canApply }}
      secondary={
        existing ? (
          <Button
            variant="danger"
            onClick={() => {
              if (removeFurnitureFrom(documentId, kind)) closeFurnitureDialog();
            }}
          >
            {m.furniture_remove()}
          </Button>
        ) : undefined
      }
      testId={`furniture-dialog-${kind}`}
    >
      <p className={styles.intro}>{m.furniture_preview_note()}</p>
      {children}
    </Sheet>
  );
}

/** A setting's number: a trailing `ui/NumberField`, named by its row. */
function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  testId,
}: {
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly unit?: string;
  readonly testId?: string;
}) {
  return (
    <NumberInput
      className={styles.number}
      label={label}
      value={Number.isFinite(value) ? value : null}
      unit={unit}
      step={step}
      data-testid={testId}
      onValueChange={(next) => {
        if (next !== null && Number.isFinite(next)) onChange(next);
      }}
      {...(min === undefined ? {} : { min })}
      {...(max === undefined ? {} : { max })}
    />
  );
}

/** A row whose trailing control is a number field. */
function NumberRow(props: Parameters<typeof NumberField>[0]) {
  return (
    <SheetRow title={props.label}>
      <NumberField {...props} />
    </SheetRow>
  );
}

const ANCHORS: readonly Anchor[] = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'center',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

export function anchorName(anchor: Anchor): string {
  switch (anchor) {
    case 'top-left':
      return m.furniture_anchor_top_left();
    case 'top-center':
      return m.furniture_anchor_top_center();
    case 'top-right':
      return m.furniture_anchor_top_right();
    case 'middle-left':
      return m.furniture_anchor_middle_left();
    case 'center':
      return m.furniture_anchor_center();
    case 'middle-right':
      return m.furniture_anchor_middle_right();
    case 'bottom-left':
      return m.furniture_anchor_bottom_left();
    case 'bottom-center':
      return m.furniture_anchor_bottom_center();
    case 'bottom-right':
      return m.furniture_anchor_bottom_right();
  }
}

/** Nine anchors laid out as the page: one radio group, the arrows move across it. */
function AnchorPicker({
  value,
  onChange,
}: {
  readonly value: Anchor;
  readonly onChange: (anchor: Anchor) => void;
}) {
  return (
    <RadioGroup
      aria-label={m.furniture_anchor_label()}
      value={value}
      onValueChange={(next) => onChange(next)}
      className={styles.anchors}
    >
      {ANCHORS.map((anchor) => (
        <Radio.Root
          key={anchor}
          value={anchor}
          aria-label={anchorName(anchor)}
          title={anchorName(anchor)}
          className={styles.anchor}
        />
      ))}
    </RadioGroup>
  );
}

function PositionSection({
  anchor,
  onAnchor,
  marginX,
  marginY,
  onMargins,
  mirror,
  onMirror,
}: {
  readonly anchor?: Anchor;
  readonly onAnchor?: (anchor: Anchor) => void;
  readonly marginX: number;
  readonly marginY: number;
  readonly onMargins: (x: number, y: number) => void;
  readonly mirror?: boolean;
  readonly onMirror?: (mirror: boolean) => void;
}) {
  return (
    <SheetGroup label={m.furniture_position()}>
      {anchor !== undefined && onAnchor ? (
        <SheetRow title={m.furniture_anchor_label()}>
          <AnchorPicker value={anchor} onChange={onAnchor} />
        </SheetRow>
      ) : null}
      <NumberRow
        label={m.furniture_margin_x()}
        value={marginX}
        min={0}
        max={500}
        unit={m.furniture_unit_pt()}
        onChange={(x) => onMargins(Math.max(0, x), marginY)}
      />
      <NumberRow
        label={m.furniture_margin_y()}
        value={marginY}
        min={0}
        max={500}
        unit={m.furniture_unit_pt()}
        onChange={(y) => onMargins(marginX, Math.max(0, y))}
      />
      {onMirror ? (
        <SheetRow full>
          <Checkbox
            label={m.furniture_mirror()}
            checked={mirror === true}
            onCheckedChange={onMirror}
          />
        </SheetRow>
      ) : null}
    </SheetGroup>
  );
}

function Percent({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
}: {
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly min?: number;
  readonly max?: number;
}) {
  return (
    <Slider
      label={label}
      showLabel
      readout
      min={min}
      max={max}
      value={Math.round(value * 100)}
      format={(percent) => formatPercent(percent / 100)}
      onValueChange={(percent) => onChange(percent / 100)}
    />
  );
}

function StyleSection({
  style,
  onChange,
  showOpacity = true,
}: {
  readonly style: TextStyle;
  readonly onChange: (style: TextStyle) => void;
  readonly showOpacity?: boolean;
}) {
  return (
    <SheetGroup label={m.furniture_text()}>
      <SheetRow title={m.furniture_font()}>
        <Select
          label={m.furniture_font()}
          value={style.family}
          onValueChange={(family) => onChange({ ...style, family })}
          options={FONT_FAMILIES.map((family) => ({ value: family, label: family }))}
        />
      </SheetRow>
      <NumberRow
        label={m.furniture_size()}
        value={style.size}
        min={4}
        max={400}
        unit={m.furniture_unit_pt()}
        onChange={(size) => onChange({ ...style, size: Math.min(400, Math.max(4, size)) })}
      />
      <SheetRow full>
        <Checkbox
          label={m.furniture_bold()}
          checked={style.bold}
          onCheckedChange={(bold) => onChange({ ...style, bold })}
        />
      </SheetRow>
      <SheetRow full>
        <Checkbox
          label={m.furniture_italic()}
          checked={style.italic}
          onCheckedChange={(italic) => onChange({ ...style, italic })}
        />
      </SheetRow>
      <SheetRow title={m.furniture_color()}>
        <ColourPicker
          value={style.color.toUpperCase()}
          label={m.furniture_color()}
          onChange={(color) => onChange({ ...style, color })}
          side="left"
        />
      </SheetRow>
      {showOpacity ? (
        <SheetRow full>
          <Percent
            label={m.furniture_opacity()}
            value={style.opacity}
            min={5}
            onChange={(opacity) => onChange({ ...style, opacity })}
          />
        </SheetRow>
      ) : null}
    </SheetGroup>
  );
}

function RangeSection({
  range,
  pageCount,
  onChange,
  children,
}: {
  readonly range: RangeChoice;
  readonly pageCount: number;
  readonly onChange: (range: RangeChoice) => void;
  readonly children?: ReactNode;
}) {
  const modes: readonly [RangeMode, () => string][] = [
    ['all', m.furniture_range_all],
    ['skip-first', m.furniture_range_skip_first],
    ['odd', m.furniture_range_odd],
    ['even', m.furniture_range_even],
    ['custom', m.furniture_range_custom],
  ];
  return (
    <SheetGroup label={m.furniture_pages()}>
      <SheetRow title={m.furniture_pages()}>
        <Select
          label={m.furniture_pages()}
          value={range.mode}
          data-testid="furniture-range"
          onValueChange={(mode) => onChange({ ...range, mode })}
          options={modes.map(([mode, label]) => ({ value: mode, label: label() }))}
        />
      </SheetRow>
      {range.mode === 'custom' ? (
        <>
          <NumberRow
            label={m.furniture_range_from()}
            value={range.from}
            min={1}
            max={pageCount}
            onChange={(from) => onChange({ ...range, from: Math.max(1, Math.round(from)) })}
          />
          <NumberRow
            label={m.furniture_range_end()}
            value={range.to}
            min={1}
            max={pageCount}
            onChange={(to) => onChange({ ...range, to: Math.max(1, Math.round(to)) })}
          />
        </>
      ) : null}
      {children}
    </SheetGroup>
  );
}

const TOKENS = '{page} {pages} {label} {title} {date} {date:short} {date:long} {date:iso} {bates}';

function TokenHint() {
  return (
    <span className={styles.tokens}>
      {m.furniture_tokens()}: {TOKENS}
    </span>
  );
}

/** Keeps the dialog's preview in the furniture store in step with its settings. */
function usePreview(
  kind: FurnitureKind,
  documents: readonly DocumentId[],
  overlays: readonly OverlayOp[],
  bates?: Readonly<Record<DocumentId, BatesConfig>>,
): void {
  const key = JSON.stringify([kind, documents, overlays, bates]);
  useEffect(() => {
    setFurniturePreview({ kind, documents, overlays, ...(bates ? { bates } : {}) });
    // The key captures every input; the preview object is rebuilt from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

function commit(kind: FurnitureKind, apply: () => boolean): void {
  if (apply()) {
    announce(m.announce_furniture_applied({ name: furnitureName(kind) }));
    closeFurnitureDialog();
  }
}

function useDocument(documentId: DocumentId) {
  return useWorkspaceStore((s) => s.workspace.documents[documentId]);
}

// ---------------------------------------------------------------------------
// Page numbers
// ---------------------------------------------------------------------------

function PageNumbersDialog({
  documentId,
  open,
}: {
  readonly documentId: DocumentId;
  readonly open: boolean;
}) {
  const doc = useDocument(documentId);
  const pageCount = doc?.pages.length ?? 1;
  const pageOf = m.furniture_preset_page_of({ page: '{page}', pages: '{pages}' });
  const [initial] = useState(() => {
    const existing = doc ? furnitureOf(doc, 'page-numbers')[0] : undefined;
    return existing?.kind === 'text'
      ? readPageNumbers(existing, pageCount)
      : defaultPageNumbers(pageCount);
  });
  const [existing] = useState(() => (doc ? furnitureOf(doc, 'page-numbers').length > 0 : false));
  const [settings, setSettings] = useState<PageNumberSettings>(initial);
  const [preset, setPreset] = useState<PageNumberPreset>(() => presetOf(initial.template, pageOf));
  const [startEdited, setStartEdited] = useState(existing);
  const overlays = settings.template.trim() === '' ? [] : [pageNumberOverlay(settings)];
  usePreview('page-numbers', [documentId], overlays);
  if (!doc) return null;

  const update = (patch: Partial<PageNumberSettings>) => setSettings((s) => ({ ...s, ...patch }));
  const presets: readonly [PageNumberPreset, string][] = [
    ['plain', '1'],
    ['page-of', pageOf.replace('{page}', '1').replace('{pages}', formatNumber(pageCount))],
    ['slash', `1 / ${formatNumber(pageCount)}`],
    ['dashes', '- 1 -'],
    ['custom', m.furniture_preset_custom()],
  ];

  return (
    <Frame
      kind="page-numbers"
      documentId={documentId}
      open={open}
      existing={existing}
      canApply={overlays.length > 0}
      onApply={() =>
        commit('page-numbers', () =>
          useWorkspaceStore
            .getState()
            .applyOperation(
              (ws) => applyFurniture(ws, documentId, 'page-numbers', overlays),
              m.furniture_title_page_numbers(),
            ),
        )
      }
    >
      <SheetGroup
        label={m.furniture_format()}
        footnote={preset === 'custom' ? <TokenHint /> : undefined}
      >
        <SheetRow full>
          <Segmented<PageNumberPreset>
            label={m.furniture_format()}
            value={preset}
            onValueChange={(id) => {
              setPreset(id);
              if (id !== 'custom') update({ template: presetTemplate(id, pageOf) });
            }}
            options={presets.map(([id, label]) => ({ value: id, label }))}
          />
        </SheetRow>
        {preset === 'custom' ? (
          <SheetRow full>
            <TextField
              label={m.furniture_template_label()}
              value={settings.template}
              spellCheck={false}
              data-testid="page-number-template"
              onValueChange={(template) => update({ template })}
            />
          </SheetRow>
        ) : null}
      </SheetGroup>
      <PositionSection
        anchor={settings.anchor}
        onAnchor={(anchor) => update({ anchor })}
        marginX={settings.marginX}
        marginY={settings.marginY}
        onMargins={(marginX, marginY) => update({ marginX, marginY })}
        mirror={settings.mirror}
        onMirror={(mirror) => update({ mirror })}
      />
      <StyleSection style={settings.style} onChange={(style) => update({ style })} />
      <RangeSection
        range={settings.range}
        pageCount={pageCount}
        onChange={(range) =>
          update(startEdited ? { range } : { range, startNumber: firstPosition(range) })
        }
      >
        <NumberRow
          label={m.furniture_start_number()}
          value={settings.startNumber}
          min={0}
          testId="page-number-start"
          onChange={(startNumber) => {
            setStartEdited(true);
            update({ startNumber: Math.max(0, Math.round(startNumber)) });
          }}
        />
      </RangeSection>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// Header and footer
// ---------------------------------------------------------------------------

function HeaderFooterDialog({
  documentId,
  open,
}: {
  readonly documentId: DocumentId;
  readonly open: boolean;
}) {
  const doc = useDocument(documentId);
  const pageCount = doc?.pages.length ?? 1;
  const [initial] = useState(() => {
    const found = doc ? furnitureOf(doc, 'header-footer') : [];
    const texts = found.filter((o): o is TextOverlay => o.kind === 'text');
    return texts.length > 0 ? readHeaderFooter(texts, pageCount) : defaultHeaderFooter(pageCount);
  });
  const [existing] = useState(() => (doc ? furnitureOf(doc, 'header-footer').length > 0 : false));
  const [settings, setSettings] = useState<HeaderFooterSettings>(initial);
  const overlays = headerFooterOverlays(settings);
  usePreview('header-footer', [documentId], overlays);
  if (!doc) return null;
  const update = (patch: Partial<HeaderFooterSettings>) => setSettings((s) => ({ ...s, ...patch }));
  const slotName = [m.furniture_slot_left, m.furniture_slot_center, m.furniture_slot_right];

  return (
    <Frame
      kind="header-footer"
      documentId={documentId}
      open={open}
      existing={existing}
      canApply={overlays.length > 0}
      onApply={() =>
        commit('header-footer', () =>
          useWorkspaceStore
            .getState()
            .applyOperation(
              (ws) => applyFurniture(ws, documentId, 'header-footer', overlays),
              m.furniture_title_header_footer(),
            ),
        )
      }
    >
      {(['top', 'bottom'] as const).map((edge) => {
        const edgeName = edge === 'top' ? m.furniture_header() : m.furniture_footer();
        return (
          <SheetGroup
            key={edge}
            label={edgeName}
            footnote={edge === 'bottom' ? <TokenHint /> : undefined}
          >
            {SLOTS.filter((slot) => slot.startsWith(edge)).map((slot, i) => (
              <SheetRow key={slot} full>
                <TextField
                  label={m.furniture_slot_label({
                    edge: edgeName,
                    slot: (slotName[i] as () => string)(),
                  })}
                  hideLabel
                  placeholder={(slotName[i] as () => string)()}
                  spellCheck={false}
                  value={settings.slots[slot]}
                  data-testid={`slot-${slot}`}
                  onValueChange={(text) => update({ slots: { ...settings.slots, [slot]: text } })}
                />
              </SheetRow>
            ))}
          </SheetGroup>
        );
      })}
      <PositionSection
        marginX={settings.marginX}
        marginY={settings.marginY}
        onMargins={(marginX, marginY) => update({ marginX, marginY })}
        mirror={settings.mirror}
        onMirror={(mirror) => update({ mirror })}
      />
      <StyleSection style={settings.style} onChange={(style) => update({ style })} />
      <RangeSection
        range={settings.range}
        pageCount={pageCount}
        onChange={(range) => update({ range })}
      />
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// Bates
// ---------------------------------------------------------------------------

const BATES_MEMORY_KEY = 'pdf-editor:bates-last-number';

/** Last Bates number used per prefix (localStorage; see safe-storage.ts). */
export function lastBatesNumber(prefix: string): number | undefined {
  const stored = readJson(BATES_MEMORY_KEY);
  if (typeof stored !== 'object' || stored === null) return undefined;
  const value = (stored as Record<string, unknown>)[prefix];
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined;
}

export function rememberBatesNumber(prefix: string, last: number): void {
  const stored = readJson(BATES_MEMORY_KEY);
  const record =
    typeof stored === 'object' && stored !== null ? (stored as Record<string, unknown>) : {};
  writeJson(BATES_MEMORY_KEY, { ...record, [prefix]: last });
}

function BatesDialog({
  documentId,
  open,
}: {
  readonly documentId: DocumentId;
  readonly open: boolean;
}) {
  const tabs = useTabItems();
  const workspace = useWorkspaceStore((s) => s.workspace);
  const doc = workspace.documents[documentId];
  const [existing] = useState(() => (doc ? furnitureOf(doc, 'bates').length > 0 : false));
  const [initial] = useState<BatesSettings>(() => {
    const found = doc ? furnitureOf(doc, 'bates')[0] : undefined;
    const settings = readBates(found?.kind === 'text' ? found : undefined, doc?.bates);
    if (doc?.bates) return settings;
    const last = lastBatesNumber(settings.prefix);
    return last === undefined ? settings : { ...settings, start: last + 1 };
  });
  const [settings, setSettings] = useState(initial);
  const [startEdited, setStartEdited] = useState(existing);
  // Editing a run starts with its members that are still open; the run id is kept.
  const [selected, setSelected] = useState<readonly DocumentId[]>(() => {
    const members = doc?.bates?.run?.documents.filter((id) => tabs.some((t) => t.id === id));
    return members?.includes(documentId) ? members : [documentId];
  });
  const [runId] = useState(() => doc?.bates?.run?.id ?? crypto.randomUUID());
  const update = (patch: Partial<BatesSettings>) => setSettings((s) => ({ ...s, ...patch }));

  const documents = tabs
    .filter((t) => selected.includes(t.id))
    .map((t) => workspace.documents[t.id])
    .filter((d) => d !== undefined);
  const run = planBatesRun(documents, settings, runId);
  const overlay = batesOverlay(settings);
  const bates = Object.fromEntries(run.map((entry) => [entry.documentId, entry.effective]));
  usePreview('bates', selected, [overlay], bates);
  if (!doc) return null;
  const first = run[0];
  const last = run[run.length - 1];
  const remembered = lastBatesNumber(settings.prefix);

  return (
    <Frame
      kind="bates"
      documentId={documentId}
      open={open}
      existing={existing}
      canApply={run.length > 0 && run.some((entry) => entry.last >= entry.first)}
      onApply={() =>
        commit('bates', () => {
          const done = useWorkspaceStore
            .getState()
            .applyOperation((ws) => applyBatesRun(ws, run, overlay), m.furniture_title_bates());
          if (done && last) rememberBatesNumber(settings.prefix, last.last);
          return done;
        })
      }
    >
      <SheetGroup
        label={m.furniture_format()}
        footnote={
          remembered !== undefined
            ? m.furniture_bates_remembered({ number: formatNumber(remembered) })
            : undefined
        }
      >
        <SheetRow title={m.furniture_bates_prefix()}>
          <TextField
            label={m.furniture_bates_prefix()}
            hideLabel
            className={styles.short}
            value={settings.prefix}
            spellCheck={false}
            data-testid="bates-prefix"
            onValueChange={(prefix) => {
              const known = lastBatesNumber(prefix);
              update(
                !startEdited && known !== undefined ? { prefix, start: known + 1 } : { prefix },
              );
            }}
          />
        </SheetRow>
        <SheetRow title={m.furniture_bates_suffix()}>
          <TextField
            label={m.furniture_bates_suffix()}
            hideLabel
            className={styles.short}
            value={settings.suffix}
            spellCheck={false}
            onValueChange={(suffix) => update({ suffix })}
          />
        </SheetRow>
        <NumberRow
          label={m.furniture_bates_width()}
          value={settings.width}
          min={1}
          max={12}
          onChange={(width) => update({ width: Math.min(12, Math.max(1, Math.round(width))) })}
        />
        <NumberRow
          label={m.furniture_start_number()}
          value={settings.start}
          min={0}
          testId="bates-start"
          onChange={(start) => {
            setStartEdited(true);
            update({ start: Math.max(0, Math.round(start)) });
          }}
        />
        {first && last && last.last >= first.first ? (
          <SheetRow
            title={m.furniture_bates_sample_label()}
            value={
              <span className={styles.sample} role="status" data-testid="bates-sample">
                {m.furniture_bates_sample({
                  first: formatBates(first.effective, 0),
                  last: formatBates(last.effective, last.last - last.first),
                })}
              </span>
            }
          />
        ) : null}
      </SheetGroup>
      <SheetGroup label={m.furniture_bates_documents()}>
        {tabs.map((tab) => (
          <SheetRow key={tab.id} full>
            <Checkbox
              label={
                <span className={styles.doc}>
                  <span className={styles.tag} data-tag={tab.colorIndex} aria-hidden="true" />
                  <span className={styles.docTitle}>{tab.title}</span>
                  <span className={styles.docMeta}>{pagesPhrase(tab.pageCount)}</span>
                </span>
              }
              checked={selected.includes(tab.id)}
              onCheckedChange={(on) =>
                setSelected((current) =>
                  on
                    ? tabs.map((t) => t.id).filter((id) => id === tab.id || current.includes(id))
                    : current.filter((id) => id !== tab.id),
                )
              }
            />
          </SheetRow>
        ))}
      </SheetGroup>
      <PositionSection
        anchor={settings.anchor}
        onAnchor={(anchor) => update({ anchor })}
        marginX={settings.marginX}
        marginY={settings.marginY}
        onMargins={(marginX, marginY) => update({ marginX, marginY })}
      />
      <StyleSection style={settings.style} onChange={(style) => update({ style })} />
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// Watermark
// ---------------------------------------------------------------------------

function WatermarkDialog({
  documentId,
  open,
}: {
  readonly documentId: DocumentId;
  readonly open: boolean;
}) {
  const doc = useDocument(documentId);
  const pageCount = doc?.pages.length ?? 1;
  const [initial] = useState<WatermarkSettings>(() => {
    const found = doc ? furnitureOf(doc, 'watermark')[0] : undefined;
    return found ? readWatermark(found, pageCount) : defaultWatermark(pageCount);
  });
  const [existing] = useState(() => (doc ? furnitureOf(doc, 'watermark').length > 0 : false));
  const [settings, setSettings] = useState(initial);
  const [imageError, setImageError] = useState(false);
  const update = (patch: Partial<WatermarkSettings>) => setSettings((s) => ({ ...s, ...patch }));
  const built = watermarkOverlay(settings);
  usePreview('watermark', [documentId], built ? [built] : []);
  const previewBlob =
    settings.blob !== undefined && isPreviewBlob(settings.blob) ? settings.blob : undefined;
  useEffect(
    () => () => {
      if (previewBlob !== undefined) dropPreviewBlob(previewBlob);
    },
    [previewBlob],
  );
  if (!doc) return null;

  const chooseImage = async () => {
    const [file] = await pickFiles('images');
    if (!file) return;
    try {
      const blob = await decodeImageFile(file);
      setImageError(false);
      update({ mode: 'image', blob: putPreviewBlob(blob) });
    } catch {
      setImageError(true);
    }
  };

  const apply = () => {
    if (!built) return;
    if (built.kind === 'image' && isPreviewBlob(built.blob)) {
      const pending = takePreviewBlob(built.blob);
      if (!pending) return;
      void useWorkspaceStore
        .getState()
        .applyComposed(
          (lease) => Promise.resolve(useWorkspaceStore.getState().addBlob(pending, lease)),
          (ws, _ids, blob: BlobId) =>
            applyFurniture(ws, documentId, 'watermark', [{ ...built, blob }]),
          m.furniture_title_watermark(),
        )
        .then((done) => commit('watermark', () => done));
      return;
    }
    commit('watermark', () =>
      useWorkspaceStore
        .getState()
        .applyOperation(
          (ws) => applyFurniture(ws, documentId, 'watermark', [built]),
          m.furniture_title_watermark(),
        ),
    );
  };

  const rotation = clampRotation(settings.rotate);
  return (
    <Frame
      kind="watermark"
      documentId={documentId}
      open={open}
      existing={existing}
      canApply={built !== undefined}
      onApply={apply}
    >
      <SheetGroup
        label={m.furniture_watermark_kind()}
        footnote={
          settings.mode === 'image' && (imageError || settings.blob === undefined)
            ? imageError
              ? m.furniture_image_failed()
              : m.furniture_no_image()
            : undefined
        }
      >
        <SheetRow full>
          <Segmented<'text' | 'image'>
            label={m.furniture_watermark_kind()}
            value={settings.mode}
            onValueChange={(mode) => update({ mode })}
            options={[
              { value: 'text', label: m.furniture_text() },
              { value: 'image', label: m.furniture_image() },
            ]}
          />
        </SheetRow>
        {settings.mode === 'text' ? (
          <SheetRow full>
            <TextField
              label={m.furniture_text()}
              hideLabel
              value={settings.text}
              data-testid="watermark-text"
              onValueChange={(text) => update({ text })}
            />
          </SheetRow>
        ) : (
          <SheetRow title={m.furniture_image()}>
            <Button size="sm" onClick={() => void chooseImage()}>
              {m.furniture_choose_image()}
            </Button>
          </SheetRow>
        )}
      </SheetGroup>
      {settings.mode === 'text' ? (
        <StyleSection style={settings.style} onChange={(style) => update({ style })} />
      ) : (
        <SheetGroup label={m.furniture_image()}>
          <SheetRow full>
            <Percent
              label={m.furniture_scale()}
              value={settings.scale}
              min={5}
              max={400}
              onChange={(scale) => update({ scale })}
            />
          </SheetRow>
          <SheetRow full>
            <Percent
              label={m.furniture_opacity()}
              value={settings.style.opacity}
              min={5}
              onChange={(opacity) => update({ style: { ...settings.style, opacity } })}
            />
          </SheetRow>
        </SheetGroup>
      )}
      <SheetGroup
        label={m.furniture_position()}
        footnote={settings.layer === 'behind' ? m.furniture_behind_note() : undefined}
      >
        <SheetRow full>
          <Slider
            label={m.furniture_rotation()}
            showLabel
            readout
            min={-90}
            max={90}
            detents={[-45, 0, 45]}
            value={rotation}
            format={(degrees) => `${formatNumber(degrees)}°`}
            onValueChange={(rotate) => update({ rotate })}
          />
        </SheetRow>
        <SheetRow full>
          <Segmented<string>
            label={m.furniture_rotation()}
            value={String(rotation)}
            onValueChange={(preset) => update({ rotate: Number(preset) })}
            options={[-45, 0, 45, 90].map((preset) => ({
              value: String(preset),
              label: `${formatNumber(preset)}°`,
            }))}
          />
        </SheetRow>
        <SheetRow full>
          <Checkbox
            label={m.furniture_tile()}
            checked={settings.tile}
            onCheckedChange={(tile) => update({ tile })}
          />
        </SheetRow>
        {settings.tile ? (
          <>
            <NumberRow
              label={m.furniture_gap_x()}
              value={settings.gapX}
              min={0}
              unit={m.furniture_unit_pt()}
              onChange={(gapX) => update({ gapX: Math.max(0, gapX) })}
            />
            <NumberRow
              label={m.furniture_gap_y()}
              value={settings.gapY}
              min={0}
              unit={m.furniture_unit_pt()}
              onChange={(gapY) => update({ gapY: Math.max(0, gapY) })}
            />
          </>
        ) : null}
        <SheetRow full>
          <Segmented<'over' | 'behind'>
            label={m.furniture_layer()}
            value={settings.layer}
            onValueChange={(layer) => update({ layer })}
            options={[
              { value: 'over', label: m.furniture_layer_over() },
              { value: 'behind', label: m.furniture_layer_behind() },
            ]}
          />
        </SheetRow>
      </SheetGroup>
      <RangeSection
        range={settings.range}
        pageCount={pageCount}
        onChange={(range) => update({ range })}
      />
    </Frame>
  );
}

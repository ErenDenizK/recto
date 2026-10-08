/**
 * The Markup palette (`03-markup` MK-2 to MK-17; `10-ink` §2, §6; flows §4.3): every creation
 * tool in one row with Done at its leading end, Select armed on opening.
 *
 * ```
 * ✓ Done │ ↖ │ ◉ ● ● ▬  ⌫ ◌ │ ▭▾ T □ ▣ ◈▾ │ ✑ Sign▾ [chips] ‹3/12› ⊞ ⬚ │ ¶ Edit text ▮ Redact │ +
 * ```
 *
 * - **Groups** (`palette-groups.ts`): Select · Draw · Add · Fill & sign · Page content, each a
 *   named `role="group"`, a hairline between them.
 * - **Measured fold** (`palette-fold.ts`, `palette-measure.ts`): the full row is laid out and
 *   measured ahead, once per language, density and set of items (`PaletteMeasurer`, mounted
 *   by the dock), then items drop their labels and fold into + in a fixed order until the row
 *   fits the free rectangle less 2 × 16 px. A `ResizeObserver` on the band re-runs the fold,
 *   one frame late at most, never during a stroke or while focus is inside. The palette so
 *   arrives folded, and the capsule morphs to the size it keeps.
 * - **The ink strip** (`InkStrip.tsx`, `10-ink` §2; owner feedback F3): its own small glass
 *   piece floating above the capsule (`StripPiece.tsx`, mounted by the dock), hugging its
 *   content, from the moment a tool with options arms; the capsule keeps one row, so the tools
 *   never move under the pointer that armed the pen. With the Fill & sign door and Select
 *   armed, the piece holds the saved-signature chips the row had no room for (03.7;
 *   `usePaletteStrip`).
 * - **Second press** on the armed tool opens its editor: the pen's preset editor
 *   (`annotations/pen/PresetEditor.tsx`), or the style editor of shapes, text box and note.
 * - **Stroke fade** (MK-17, `stroke-fade.ts`): 20 % and no pointer while a stroke runs, never
 *   with focus inside.
 * - **Esc ladder** (§5): Esc inside the palette disarms to Select, then closes Markup and gives
 *   focus to the dock's Markup; from the page, the window's Escape disarms first and the next
 *   Esc closes Markup with focus left on the page.
 * - **Keyboard**: one Tab stop (the armed tool), ←/→ between controls, Home/End, ↑ opens the
 *   focused tool's choices; Tab goes on into the strip.
 *
 * The palette is the capsule's Markup content (`shell/capsule/`, `shell/frame/Dock.tsx`; spec
 * X1): the capsule is the glass, measures this content at its own size and morphs to it. Its
 * pieces carry `data-capsule-item` keys (Done is `markup`, the dock's Markup door's twin; Sign is
 * `sign`, Fill & sign's), and the armed Select takes the focus on arrival (`data-capsule-focus`).
 * The twins look different, so each fades in at its own place after the dock has faded out,
 * rather than one label sliding over the new tools as the other (`capsule-morph.ts`). The capsule
 * fades it during a stroke.
 */
import { Menu } from '@base-ui/react/menu';
import { Popover } from '@base-ui/react/popover';
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { useAnnotationStore } from '../annotations/annotation-store';
import {
  activateTool,
  armBuiltinStamp,
  clearAnnotationTools,
  hasAnnotationToolState,
  hasToolEditor,
  pickImageStamp,
} from '../annotations/commands';
import { toolStyleGroup } from '../annotations/drafts';
import { PenWell } from '../annotations/pen/PenWell';
import { isHighlighter, PRESET_INDICES } from '../annotations/pen/presets';
import { BUILTIN_STAMPS } from '../annotations/stamps';
import { StyleControls } from '../annotations/StyleControls';
import { toolDefinition } from '../annotations/tools';
import { isEditableTarget } from '../commands/use-shortcuts';
import { m } from '../i18n';
import { useLocale } from '../i18n/use-locale';
import { useSizeClass } from '../shell/frame/size-class';
import { isMarkupOpenActive, useUiStore } from '../state/ui-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { Icon } from '../ui/Icon';
import { centredRoom, snapToWholePixels } from '../ui/whole-pixels';
import menuStyles from '../ui/Menu.module.css';
import { PopoverHeader, PopoverPopup } from '../ui/Popover';
import { useCoarsePointer } from '../ui/Slider';
import { isShapeMode, SHAPE_MODES, type ToolMode, useToolStore } from '../viewer/tool-store';
import { abovePalette } from './anchor';
import { ChoiceTool } from './ChoiceTool';
import { closeMarkupDoor } from './doors';
import { useStripKind } from './InkStrip';
import { MoreTools } from './MoreTools';
import { foldPalette, type FoldResult } from './palette-fold';
import {
  FOLD_STEPS,
  GROUP_LABEL,
  ITEM_GROUP,
  PALETTE_ITEMS,
  type PaletteItem,
} from './palette-groups';
import styles from './MarkupPalette.module.css';
import { type Measured, setAvailable, setMeasured, usePaletteLayout } from './palette-measure';
import { useRovingTabindex } from './roving';
import {
  AddFieldMenu,
  CHIP_COUNT,
  FieldStepper,
  OutlinesButton,
  PaletteLoads,
  SignatureChips,
  SignButton,
  useFieldStops,
  useSignatures,
} from './SignGroup';
import type { StripContent } from './StripPiece';
import { strokeInProgress, useStrokeInProgress } from './stroke-fade';
import { armedTooltip, PaletteButton } from './ToolButton';

/** Items that carry a label the fold may drop (they keep their glyph). */
const LABELLED: ReadonlySet<PaletteItem> = new Set(['done', 'sign', 'edit-text', 'redact']);

/** The palette's margin inside the free rectangle, each side (MK-2 §2: 16 px). */
const MARGIN = 16;

const px = (value: string) => Number.parseFloat(value) || 0;

/** Reads the row's items and spacing (the CSS is the one source of the numbers). */
function measureRow(row: HTMLElement): Omit<Measured, 'key'> {
  const widths: Record<string, number> = {};
  for (const el of row.querySelectorAll<HTMLElement>('[data-item]')) {
    const id = el.dataset.item ?? '';
    let width = el.getBoundingClientRect().width;
    // The Highlighter's cell sits in the pens' well; each is measured on its own.
    if (id === 'pens') {
      const highlighter = el.querySelector<HTMLElement>('[data-item="highlighter"]');
      if (highlighter) width -= highlighter.getBoundingClientRect().width;
    }
    widths[id] = Math.round(width * 100) / 100;
  }
  const group = row.querySelector<HTMLElement>('[data-group]');
  const sep = row.querySelector<HTMLElement>('[data-sep]');
  const sepStyle = sep ? getComputedStyle(sep) : null;
  const rowStyle = getComputedStyle(row);
  return {
    widths,
    metrics: {
      gap: group ? px(getComputedStyle(group).columnGap) : 0,
      separator: sep && sepStyle ? 1 + px(sepStyle.marginLeft) + px(sepStyle.marginRight) : 0,
      // Both paddings and the capsule's 1 px rim each side.
      padding: px(rowStyle.paddingLeft) + px(rowStyle.paddingRight) + 2,
    },
    button: px(rowStyle.getPropertyValue('--bar-button')) || 32,
  };
}

/** What the items of the row show: the fold's result, or everything (the measuring row). */
interface RowState {
  readonly visible: ReadonlySet<string>;
  readonly bare: ReadonlySet<string>;
  readonly folded: readonly PaletteItem[];
}

/**
 * The items the row may hold for this door and document, in row order. The measurer (`door`
 * `any`) reads the signatures and fields already loaded and starts no load: the open palette
 * does, and the measurer measures again when they arrive.
 */
function useCandidates(door: 'draw' | 'sign' | 'any'): readonly PaletteItem[] {
  const load = door !== 'any';
  const signatures = useSignatures(load);
  const hasFields = useFieldStops(load).length > 0;
  return PALETTE_ITEMS.filter((item) =>
    item === 'chips'
      ? door !== 'draw' && signatures.length > 0
      : item === 'stepper'
        ? hasFields
        : true,
  );
}

/** The row's runs and items (`role="group"` per run, a hairline between shown runs). */
function PaletteRow({
  candidates,
  state,
}: {
  readonly candidates: readonly PaletteItem[];
  readonly state: RowState;
}) {
  const runs: { group: string; items: PaletteItem[] }[] = [];
  for (const item of candidates) {
    if (!state.visible.has(item)) continue;
    const group = ITEM_GROUP[item];
    const last = runs[runs.length - 1];
    if (last?.group === group) last.items.push(item);
    else runs.push({ group, items: [item] });
  }
  return runs.map((run, index) => {
    const name =
      run.group === 'done' || run.group === 'more'
        ? undefined
        : GROUP_LABEL[run.group as keyof typeof GROUP_LABEL]();
    return (
      <GroupRun key={run.group} first={index === 0} name={name} group={run.group}>
        {run.items.map((item) => (
          <PaletteItemView key={item} item={item} state={state} />
        ))}
      </GroupRun>
    );
  });
}

function PaletteItemView({
  item,
  state,
}: {
  readonly item: PaletteItem;
  readonly state: RowState;
}): ReactNode {
  const presets = useAnnotationStore((s) => s.pen.presets);
  const hasFields = useFieldStops().length > 0;
  const frame = useSizeClass();
  const wide = frame.size === 'large' || frame.size === 'xlarge';
  const { visible, bare, folded } = state;
  switch (item) {
    case 'done':
      return (
        <PaletteButton
          item={item}
          label={m.markup_done()}
          tooltip={m.markup_done_tooltip()}
          icon={<Icon name="check" />}
          showLabel={!bare.has(item)}
          className={styles.done}
          aria-description={m.markup_done_description()}
          data-markup-done=""
          onClick={() => closeMarkupDoor()}
        />
      );
    case 'select':
      return <SimpleTool mode="select" item={item} />;
    case 'pens': {
      const pens = PRESET_INDICES.filter((i) => !isHighlighter(presets[i]));
      const highlighters = PRESET_INDICES.filter((i) => isHighlighter(presets[i]));
      return (
        <PenWell
          cells={visible.has('highlighter') ? [...pens, ...highlighters] : pens}
          items={{ pens: 'pens', highlighter: 'highlighter' }}
        />
      );
    }
    case 'highlighter':
      // Drawn inside the pens' well.
      return null;
    case 'eraser':
    case 'lasso':
    case 'text-box':
    case 'note':
    case 'image':
      return <SimpleTool mode={item} item={item} />;
    case 'edit-text':
    case 'redact':
      return <SimpleTool mode={item} item={item} showLabel={!bare.has(item)} />;
    case 'shapes':
      return <ShapesTool />;
    case 'stamp':
      return <StampTool />;
    case 'sign':
      return <SignButton showLabel={!bare.has(item)} chipsShown={visible.has('chips')} />;
    case 'chips':
      return <SignatureChips item={item} />;
    case 'stepper':
      return <FieldStepper countLabel={wide} />;
    case 'add-field':
      return <AddFieldMenu />;
    case 'outlines':
      return <OutlinesButton hasFields={hasFields} />;
    case 'more':
      return <MoreTools folded={folded} />;
  }
}

const EVERYTHING: RowState = {
  visible: new Set(PALETTE_ITEMS),
  bare: new Set(),
  folded: [],
};

/**
 * The palette's measurer (MK-2 §2, `palette-measure.ts`), mounted by the dock with the page:
 * whenever the language, the density, the items or the frame's width class change, it lays out
 * every item the palette may show, labelled, where nobody sees or reaches it, measures it and
 * takes it out again in the same commit (no frame ever paints it, and no query finds a second
 * copy of a control). Beside it, the band's room, one frame late at most, never during a stroke
 * or while focus is inside the palette (the controls would move under the hand or the keyboard).
 * So the palette folds right on the frame it arrives in, and the capsule morphs to that size.
 */
export function PaletteMeasurer() {
  const hostRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const candidates = useCandidates('any');
  const signatures = useSignatures(false);
  const coarse = useCoarsePointer();
  const locale = useLocale();
  const frame = useSizeClass();
  const wide = frame.size === 'large' || frame.size === 'xlarge';
  const frozen = useStrokeInProgress();
  const { measured } = usePaletteLayout();
  const key = [
    locale,
    coarse ? 'coarse' : 'fine',
    candidates.join(','),
    Math.min(signatures.length, CHIP_COUNT),
    wide ? 'wide' : 'narrow',
  ].join('|');
  const measuring = measured?.key !== key;

  useLayoutEffect(() => {
    if (!measuring) return;
    const row = rowRef.current;
    if (row) setMeasured({ key, ...measureRow(row) });
  }, [measuring, key]);

  useLayoutEffect(() => {
    const band =
      hostRef.current?.closest<HTMLElement>('[data-frame-layer="band"]') ?? document.body;
    let raf = 0;
    const measure = () => setAvailable(band.clientWidth - 2 * MARGIN);
    const update = () => {
      if (frozen || strokeInProgress()) return;
      const focused = document.activeElement;
      if (focused instanceof Element && focused.closest('[data-markup-palette]')) return;
      measure();
    };
    // The room now; later changes wait for the stroke to end and the focus to leave.
    if (!frozen) measure();
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    });
    observer.observe(band);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [frozen]);

  return (
    <div ref={hostRef} className={`${styles.content} ${styles.measurer}`} aria-hidden="true" inert>
      {measuring ? (
        <div ref={rowRef} className={styles.row}>
          <PaletteLoads value={false}>
            <PaletteRow candidates={candidates} state={EVERYTHING} />
          </PaletteLoads>
        </div>
      ) : null}
    </div>
  );
}

/** The palette's door on the active document: Draw, or Fill & sign's Sign set. */
function usePaletteDoor(): 'draw' | 'sign' {
  const id = useWorkspaceStore((s) => s.workspace.activeDocument);
  return useUiStore((s) => (id === undefined ? 'draw' : (s.docUi[id]?.paletteSet ?? 'draw')));
}

/** The measured fold of the row for `door` (MK-2 §2): the candidates and what each shows. */
function useRowState(door: 'draw' | 'sign'): {
  readonly candidates: readonly PaletteItem[];
  readonly state: RowState;
} {
  const candidates = useCandidates(door);
  const { measured, available } = usePaletteLayout();
  const fold: FoldResult | null =
    measured === null
      ? null
      : foldPalette(
          candidates.map((item) => ({
            id: item,
            group: ITEM_GROUP[item],
            width: measured.widths[item] ?? 0,
            bareWidth: LABELLED.has(item) ? measured.button : undefined,
          })),
          FOLD_STEPS,
          available,
          measured.metrics,
        );
  return {
    candidates,
    state: {
      visible: new Set<string>(fold ? fold.visible : candidates),
      bare: fold?.bare ?? new Set<string>(),
      folded: (fold?.folded ?? []) as readonly PaletteItem[],
    },
  };
}

/**
 * What the palette's floating strip holds (`StripPiece.tsx`; owner feedback F3): the armed
 * tool's ink strip; else, with the Fill & sign door, Select or Sign armed and no room for the
 * saved-signature chips in the row, those chips (03.7); else nothing.
 */
export function usePaletteStrip(): StripContent | null {
  const door = usePaletteDoor();
  const mode = useToolStore((s) => s.mode);
  const kind = useStripKind();
  const signatures = useSignatures();
  const { state } = useRowState(door);
  if (kind !== null) return kind;
  const chips =
    door === 'sign' &&
    signatures.length > 0 &&
    state.folded.includes('chips') &&
    (mode === 'select' || mode === 'signature');
  return chips ? 'chips' : null;
}

/**
 * The Esc ladder inside the palette and its strip (§5): Esc disarms to Select, then closes
 * Markup. Keys React carries from portals (the editors, menus) are theirs.
 */
export function paletteEscape(event: KeyboardEvent<HTMLElement>): void {
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
  event.preventDefault();
  event.stopPropagation();
  if (hasAnnotationToolState()) clearAnnotationTools();
  else closeMarkupDoor();
}

/** The palette's row: what the capsule's content slot holds (module header). */
export function MarkupPaletteContent() {
  const rowRef = useRef<HTMLDivElement>(null);
  // The capsule rests at this content's size, centred in the dock: its width rounds so the
  // palette's glass rests on whole pixels (Q-2; it sat at x 190.88, V2 review item 16).
  const contentRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return undefined;
    return snapToWholePixels(el, 'width', { container: () => centredRoom(el, '[data-capsule]') });
  }, []);
  const door = usePaletteDoor();
  const mode = useToolStore((s) => s.mode);
  const activePen = useAnnotationStore((s) => s.pen.active);
  const { candidates, state } = useRowState(door);

  // --- Focus, roving and Esc -----------------------------------------------------------
  const roving = useRovingTabindex(
    rowRef,
    '[data-tool][aria-pressed="true"], [data-pen-preset][aria-pressed="true"]',
    `${mode}|${activePen}`,
  );
  // The ladder's last step from the page (§5): with nothing armed or selected (the window's
  // Escape disarmed it on the press before), Esc closes Markup and focus stays on the page. In
  // the bubble phase on the document, so a widget that takes Esc (an editor, a menu, the
  // lasso, a dialog) claims it first, and before the window's shortcut listener.
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
      const target = event.target;
      if (isEditableTarget(target)) return;
      if (target instanceof Element && target.closest('[aria-modal="true"], [role="dialog"]')) {
        return;
      }
      if (target instanceof Element && target.closest('[data-markup-palette]')) return;
      if (hasAnnotationToolState() || !isMarkupOpenActive()) return;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) return;
      closeMarkupDoor();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div
      ref={contentRef}
      className={styles.content}
      data-markup-palette=""
      data-annotation-keep=""
      data-palette-set={door}
    >
      <div
        ref={rowRef}
        role="toolbar"
        aria-label={m.markup_label()}
        aria-orientation="horizontal"
        className={styles.row}
        onKeyDownCapture={paletteEscape}
        onKeyDown={roving.onKeyDown}
        onFocus={roving.onFocus}
      >
        <PaletteRow candidates={candidates} state={state} />
      </div>
      <ToolEditor rowRef={rowRef} />
    </div>
  );
}

function GroupRun({
  first,
  name,
  group,
  children,
}: {
  readonly first: boolean;
  readonly name: string | undefined;
  readonly group: string;
  readonly children: ReactNode;
}) {
  return (
    <>
      {first ? null : <span className={styles.sep} data-sep="" aria-hidden="true" />}
      <div
        className={styles.group}
        role={name === undefined ? undefined : 'group'}
        aria-label={name}
        data-group={group}
      >
        {children}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

function SimpleTool({
  mode,
  item,
  showLabel = false,
}: {
  readonly mode: ToolMode;
  readonly item: PaletteItem;
  readonly showLabel?: boolean;
}) {
  const armed = useToolStore((s) => s.mode === mode);
  const tool = toolDefinition(mode);
  const label = tool.title();
  const choices = mode !== 'select' && hasToolEditor(mode);
  return (
    <PaletteButton
      item={item}
      tool={mode}
      label={label}
      tooltip={
        mode === 'select'
          ? (tool.tooltip?.() ?? label)
          : armedTooltip(tool.tooltip?.() ?? label, armed, choices && armed)
      }
      icon={<Icon name={tool.icon} />}
      command={`tool.${mode}`}
      showLabel={showLabel}
      className={mode === 'select' ? styles.selectTool : undefined}
      // The capsule's focus on arrival (Capsule.tsx): the armed Select, the palette's Tab stop.
      data-capsule-focus={mode === 'select' && armed ? '' : undefined}
      aria-pressed={armed}
      aria-haspopup={choices ? 'dialog' : undefined}
      onClick={() => void activateTool(tool)}
    />
  );
}

function ShapesTool() {
  const mode = useToolStore((s) => s.mode);
  const lastShape = useToolStore((s) => s.lastShape);
  const shown = toolDefinition(isShapeMode(mode) ? mode : lastShape);
  const armed = isShapeMode(mode);
  const label = m.tool_shapes_menu({ shape: shown.title() });
  return (
    <ChoiceTool
      label={label}
      icon={<Icon name={shown.icon} />}
      armed={armed}
      command={`tool.${shown.mode}`}
      item="shapes"
      tool="shapes"
      onArm={() => activateTool(shown)}
    >
      {SHAPE_MODES.map((kind) => {
        const tool = toolDefinition(kind);
        return (
          <Menu.Item
            key={kind}
            className={menuStyles.item}
            data-tool={kind}
            data-checked={mode === kind ? '' : undefined}
            onClick={() => void activateTool(tool)}
          >
            <Icon name={tool.icon} className={styles.menuIcon} />
            <span className={menuStyles.label}>{tool.title()}</span>
            {tool.shortcut ? <kbd className={styles.menuKey}>{tool.shortcut}</kbd> : null}
          </Menu.Item>
        );
      })}
    </ChoiceTool>
  );
}

function StampTool() {
  const armed = useToolStore((s) => s.mode === 'stamp');
  const pending = useAnnotationStore((s) => s.pendingStamp);
  const tool = toolDefinition('stamp');
  return (
    <ChoiceTool
      label={tool.title()}
      icon={<Icon name="stamp" />}
      armed={armed}
      command="tool.stamp"
      item="stamp"
      tool="stamp"
      onArm={() => activateTool(tool)}
    >
      {BUILTIN_STAMPS.map((stamp) => (
        <Menu.Item
          key={stamp.name}
          className={menuStyles.item}
          data-checked={
            armed && pending?.kind === 'builtin' && pending.name === stamp.name ? '' : undefined
          }
          onClick={() => armBuiltinStamp(stamp.name)}
        >
          <span className={styles.stampChip} style={{ color: stamp.color }}>
            {stamp.label()}
          </span>
        </Menu.Item>
      ))}
      <Menu.Separator className={menuStyles.separator} />
      <Menu.Item className={menuStyles.item} onClick={() => void pickImageStamp('image')}>
        <Icon name="image" className={styles.menuIcon} />
        <span className={menuStyles.label}>{m.stamp_image()}</span>
      </Menu.Item>
    </ChoiceTool>
  );
}

/**
 * The style editor of shapes, a text box and a note (MK-8): the armed tool's full options on
 * its second press, the popover recipe rising from its button; Esc or ✕ closes only it.
 */
function ToolEditor({ rowRef }: { readonly rowRef: { readonly current: HTMLElement | null } }) {
  const mode = useToolStore((s) => s.mode);
  const open = useToolStore((s) => s.editorOpen);
  const group = toolStyleGroup(mode);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const shown = open && mode !== 'ink' && group !== undefined;
  useLayoutEffect(() => {
    if (!shown) return;
    const selector = isShapeMode(mode) ? '[data-tool="shapes"]' : `[data-tool="${mode}"]`;
    setAnchor(
      rowRef.current?.querySelector<HTMLElement>(selector) ??
        rowRef.current?.querySelector<HTMLElement>('[data-more-tools]') ??
        null,
    );
  }, [shown, mode, rowRef]);
  if (!shown || !anchor || group === undefined) return null;
  const close = () => useToolStore.getState().setEditorOpen(false);
  return (
    <PopoverHost anchor={anchor} onClose={close}>
      <PopoverHeader title={m.bar_options({ tool: toolDefinition(mode).title() })} />
      <StyleControls variant="tool" group={group} />
    </PopoverHost>
  );
}

function PopoverHost({
  anchor,
  onClose,
  children,
}: {
  readonly anchor: HTMLElement;
  readonly onClose: () => void;
  readonly children: ReactNode;
}) {
  return (
    <Popover.Root
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <PopoverPopup
        anchor={abovePalette(() => anchor)}
        side="top"
        sideOffset={12}
        data-annotation-keep=""
        data-testid="tool-style-editor"
        finalFocus={() => anchor}
      >
        {children}
      </PopoverPopup>
    </Popover.Root>
  );
}

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
 * - **Measured fold** (`palette-fold.ts`): the full row is laid out and measured once per
 *   language, density and set of items, then items drop their labels and fold into + in a
 *   fixed order until the row fits the free rectangle less 2 × 16 px. A `ResizeObserver` on the
 *   band re-runs the fold, one frame late at most, never during a stroke or while focus is
 *   inside.
 * - **The ink strip** (`InkStrip.tsx`, `10-ink` §2): from large up it hangs inline off the
 *   trailing end when the room allows, as a drawer, so the tools stay where the pointer left
 *   them; otherwise it is a second row of the same glass, above the tools. With the Fill & sign
 *   door and Select armed, that row holds the saved-signature chips the row had no room for
 *   (03.7).
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
 * The glass element here (`.surface`) stands in for the capsule of D2-2 (`shell/capsule/`):
 * `MarkupPaletteContent` is the part that goes into its content slot, and the palette reports
 * its own size by layout, nothing else, so the capsule can morph to it.
 */
import { Menu } from '@base-ui/react/menu';
import { Popover } from '@base-ui/react/popover';
import {
  type CSSProperties,
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
import menuStyles from '../ui/Menu.module.css';
import { PopoverHeader, PopoverPopup } from '../ui/Popover';
import { useCoarsePointer } from '../ui/Slider';
import { isShapeMode, SHAPE_MODES, type ToolMode, useToolStore } from '../viewer/tool-store';
import { abovePalette } from './anchor';
import { ChoiceTool } from './ChoiceTool';
import { closeMarkupDoor, takeFocusOnOpen } from './doors';
import { InkStrip, useStripKind } from './InkStrip';
import { MoreTools } from './MoreTools';
import { type FoldMetrics, foldPalette, type FoldResult } from './palette-fold';
import {
  FOLD_STEPS,
  GROUP_LABEL,
  ITEM_GROUP,
  PALETTE_ITEMS,
  type PaletteItem,
} from './palette-groups';
import styles from './MarkupPalette.module.css';
import { useRovingTabindex } from './roving';
import {
  AddFieldMenu,
  CHIP_COUNT,
  FieldStepper,
  OutlinesButton,
  SignatureChips,
  SignButton,
  useFieldStops,
  useSignatures,
} from './SignGroup';
import { strokeInProgress, useStrokeFade } from './stroke-fade';
import { armedTooltip, PaletteButton } from './ToolButton';

/** Items that carry a label the fold may drop (they keep their glyph). */
const LABELLED: ReadonlySet<PaletteItem> = new Set(['done', 'sign', 'edit-text', 'redact']);

/** The palette's margin inside the free rectangle, each side (MK-2 §2: 16 px). */
const MARGIN = 16;

/** One measuring of the full row (module header). */
interface Measured {
  readonly key: string;
  readonly widths: Readonly<Record<string, number>>;
  readonly metrics: FoldMetrics;
  /** A bare labelled item: the round button's width. */
  readonly button: number;
}

const px = (value: string) => Number.parseFloat(value) || 0;

/** Reads the row's items and spacing (the CSS is the one source of the numbers). */
function measureRow(row: HTMLElement, dock: HTMLElement): Omit<Measured, 'key'> {
  const widths: Record<string, number> = {};
  for (const el of row.querySelectorAll<HTMLElement>('[data-item]')) {
    const id = el.dataset.item ?? '';
    let width = el.getBoundingClientRect().width;
    // The Highlighter's cell sits in the pens' well; each is measured on its own.
    if (id === 'pens') {
      const highlighter = el.querySelector<HTMLElement>('[data-item="highlighter"]');
      if (highlighter) width -= highlighter.getBoundingClientRect().width;
    }
    widths[id] = width;
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
      // Both paddings and the glass's 1 px border each side.
      padding: px(rowStyle.paddingLeft) + px(rowStyle.paddingRight) + 2,
    },
    button: px(getComputedStyle(dock).getPropertyValue('--bar-button')) || 32,
  };
}

export function MarkupPalette() {
  const [dock, setDock] = useState<HTMLDivElement | null>(null);
  const [focusInside, setFocusInside] = useState(false);
  const fading = useStrokeFade(focusInside);
  const [drawer, setDrawer] = useState(0);
  return (
    <div
      ref={setDock}
      className={styles.dock}
      style={drawer > 0 ? ({ '--drawer': `${drawer}px` } as CSSProperties) : undefined}
      data-markup-dock=""
    >
      <div
        className={styles.surface}
        data-region="toolbar"
        data-markup-palette=""
        data-annotation-keep=""
        data-stroking={fading ? '' : undefined}
        onFocus={() => setFocusInside(true)}
        onBlur={(event) => {
          const next = event.relatedTarget;
          if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
            setFocusInside(false);
          }
        }}
      >
        <MarkupPaletteContent dock={dock} onDrawer={setDrawer} frozen={fading || focusInside} />
      </div>
    </div>
  );
}

export interface MarkupPaletteContentProps {
  /** The element whose parent is the band the palette may fill (the fold's room). */
  readonly dock: HTMLElement | null;
  /** The inline strip's width (with its separator), by which the host pads its leading side. */
  readonly onDrawer: (width: number) => void;
  /** No re-fold now: a stroke is running or focus is inside (MK-2 §2). */
  readonly frozen: boolean;
}

/** The palette's rows: what the capsule's content slot holds (module header). */
export function MarkupPaletteContent({ dock, onDrawer, frozen }: MarkupPaletteContentProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const id = useWorkspaceStore((s) => s.workspace.activeDocument);
  const door = useUiStore((s) => (id === undefined ? 'draw' : (s.docUi[id]?.paletteSet ?? 'draw')));
  const mode = useToolStore((s) => s.mode);
  const presets = useAnnotationStore((s) => s.pen.presets);
  const stripKind = useStripKind();
  const signatures = useSignatures();
  const hasFields = useFieldStops().length > 0;
  const coarse = useCoarsePointer();
  const locale = useLocale();
  const frame = useSizeClass();
  const wide = frame.size === 'large' || frame.size === 'xlarge';

  // --- The fold ------------------------------------------------------------------------
  const candidates = PALETTE_ITEMS.filter((item) =>
    item === 'chips'
      ? door === 'sign' && signatures.length > 0
      : item === 'stepper'
        ? hasFields
        : true,
  );
  const key = [
    locale,
    coarse ? 'coarse' : 'fine',
    candidates.join(','),
    Math.min(signatures.length, CHIP_COUNT),
    wide ? 'wide' : 'narrow',
  ].join('|');
  const [measured, setMeasured] = useState<Measured | null>(null);
  const measuring = measured?.key !== key;
  const [available, setAvailable] = useState(Number.POSITIVE_INFINITY);

  useLayoutEffect(() => {
    if (!measuring) return;
    const row = rowRef.current;
    if (!row || !dock) return;
    setMeasured({ key, ...measureRow(row, dock) });
  }, [measuring, key, dock]);

  // The room: the band's width less the margins, followed one frame late (MK-2 §2).
  useLayoutEffect(() => {
    const parent = dock?.parentElement;
    if (!parent) return;
    let raf = 0;
    const measure = () => setAvailable(parent.clientWidth - 2 * MARGIN);
    const update = () => {
      if (frozen || strokeInProgress()) return;
      measure();
    };
    // The room now; later changes wait for the stroke to end and the focus to leave.
    measure();
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    });
    observer.observe(parent);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [dock, frozen]);

  const fold: FoldResult | null =
    measuring || !measured
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
  const visible = new Set<string>(fold ? fold.visible : candidates);
  const bare = fold?.bare ?? new Set<string>();
  const folded = (fold?.folded ?? []) as readonly PaletteItem[];

  // --- The strip: inline as a drawer, or a second row ----------------------------------
  const stripKey = `${stripKind ?? ''}|${locale}|${coarse}`;
  const [strip, setStrip] = useState<{ readonly key: string; readonly width: number } | null>(null);
  const separator = measured?.metrics.separator ?? 13;
  const inline =
    stripKind !== null &&
    fold !== null &&
    wide &&
    strip?.key === stripKey &&
    fold.width + 2 * (strip.width + separator) <= available;
  useLayoutEffect(() => {
    const element = stripRef.current;
    if (!element || stripKind === null) return;
    const width = element.getBoundingClientRect().width;
    if (strip?.key !== stripKey || Math.abs(strip.width - width) > 0.5) {
      setStrip({ key: stripKey, width });
    }
  }, [stripKind, stripKey, strip]);
  useLayoutEffect(() => {
    onDrawer(inline && strip ? strip.width + separator : 0);
  }, [inline, strip, separator, onDrawer]);

  const chipsInRow =
    !inline &&
    stripKind === null &&
    door === 'sign' &&
    signatures.length > 0 &&
    folded.includes('chips') &&
    (mode === 'select' || mode === 'signature');

  // --- Focus, roving and Esc -----------------------------------------------------------
  const roving = useRovingTabindex(
    rowRef,
    '[data-tool][aria-pressed="true"], [data-pen-preset][aria-pressed="true"]',
  );
  useLayoutEffect(() => {
    if (!takeFocusOnOpen()) return;
    rowRef.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
  }, []);

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

  const onKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    // React carries keys from portals (the editors, menus) through here: those are theirs.
    if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    if (hasAnnotationToolState()) clearAnnotationTools();
    else closeMarkupDoor({ fromPalette: true });
  };

  // --- The row ---------------------------------------------------------------------------
  const pens = PRESET_INDICES.filter((i) => !isHighlighter(presets[i]));
  const highlighters = PRESET_INDICES.filter((i) => isHighlighter(presets[i]));

  const render = (item: PaletteItem): ReactNode => {
    switch (item) {
      case 'done':
        return (
          <PaletteButton
            key={item}
            item={item}
            label={m.markup_done()}
            tooltip={m.markup_done_tooltip()}
            icon={<Icon name="check" />}
            showLabel={!bare.has(item)}
            className={styles.done}
            aria-description={m.markup_done_description()}
            data-markup-done=""
            onClick={() => closeMarkupDoor({ fromPalette: true })}
          />
        );
      case 'select':
        return <SimpleTool key={item} mode="select" item={item} />;
      case 'pens':
        return (
          <PenWell
            key={item}
            cells={visible.has('highlighter') ? [...pens, ...highlighters] : pens}
            items={{ pens: 'pens', highlighter: 'highlighter' }}
          />
        );
      case 'highlighter':
        // Drawn inside the pens' well.
        return null;
      case 'eraser':
      case 'lasso':
      case 'text-box':
      case 'note':
      case 'image':
        return <SimpleTool key={item} mode={item} item={item} />;
      case 'edit-text':
      case 'redact':
        return <SimpleTool key={item} mode={item} item={item} showLabel={!bare.has(item)} />;
      case 'shapes':
        return <ShapesTool key={item} />;
      case 'stamp':
        return <StampTool key={item} />;
      case 'sign':
        return (
          <SignButton key={item} showLabel={!bare.has(item)} chipsShown={visible.has('chips')} />
        );
      case 'chips':
        return <SignatureChips key={item} item={item} />;
      case 'stepper':
        return <FieldStepper key={item} countLabel={wide} />;
      case 'add-field':
        return <AddFieldMenu key={item} />;
      case 'outlines':
        return <OutlinesButton key={item} hasFields={hasFields} />;
      case 'more':
        return <MoreTools key={item} folded={folded} />;
    }
  };

  // Shown items by run, in row order; a hairline between two shown runs.
  const runs: { group: string; items: PaletteItem[] }[] = [];
  for (const item of candidates) {
    if (!visible.has(item)) continue;
    const group = ITEM_GROUP[item];
    const last = runs[runs.length - 1];
    if (last?.group === group) last.items.push(item);
    else runs.push({ group, items: [item] });
  }

  const stripNode =
    stripKind === null ? null : (
      <div
        ref={stripRef}
        className={styles.stripHost}
        data-strip-placement={inline ? 'inline' : 'row'}
      >
        <InkStrip kind={stripKind} />
      </div>
    );

  return (
    <>
      <div
        ref={rowRef}
        role="toolbar"
        aria-label={m.markup_label()}
        aria-orientation="horizontal"
        className={styles.row}
        data-measuring={measuring ? '' : undefined}
        data-palette-set={door}
        onKeyDownCapture={onKeyDownCapture}
        onKeyDown={roving.onKeyDown}
        onFocus={roving.onFocus}
      >
        {runs.map((run, index) => {
          const name =
            run.group === 'done' || run.group === 'more'
              ? undefined
              : GROUP_LABEL[run.group as keyof typeof GROUP_LABEL]();
          return (
            <GroupRun key={run.group} first={index === 0} name={name} group={run.group}>
              {run.items.map(render)}
            </GroupRun>
          );
        })}
        {inline ? (
          <>
            <span className={styles.sep} data-sep="" aria-hidden="true" />
            {stripNode}
          </>
        ) : null}
      </div>
      {!inline && (stripNode || chipsInRow) ? (
        <div className={styles.stripRow} data-strip-row="" onKeyDownCapture={onKeyDownCapture}>
          {stripNode ?? <SignatureChips />}
        </div>
      ) : null}
      <ToolEditor rowRef={rowRef} />
    </>
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

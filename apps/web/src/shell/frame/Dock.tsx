/**
 * The dock at rest and the capsule it lives in (`components/01-frame.md` F10; flows.md §4.2;
 * spec X1, D2-2). In viewing the capsule (`shell/capsule/Capsule.tsx`) holds the entry to everything that changes the document; the same glass morphs into the Markup palette
 * and into Locked.
 *
 * - **Dock:** Pages · Markup · Fill & sign · Tools · More (Sign on a compact window). Pages opens the
 *   grid (`3`); Markup opens the palette on its Draw set and Fill & sign on its Sign set, Select
 *   armed (`M`, alias `2`; `G` arms the last signature, D2-7); More lists the tools that act on
 *   the page in place (Edit text, Redact) and the app's doors, ⌘K first (flows §4.2; DSN-47:
 *   OCR, Compare and Crop are the title menu's rows, so they left More).
 * - **Tools** (DSN-76, in force): between Fill & sign and More, a menu of
 *   Redact, OCR, Compare, Combine, Split and Compress that run the title menu's commands.
 * - **Locked** (F10 §2, §4): a locked document's dock is Pages · Locked · More. Locked replaces
 *   Markup and Fill & sign, opening the title menu with its Lock switch until the Unlock
 *   popover of `lock/` lands (spec X4). Lock engaging while the palette is open morphs it into
 *   Locked and closes Markup (`watchLockClosesMarkup`).
 * - **Palette:** the Markup palette (`markup/MarkupPalette.tsx`, D2-3), its ink strip a glass
 *   piece of its own floating above the capsule (`markup/StripPiece.tsx`, owner feedback F3);
 *   both fade while a stroke is in progress, never with focus inside (MK-17).
 * - **Glyphs only** (DSN-91, which retires RA-20's always-visible labels for the capsule): every
 *   item is a 44 px circle with a 22 px glyph and no visible word; its name is its accessible
 *   name and its tooltip ("Markup" and the keycap), and the keys stay in `aria-keyshortcuts`.
 * - **Keyboard:** one Tab stop with arrows between items (roving); F6 lands on the last focused
 *   item, else Pages (`regions.ts`). Focus that was in the capsule follows the morph: into the
 *   palette's Tab stop on opening, back to the door Markup was opened through on closing.
 * - **Announcements:** "Markup on. Select armed." once when a door opens it (A-14); the palette
 *   and the guard say the rest.
 *
 * The dock's pieces carry `data-capsule-item` keys (`pages`, `markup`, `fill-sign`, `tools`, `locked`, `more`),
 * so Pages and More slide into their Locked places instead of fading.
 */
import { Menu } from '@base-ui/react/menu';
import type { VirtualDocument } from '@pdf-editor/document-model';
import {
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { commandRegistry } from '../../commands/registry';
import { currentPlatform, toAriaKeyShortcut } from '../../commands/shortcuts';
import { useDragSession } from '../../dnd/drag-store';
import { useCommands } from '../../commands/use-commands';
import { m } from '../../i18n';
import { isLocked } from '../../state/lock-store';
import { type PaletteSet, useStageView, useUiStore } from '../../state/ui-store';
import { useActiveDocument, useWorkspaceStore } from '../../state/workspace-store';
import { Icon, type IconName } from '../../ui/Icon';
import menuStyles from '../../ui/Menu.module.css';
import { Tooltip } from '../../ui/Tooltip';
import { centredRoom, snapToWholePixels } from '../../ui/whole-pixels';
import { announce } from '../announcer';
import { Capsule } from '../capsule/Capsule';
import { type CapsuleShape, useCapsuleShape } from '../capsule/capsule-content';
import { abovePalette } from '../../markup/anchor';
import { openMarkupDoor } from '../../markup/doors';
import { MarkupPaletteContent, PaletteMeasurer, usePaletteStrip } from '../../markup/MarkupPalette';
import { StripPiece } from '../../markup/StripPiece';
import { useRovingTabindex } from '../../markup/roving';
import { useStrokeFade } from '../../markup/stroke-fade';
import { PagesBar, usePagesBarKey } from '../../stage/grid/PagesBar';
import styles from './Dock.module.css';
import { openTitleMenu } from './frame-store';
import { usePointerCapabilities } from './input-modality';
import { useSizeClass } from './size-class';
import { ToolsMenu } from './ToolsMenu';

/**
 * Opens Markup on `set` through a dock door (flows §4.2): the palette with Select armed, on its
 * Draw set or Fill & sign's. A locked document opens nothing (its dock shows Locked instead).
 */
export function openMarkupFrom(set: PaletteSet): void {
  const id = useWorkspaceStore.getState().workspace.activeDocument;
  if (id === undefined || isLocked(id)) return;
  openMarkupDoor(set);
}

/** The capsule with the dock, the palette or Locked. */
export function Dock() {
  const doc = useActiveDocument();
  const shape = useCapsuleShape(doc?.id);
  // The armed tool's ink strip (or the Fill & sign door's chips), a piece above the palette.
  const strip = usePaletteStrip();
  const [focusInside, setFocusInside] = useState(false);
  // Faded and out of the pointer's way while a stroke is in progress, never with focus inside
  // (MK-17), and the Pages bar while pages are dragged (04-context §2.7 *contextual*: hidden while
  // dragging).
  const strokeFade = useStrokeFade(focusInside);
  const draggingPages = useDragSession((s) => s.session !== null);
  const stroking = (strokeFade && shape === 'palette') || (draggingPages && shape === 'pages');
  // The page view's and the Pages grid's (whose content is the Pages bar, X21); Compare has its
  // own bar until the capsule becomes it.
  const view = useStageView();
  const pagesKey = usePagesBarKey(doc?.id);
  if (!doc || (view !== 'page' && view !== 'grid')) return null;
  return (
    <div
      className={styles.dock}
      data-dock=""
      data-stroking={stroking ? '' : undefined}
      onFocus={() => setFocusInside(true)}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (!(next instanceof Node) || !event.currentTarget.contains(next)) setFocusInside(false);
      }}
    >
      <Capsule
        shape={shape}
        morphKey={shape === 'pages' ? pagesKey : undefined}
        stroking={stroking}
      >
        {(content) => <DockContent shape={content} doc={doc} />}
      </Capsule>
      {/* Measures the palette ahead, so it arrives folded to the band (MK-2 §2). */}
      <PaletteMeasurer />
      {/* The ink strip floats above the palette as its own piece (owner feedback F3). */}
      <StripPiece content={shape === 'palette' ? strip : null} stroking={stroking} />
    </div>
  );
}

function DockContent({
  shape,
  doc,
}: {
  readonly shape: CapsuleShape;
  readonly doc: VirtualDocument;
}): ReactNode {
  if (shape === 'palette') return <MarkupPaletteContent />;
  if (shape === 'pages') return <PagesBar doc={doc} />;
  return <DockItems locked={shape === 'locked'} doc={doc} />;
}

const shortcutOf = (id: string) => commandRegistry.get(id)?.shortcuts[0];

/**
 * A command's every key as `aria-keyshortcuts` (key map v2, `commands/keymap.ts`): Markup's
 * "M 2", Pages' "3", Fill & sign's "G" (F10 §5–§6), read from the registry so the dock never
 * names a key the registry does not bind.
 */
const keysOf = (id: string) => {
  const shortcuts = commandRegistry.get(id)?.shortcuts ?? [];
  if (shortcuts.length === 0) return undefined;
  return shortcuts.map((s) => toAriaKeyShortcut(s, currentPlatform)).join(' ');
};

/** The dock's resting items (F10 §2): Pages · Markup · Fill & sign · Tools · More, or Locked. */
function DockItems({ locked, doc }: { readonly locked: boolean; readonly doc: VirtualDocument }) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useSizeClass();
  const door = useUiStore((s) => s.docUi[doc.id]?.paletteSet ?? 'draw');
  const roving = useRovingTabindex(ref, '[data-dock-item="pages"]');
  // Re-render when commands register (Pages and More read them).
  useCommands();
  const empty = doc.pages.length === 0;
  const reason = empty ? m.dock_no_pages() : undefined;
  const compact = frame.size === 'compact';
  // The capsule rests at this bar's size plus its rim, centred in the dock by a flex column. The
  // bar's width rounds so the capsule's edges both land on whole pixels (Q-2).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    return snapToWholePixels(el, 'width', { container: () => centredRoom(el, '[data-capsule]') });
  }, []);
  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label={m.dock_label()}
      aria-orientation="horizontal"
      className={styles.toolbar}
      data-bar-view={locked ? 'locked' : 'dock'}
      onKeyDown={roving.onKeyDown}
      onFocus={roving.onFocus}
    >
      <DockButton
        item="pages"
        icon="squares-four"
        label={m.dock_pages()}
        shortcut={shortcutOf('mode.arrange')}
        keys={keysOf('mode.arrange')}
        onActivate={() => void commandRegistry.execute('mode.arrange')}
      />
      {locked ? (
        <DockButton
          item="locked"
          icon="lock-simple"
          label={m.dock_locked()}
          name={m.dock_locked_name({ name: doc.title })}
          popup="dialog"
          focusOnArrival
          onActivate={() => openTitleMenu('menu')}
        />
      ) : (
        <>
          <DockButton
            item="markup"
            icon="marker-circle"
            label={m.dock_markup()}
            shortcut={shortcutOf('mode.edit')}
            keys={keysOf('mode.edit')}
            pressed={false}
            reason={reason}
            focusOnArrival={door === 'draw'}
            onActivate={() => openMarkupFrom('draw')}
          />
          <DockButton
            item="sign"
            icon="signature"
            label={compact ? m.dock_sign() : m.dock_fill_sign()}
            shortcut={shortcutOf('tool.signature')}
            keys={keysOf('tool.signature')}
            reason={reason}
            focusOnArrival={door === 'sign'}
            onActivate={() => openMarkupFrom('sign')}
          />
          {/* DSN-76: the document tools' visible door. */}
          <ToolsMenu />
        </>
      )}
      <MoreMenu />
    </div>
  );
}

/**
 * The key the morph knows an item by. Fill & sign and the palette's Sign now draw the same
 * glyph, so under one key the morph would slide Sign across the dock over Tools; each fades
 * in its own place instead (`capsule-morph.ts`, "a twin that looks different").
 */
const capsuleKey = (item: string): string => (item === 'sign' ? 'fill-sign' : item);

function DockButton({
  item,
  icon,
  label,
  name,
  shortcut,
  keys,
  pressed,
  popup,
  reason,
  focusOnArrival = false,
  onActivate,
}: {
  readonly item: string;
  readonly icon: IconName;
  readonly label: string;
  /** The accessible name when it says more than the label (Locked's "Unlock…"). */
  readonly name?: string | undefined;
  readonly shortcut?: ReturnType<typeof shortcutOf>;
  readonly keys?: string | undefined;
  readonly pressed?: boolean | undefined;
  readonly popup?: 'dialog' | 'menu' | undefined;
  /** Why it is dimmed; dimmed controls stay focusable and say why (RA-21). */
  readonly reason?: string | undefined;
  /** Takes focus when the dock arrives with focus in the capsule (the door Markup closed by). */
  readonly focusOnArrival?: boolean;
  readonly onActivate: () => void;
}) {
  const disabled = reason !== undefined;
  // An icon button at the slot size (`Dock.module.css`), named by `aria-label` and dimmed by
  // `aria-disabled` alone so a press still says why (RA-21) instead of being swallowed.
  const button = (
    // The IconButton's circle (`styles.item` composes it) with the tooltip's `reason` below,
    // which IconButton does not carry: a dimmed item says why (RA-21).
    // eslint-disable-next-line recto/q9-controls
    <button
      type="button"
      className={styles.item}
      data-size="bar"
      data-capsule-item={capsuleKey(item)}
      data-dock-item={item}
      data-capsule-focus={focusOnArrival ? '' : undefined}
      aria-label={name ?? label}
      aria-pressed={pressed}
      aria-haspopup={popup}
      aria-keyshortcuts={keys}
      aria-disabled={disabled ? 'true' : undefined}
      onClick={(event: ReactMouseEvent) => {
        if (disabled) {
          event.preventDefault();
          announce(reason);
          return;
        }
        onActivate();
      }}
    >
      <Icon name={icon} className={styles.icon} />
    </button>
  );
  // No visible word (DSN-91): the tooltip names the item, with its key or the reason (F10 §5).
  return (
    <Tooltip label={label} shortcut={shortcut} reason={reason} side="top">
      {button}
    </Tooltip>
  );
}

/**
 * More (flows §4.2; DSN-47): the page tools that have no dock button, each dimmed with its
 * reason when it cannot run, then the app's doors, each with its 16 px glyph as the phone's menu
 * rows have (system-audit-2026-10 §3.6, §4 Frame). Document commands (OCR, Compare, Crop) are
 * the title menu's; Keyboard shortcuts shows with a fine pointer only, as on the Library's ⋯
 * (02.18).
 */
interface MoreEntry {
  readonly id: string;
  readonly label: () => string;
  readonly icon: IconName;
  /** Shown only with a fine pointer (Keyboard shortcuts, 02.18). */
  readonly fineOnly?: true;
}
// DSN-76 (DSN-47): Redact lives in the Tools entry only, not in More too.
const MORE_ITEMS: readonly MoreEntry[] = [
  { id: 'tool.edit-text', label: m.dock_more_edit_text, icon: 'edit-text' },
  // DSN-68: the one door to Save a copy outside the title menu (first-session test, item 1).
  { id: 'file.export', label: m.save_a_copy, icon: 'export' },
];
const MORE_APP_ITEMS: readonly MoreEntry[] = [
  { id: 'view.palette', label: m.dock_more_commands, icon: 'list-magnifying-glass' },
  { id: 'help.shortcuts', label: m.frame_keyboard_shortcuts, icon: 'keyboard', fineOnly: true },
  { id: 'settings.open', label: m.frame_settings, icon: 'gear-six' },
];

function MoreMenu() {
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
  const pointers = usePointerCapabilities();
  const fine = pointers.primary === 'fine' || pointers.anyFine;
  return (
    <Menu.Root>
      <Tooltip label={m.dock_more()} shortcut={shortcutOf('view.palette')} side="top">
        <Menu.Trigger
          ref={setTrigger}
          className={styles.item}
          data-size="bar"
          aria-label={m.dock_more()}
          data-capsule-item="more"
          data-dock-item="more"
        >
          <Icon name="dots-three" className={styles.icon} />
        </Menu.Trigger>
      </Tooltip>
      <Menu.Portal>
        {/* 8 px above the capsule's glass, in line with More: anchored to More alone, the
            menu sat 8 px above the button, about 2 px above the glass (V2 review item 18). */}
        <Menu.Positioner
          side="top"
          align="end"
          sideOffset={8}
          collisionPadding={8}
          anchor={abovePalette(() => trigger)}
        >
          <Menu.Popup className={menuStyles.popup} aria-label={m.dock_more()}>
            {MORE_ITEMS.map((item) => (
              <MoreItem key={item.id} id={item.id} label={item.label()} icon={item.icon} />
            ))}
            <Menu.Separator className={menuStyles.separator} />
            {MORE_APP_ITEMS.filter((item) => fine || item.fineOnly !== true).map((item) => (
              <MoreItem key={item.id} id={item.id} label={item.label()} icon={item.icon} />
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function MoreItem({
  id,
  label,
  icon,
}: {
  readonly id: string;
  readonly label: string;
  readonly icon: IconName;
}) {
  const command = commandRegistry.get(id);
  if (!command) return null;
  const enabled = commandRegistry.isEnabled(command);
  const reason = enabled ? undefined : commandRegistry.disabledReason(command);
  return (
    <Menu.Item
      className={menuStyles.item}
      data-command={id}
      disabled={!enabled}
      onClick={() => void commandRegistry.execute(id)}
    >
      <Icon name={icon} aria-hidden="true" />
      <span className={menuStyles.label}>{label}</span>
      {reason ? <span className={menuStyles.hint}>{reason}</span> : null}
    </Menu.Item>
  );
}

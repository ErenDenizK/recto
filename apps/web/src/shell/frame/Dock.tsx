/**
 * The dock at rest and the capsule it lives in (`components/01-frame.md` F10; flows.md §4.2;
 * spec X1, D2-2). In viewing the capsule (`shell/capsule/Capsule.tsx`) holds the labelled
 * entry to everything that changes the document; the same glass morphs into the Markup palette
 * and into Locked.
 *
 * - **Dock:** Pages · Markup · Fill & sign · More (Sign on a compact window). Pages opens the
 *   grid (`3`); Markup opens the palette on its Draw set and Fill & sign on its Sign set, Select
 *   armed (`M`, alias `2`; `G` arms the last signature, D2-7); More lists the rarer doors
 *   (flows §4.2) with ⌘K last.
 * - **Locked** (F10 §2, §4): a locked document's dock is Pages · Locked · More. Locked replaces
 *   Markup and Fill & sign, opening the title menu with its Lock switch until the Unlock
 *   popover of `lock/` lands (spec X4). Lock engaging while the palette is open morphs it into
 *   Locked and closes Markup (`watchLockClosesMarkup`).
 * - **Palette:** the Markup palette (`markup/MarkupPalette.tsx`, D2-3), its ink strip a second
 *   row inside the same glass (no glass in glass, Q-4); the capsule fades while a stroke is in
 *   progress, never with focus inside (MK-17).
 * - **Labels** are always shown (RA-20): beside the icons when the dock fits so, else under
 *   them (`dock-labels.ts`); a compact window stacks them, as the phone's dock does.
 * - **Keyboard:** one Tab stop with arrows between items (roving); F6 lands on the last focused
 *   item, else Pages (`regions.ts`). Focus that was in the capsule follows the morph: into the
 *   palette's Tab stop on opening, back to the door Markup was opened through on closing.
 * - **Announcements:** "Markup on. Select armed." once when a door opens it (A-14); the palette
 *   and the guard say the rest.
 *
 * The dock's pieces carry `data-capsule-item` keys (`pages`, `markup`, `sign`, `locked`, `more`),
 * so Pages and More slide into their Locked places instead of fading.
 */
import { Menu } from '@base-ui/react/menu';
import type { VirtualDocument } from '@pdf-editor/document-model';
import {
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { commandRegistry } from '../../commands/registry';
import { currentPlatform, toAriaKeyShortcut } from '../../commands/shortcuts';
import { useDragSession } from '../../dnd/drag-store';
import { useCommands } from '../../commands/use-commands';
import { m, useLocale } from '../../i18n';
import { isLocked } from '../../state/lock-store';
import { type PaletteSet, useStageView, useUiStore } from '../../state/ui-store';
import { useActiveDocument, useWorkspaceStore } from '../../state/workspace-store';
import { Icon, type IconName } from '../../ui/Icon';
import menuStyles from '../../ui/Menu.module.css';
import { Tooltip } from '../../ui/Tooltip';
import { announce } from '../announcer';
import { Capsule } from '../capsule/Capsule';
import { type CapsuleShape, useCapsuleShape } from '../capsule/capsule-content';
import { abovePalette } from '../../markup/anchor';
import { openMarkupDoor } from '../../markup/doors';
import { useStripKind } from '../../markup/InkStrip';
import { MarkupPaletteContent, PaletteMeasurer } from '../../markup/MarkupPalette';
import { useRovingTabindex } from '../../markup/roving';
import { useStrokeFade } from '../../markup/stroke-fade';
import { PagesBar, usePagesBarKey } from '../../stage/grid/PagesBar';
import styles from './Dock.module.css';
import { type DockLabelForm, dockLabelForm, dockRoom } from './dock-labels';
import { openTitleMenu } from './frame-store';
import { type SizeClass, useSizeClass } from './size-class';

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
  // The armed tool's ink strip is the palette's second row: arming one grows the capsule.
  const strip = useStripKind();
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
        morphKey={
          shape === 'palette' ? (strip ?? 'tools') : shape === 'pages' ? pagesKey : undefined
        }
        stroking={stroking}
      >
        {(content) => <DockContent shape={content} doc={doc} />}
      </Capsule>
      {/* Measures the palette ahead, so it arrives folded to the band (MK-2 §2). */}
      <PaletteMeasurer />
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

/** The dock's resting items (F10 §2): Pages · Markup · Fill & sign · More, or Locked. */
function DockItems({ locked, doc }: { readonly locked: boolean; readonly doc: VirtualDocument }) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useSizeClass();
  const form = useLabelForm(ref, frame.size);
  const door = useUiStore((s) => s.docUi[doc.id]?.paletteSet ?? 'draw');
  const roving = useRovingTabindex(ref, '[data-dock-item="pages"]');
  // Re-render when commands register (Pages and More read them).
  useCommands();
  const empty = doc.pages.length === 0;
  const reason = empty ? m.dock_no_pages() : undefined;
  const compact = frame.size === 'compact';
  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label={m.dock_label()}
      aria-orientation="horizontal"
      className={styles.toolbar}
      data-labels={form}
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
            icon="pen-nib"
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
        </>
      )}
      <MoreMenu />
    </div>
  );
}

/**
 * The label form from the room the band leaves: measured with labels beside once per locale
 * (`dock-labels.ts`), the room from the band and the page pill, re-read on every resize.
 */
function useLabelForm(ref: RefObject<HTMLDivElement | null>, size: SizeClass): DockLabelForm {
  const locale = useLocale();
  const [beside, setBeside] = useState<{ readonly width: number; readonly locale: string } | null>(
    null,
  );
  const [room, setRoom] = useState(Number.POSITIVE_INFINITY);
  const form = dockLabelForm({
    size,
    besideWidth: beside?.locale === locale ? beside.width : null,
    room,
  });

  // While beside, keep the measured width current (the labels, the items or the font changed).
  useLayoutEffect(() => {
    const toolbar = ref.current;
    if (!toolbar || form !== 'beside' || size === 'compact') return;
    const record = () => {
      const width = toolbar.getBoundingClientRect().width;
      setBeside((was) =>
        was?.locale === locale && Math.abs(was.width - width) <= 0.5 ? was : { width, locale },
      );
    };
    record();
    const observer = new ResizeObserver(record);
    observer.observe(toolbar);
    return () => observer.disconnect();
  }, [ref, form, size, locale]);

  useLayoutEffect(() => {
    const band = ref.current?.closest<HTMLElement>('[data-frame-layer="band"]');
    if (!band) return;
    const measure = () => {
      const pill = band.querySelector<HTMLElement>('[data-region="pill"]');
      setRoom(dockRoom(band.clientWidth, pill?.offsetWidth ?? 0));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(band);
    const mutation = new MutationObserver(() => {
      const pill = band.querySelector('[data-region="pill"]');
      if (pill) observer.observe(pill);
      measure();
    });
    mutation.observe(band, { childList: true });
    const pill = band.querySelector('[data-region="pill"]');
    if (pill) observer.observe(pill);
    return () => {
      observer.disconnect();
      mutation.disconnect();
    };
  }, [ref]);

  return form;
}

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
  const button = (
    <button
      type="button"
      className={styles.item}
      data-capsule-item={item}
      data-dock-item={item}
      data-capsule-focus={focusOnArrival ? '' : undefined}
      aria-label={name}
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
      <span className={styles.label}>{label}</span>
    </button>
  );
  // The label is always shown (RA-20): a tooltip only adds the key or the reason (F10 §5).
  if (shortcut === undefined && reason === undefined) return button;
  return (
    <Tooltip label={label} shortcut={shortcut} reason={reason} side="top">
      {button}
    </Tooltip>
  );
}

/** More (flows §4.2): the rarer doors, each dimmed with its reason when it cannot run. */
const MORE_ITEMS: readonly { readonly id: string; readonly label: () => string }[] = [
  { id: 'tool.edit-text', label: m.dock_more_edit_text },
  { id: 'tool.redact', label: m.dock_more_redact },
  { id: 'document.ocr', label: m.dock_more_ocr },
  { id: 'mode.compare', label: m.dock_more_compare },
  { id: 'pages.crop', label: m.dock_more_crop },
];
const MORE_APP_ITEMS: readonly { readonly id: string; readonly label: () => string }[] = [
  { id: 'view.palette', label: m.dock_more_commands },
  { id: 'help.shortcuts', label: m.frame_keyboard_shortcuts },
  { id: 'settings.open', label: m.frame_settings },
];

function MoreMenu() {
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
  return (
    <Menu.Root>
      <Tooltip label={m.dock_more()} shortcut={shortcutOf('view.palette')} side="top">
        <Menu.Trigger
          ref={setTrigger}
          className={styles.item}
          data-capsule-item="more"
          data-dock-item="more"
        >
          <Icon name="dots-three" className={styles.icon} />
          <span className={styles.label}>{m.dock_more()}</span>
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
              <MoreItem key={item.id} id={item.id} label={item.label()} />
            ))}
            <Menu.Separator className={menuStyles.separator} />
            {MORE_APP_ITEMS.map((item) => (
              <MoreItem key={item.id} id={item.id} label={item.label()} />
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function MoreItem({ id, label }: { readonly id: string; readonly label: string }) {
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
      <span className={menuStyles.label}>{label}</span>
      {reason ? <span className={menuStyles.hint}>{reason}</span> : null}
    </Menu.Item>
  );
}

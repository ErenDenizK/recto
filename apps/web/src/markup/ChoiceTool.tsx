/**
 * A choice tool (`03-markup` MK-9, MK-12): one button for several kinds (Shapes ▾, Stamp ▾,
 * Sign ▾). "A second press opens choices" is the one rule: a press arms the kind it shows; a
 * press on it armed, ↑, a right-click or a long press opens its menu (M4, the menu recipe),
 * rising from the button. Choosing closes the menu, arms the kind, and gives focus back to
 * the button.
 *
 * The button is the palette's tool button: icon-only with no mark (the tooltip says "Press
 * again for choices"), or, labelled, with a 16 px caret after its name (system-audit §3.7);
 * `aria-pressed` while any of its kinds is armed and `aria-haspopup="menu"`.
 */
import { Menu } from '@base-ui/react/menu';
import { type ReactNode, useRef, useState } from 'react';

import menuStyles from '../ui/Menu.module.css';
import { LONG_PRESS_MS } from '../ui/IconButton';
import { abovePalette } from './anchor';
import { armedTooltip, PaletteButton } from './ToolButton';

export interface ChoiceToolProps {
  readonly label: string;
  /** The tooltip's name when it differs from the accessible name ("Shapes: Rectangle"). */
  readonly tooltip?: string | undefined;
  readonly icon: ReactNode;
  readonly armed: boolean;
  /** Arms the kind the button shows. Return false to open the menu instead (nothing to arm). */
  readonly onArm: () => boolean | undefined | Promise<unknown>;
  readonly command?: string | undefined;
  readonly item: string;
  readonly tool: string;
  readonly showLabel?: boolean | undefined;
  /** The menu's items: `Menu.Item`s with `menuStyles.item`. */
  readonly children: ReactNode;
}

export function ChoiceTool({
  label,
  tooltip,
  icon,
  armed,
  onArm,
  command,
  item,
  tool,
  showLabel,
  children,
}: ChoiceToolProps) {
  const [open, setOpen] = useState(false);
  const hold = useRef<number | undefined>(undefined);
  const held = useRef(false);
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
  return (
    <Menu.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
      }}
    >
      <PaletteButton
        ref={setTrigger}
        label={label}
        tooltip={armedTooltip(tooltip ?? label, armed, true)}
        icon={icon}
        command={command}
        showLabel={showLabel}
        tool={tool}
        item={item}
        aria-pressed={armed}
        aria-haspopup="menu"
        aria-expanded={open}
        caret={showLabel}
        onClick={() => {
          if (held.current) {
            held.current = false;
            return;
          }
          // The kind it shows arms first; a press on the armed kind opens the menu.
          if (armed || onArm() === false) setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowUp' || event.altKey || event.ctrlKey || event.metaKey) return;
          event.preventDefault();
          setOpen(true);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
        onPointerDown={(event) => {
          held.current = false;
          if (event.pointerType === 'mouse') return;
          window.clearTimeout(hold.current);
          hold.current = window.setTimeout(() => {
            held.current = true;
            setOpen(true);
          }, LONG_PRESS_MS);
        }}
        onPointerUp={() => window.clearTimeout(hold.current)}
        onPointerCancel={() => window.clearTimeout(hold.current)}
      />
      <Menu.Portal>
        <Menu.Positioner
          side="top"
          align="center"
          sideOffset={8}
          collisionPadding={8}
          anchor={abovePalette(() => trigger)}
        >
          <Menu.Popup
            className={menuStyles.popup}
            data-annotation-keep=""
            finalFocus={() => trigger}
          >
            {children}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

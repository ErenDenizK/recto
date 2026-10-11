/**
 * The compact edition's bottom sheet (ADR-0033 §2.3; the phone form of `07-sheets`, built
 * on Base UI's Drawer): it rises from the bottom over a scrim, takes focus, and closes with
 * Done, Esc, a tap on the scrim or a swipe down. The panel has its final size before it
 * moves and moves by `transform` only; the scrim is a separate element that fades (quality
 * bar Q-7). One glass surface, in today's menu tier.
 */
import { Drawer } from '@base-ui/react/drawer';
import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';

import { m } from '../../i18n';
import styles from './CompactSheet.module.css';
import { watchRelease } from './sheet-release';

/** How far the panel reaches below the window (`--bleed` in the stylesheet), px. */
const BLEED = 48;
import controls from './controls.module.css';

export function CompactSheet({
  open,
  onClose,
  title,
  size = 'auto',
  testId,
  initialFocus,
  children,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  /** `tall`: a fixed tall sheet whose body scrolls (Pages, Contents); `auto`: its content. */
  readonly size?: 'auto' | 'tall';
  readonly testId?: string;
  readonly initialFocus?: RefObject<HTMLElement | null>;
  readonly children: ReactNode;
}) {
  const [panel, setPanel] = useState<HTMLElement | null>(null);
  // Focus lands on a control, never on the panel itself: the panel would take the outset ring
  // after a key press, a dark 6 px band around the whole sheet (visual audit 2026-10 defect
  // 4). Done is every sheet's first control; a sheet with a field names it instead.
  const doneRef = useRef<HTMLButtonElement>(null);
  useEffect(() => (panel && open ? watchRelease(panel, BLEED) : undefined), [panel, open]);
  return (
    <Drawer.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Drawer.Portal>
        <Drawer.Backdrop className={styles.backdrop} />
        <Drawer.Viewport className={styles.viewport}>
          <Drawer.Popup
            ref={setPanel}
            className={styles.sheet}
            data-size={size}
            data-testid={testId}
            initialFocus={initialFocus ?? doneRef}
          >
            <div className={styles.handle} aria-hidden="true" />
            <div className={styles.header}>
              <Drawer.Title className={styles.title}>{title}</Drawer.Title>
              <Drawer.Close ref={doneRef} className={controls.text}>
                {m.compact_done()}
              </Drawer.Close>
            </div>
            <Drawer.Content className={styles.body}>{children}</Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/**
 * The phone's one sheet, its scrim form (DSN-53; ADR-0033 §2.3; the phone form of `07-sheets`,
 * built on Base UI's Drawer): Contents, Go to page, Document info, Settings, the password
 * prompt, a note and New signature. The tool drawer is its stays-open form, without a scrim
 * (`mark/ToolDrawer.tsx`); both take the shape of `sheet-shape.module.css`.
 *
 * - **Shape.** A floating glass object inset from the screen's edges, with the 28 px corners,
 *   a grabber, the title and a round close (no text Done).
 * - **Heights.** It opens at medium (`MEDIUM`, 56 % of the screen) when its content is taller,
 *   and pulls up to large (all of the screen under the status bar); content shorter than medium
 *   is the sheet's one height. A sheet with a footer (New signature) opens at large, so its
 *   primary is never below the screen's edge. Scrolling its body at medium, or moving focus by keys to a
 *   control below the screen's edge, takes it to large first, as iOS does.
 * - **Closing.** The close button, Esc (and Android's back, Base UI's close watcher), a tap on
 *   the scrim or a swipe down. A drag starts on the head, or on the body once it is scrolled
 *   to its top (Base UI arbitrates the scroll), so a swipe never fights the list inside it
 *   (iOS Safari) nor the detent drag.
 * - **Motion** (MOT-12): transform only, on the sheet spring; a release carries the finger's
 *   speed and the glass is solid while it moves (`sheet-release.ts`); the scrim fades. Reduced
 *   motion fades the sheet in place.
 * - **Focus.** It takes focus on its first control (the close, or a field it names) and gives
 *   it back to what opened it (`sheetOpener`): a menu row's menu has gone, so its trigger.
 * - **Semantics.** A modal `dialog` named by its title.
 */
import { Drawer } from '@base-ui/react/drawer';
import {
  type FocusEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';

import { m } from '../../i18n';
import { Icon } from '../../ui/Icon';
import { IconButton } from '../../ui/IconButton';
import styles from './CompactSheet.module.css';
import { sheetOpener } from './compact-store';
import { watchSheet } from './sheet-release';
import shape from './sheet-shape.module.css';

/** The medium detent, a fraction of the screen's height (iOS's medium is about half). */
export const MEDIUM = 0.56;
/** Large: the whole screen; the stylesheet's max height keeps it under the status bar. */
const LARGE = 1;
const DETENTS = [MEDIUM, LARGE];
/** The room under the sheet's foot, px: the island's own (`--sheet-foot` at its least). */
const FOOT = 12;

export interface CompactSheetBack {
  readonly label: string;
  readonly onPress: () => void;
}

export function CompactSheet({
  open,
  onClose,
  title,
  testId,
  initialFocus,
  back,
  footer,
  returnFocus = sheetOpener,
  children,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly testId?: string;
  readonly initialFocus?: RefObject<HTMLElement | null>;
  /** A page within the sheet (About within Settings): ‹ before the title goes back. */
  readonly back?: CompactSheetBack | undefined;
  /** What stays under the body while it scrolls (New signature's primary). */
  readonly footer?: ReactNode;
  /** What takes focus back as it closes: what opened it (`sheetOpener`), else Base UI's choice. */
  readonly returnFocus?: () => HTMLElement | null;
  readonly children: ReactNode;
}) {
  const [panel, setPanel] = useState<HTMLElement | null>(null);
  // A sheet with a footer (New signature's primary) opens at large, so its act shows at once;
  // every other opening starts at medium.
  const first = footer ? LARGE : MEDIUM;
  const [detent, setDetent] = useState<number | string | null>(first);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDetent(first);
  }
  // Focus lands on a control, never on the panel itself (visual audit 2026-10 defect 4).
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!panel) return;
    return watchSheet(
      panel,
      () => {
        const height = panel.offsetHeight;
        const medium = Math.min(height, MEDIUM * window.innerHeight);
        return height - medium > 1 ? [0, height - medium] : [0];
      },
      FOOT,
    );
  }, [panel]);
  const expand = () => {
    if (detent !== LARGE) setDetent(LARGE);
  };
  const onFocus = (event: FocusEvent<HTMLElement>) => {
    // A key moved focus below the screen's edge (the sheet at medium): large first.
    if (event.target.getBoundingClientRect().bottom > window.innerHeight) expand();
  };
  return (
    <Drawer.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      snapPoints={DETENTS}
      snapPoint={detent}
      onSnapPointChange={setDetent}
    >
      <Drawer.Portal>
        <Drawer.Backdrop className={styles.backdrop} />
        <Drawer.Viewport className={styles.viewport}>
          <Drawer.Popup
            ref={setPanel}
            className={`${shape.shape} ${styles.sheet}`}
            data-testid={testId}
            initialFocus={initialFocus ?? closeRef}
            finalFocus={() => {
              const opener = returnFocus();
              return opener?.isConnected ? opener : true;
            }}
            onFocus={onFocus}
          >
            <div className={shape.head}>
              <span className={shape.grabber} aria-hidden="true" />
              {back ? (
                <IconButton
                  label={back.label}
                  icon={<Icon name="caret-left" />}
                  className={styles.back}
                  data-testid="compact-sheet-back"
                  onClick={back.onPress}
                />
              ) : null}
              <Drawer.Title className={shape.title}>{title}</Drawer.Title>
              <IconButton
                ref={closeRef}
                label={m.common_close()}
                icon={<Icon name="x" />}
                className={shape.close}
                data-testid="compact-sheet-close"
                onClick={onClose}
              />
            </div>
            <Drawer.Content className={styles.body} onScrollCapture={expand}>
              {children}
            </Drawer.Content>
            {footer ? <div className={styles.footer}>{footer}</div> : null}
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

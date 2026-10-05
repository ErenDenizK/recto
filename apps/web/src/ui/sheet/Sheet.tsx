/**
 * The Sheet primitive, S0 (components/07-sheets.md §1–§2; ADR-0031 §2 item 7 as amended by
 * ADR-0033 §2.2; spec redesign D0-4): one container for every dialog, presented by kind and
 * size class (`presentation.ts`) as a side sheet, a form sheet, a centred dialog, a bottom
 * sheet with detents or a full sheet, with one header, body and footer.
 *
 * - **Kinds.** Tool sheets are non-modal: the page stays live and visible, focus is not
 *   trapped, there is no scrim and a press on the page leaves the sheet open. Task and
 *   Settings sheets are modal forms over a scrim; a press on the scrim closes them.
 *   Confirmations are `alertdialog`s whose scrim ignores presses (§2.6).
 * - **One at a time** (§1.1 rule 1): an opening sheet claims the front of `sheet-store`, and an
 *   open sheet that loses it closes; confirmations stack over the rest.
 * - **Nothing typed is lost.** Esc, ✕, the scrim and a swipe only close: the caller keeps its
 *   inputs in `useSheetDraft`, per document for the session, and `restored` announces "Your
 *   earlier settings are back" when they return (§2.5).
 * - **The body is a form.** Enter in a single-line field, a radio or a segment runs the
 *   enabled primary; never in a text area, a select or a menu, and Mod+Enter is not used
 *   (§2.6, spec 07.16).
 * - **Focus** (§2.6): on open the opener's control (`initialFocus`), else the first control;
 *   on close back to the invoker (Base UI), or `finalFocus`. Modal sheets trap Tab.
 * - **Motion** is `sheet-motion.ts`: the panel has its final size before it moves and moves
 *   by `transform` only, on the motion core, with a swipe's velocity handed to the spring; the
 *   scrim is its own element and fades (quality-bar Q-7). The exiting panel is `inert` from its
 *   first frame (A-13).
 * - **Glass** (§3): one surface, today's menu tier (`glass glass-menu`), registered in
 *   `styles/coverage-registry.ts` per presentation; M5's own values arrive in D3. Inputs and
 *   lists inside are solid wells, never glass (Q-4).
 *
 * Base UI's Dialog carries every presentation (AlertDialog's root for confirmations). Its
 * Drawer is not used: its swipe and snap points run on CSS transitions with their own
 * physics, which cannot hand a release's velocity to the motion core's springs (Q-7).
 */
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Dialog } from '@base-ui/react/dialog';
import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
} from 'react';

import { m } from '../../i18n';
import { announce } from '../../shell/announcer';
import { useSizeClass } from '../../shell/frame/size-class';
import { Button } from '../Button';
import { LockBanner } from './LockBanner';
import { presentationOf, type SheetKind } from './presentation';
import styles from './Sheet.module.css';
import { createSheetMotion, type SheetMotion } from './sheet-motion';
import { SheetFooter } from './SheetFooter';
import { SheetHeader } from './SheetHeader';
import { claimFront, releaseFront, useSheetStore } from './sheet-store';

/** Why a sheet closes. Every one of them keeps the draft. */
export type SheetCloseReason = 'escape' | 'close' | 'cancel' | 'scrim' | 'swipe' | 'replaced';

export interface SheetPrimary {
  readonly label: string;
  /** Runs on a press and on Enter from the body (§2.6). */
  readonly onPress: () => void;
  readonly disabled?: boolean;
  /** Why it is disabled: a reason line above the footer and its description (RA-21). */
  readonly reason?: string | undefined;
  readonly busy?: boolean;
  readonly busyLabel?: string | undefined;
  /** A destructive act: the danger label on the standard fill, never lime (§2.4, §27.14). */
  readonly danger?: boolean;
  readonly icon?: ReactNode;
}

export interface SheetProps {
  /** Stable id: the one-at-a-time rule and drafts key on it. */
  readonly id: string;
  readonly kind: SheetKind;
  readonly open: boolean;
  readonly onClose: (reason: SheetCloseReason) => void;
  readonly title: string;
  /** Under the title (footnote); a confirmation's body text. The dialog's description. */
  readonly description?: ReactNode;
  /** A short line under the title that is not the description ("1 of 3"). */
  readonly subtitle?: string | undefined;
  /** A modal sheet bound to a document that is not the active tab shows "· report.pdf". */
  readonly docName?: string | undefined;
  readonly primary?: SheetPrimary | undefined;
  /** Cancel's label in the footer; false leaves it out. Defaults to Cancel beside a primary. */
  readonly cancel?: string | false;
  /** Leading in the footer: Reset or a secondary action. */
  readonly secondary?: ReactNode;
  /** ✕'s name (default "Close"). */
  readonly closeLabel?: string;
  /** A pushed page: ‹ Back in the header. */
  readonly back?: (() => void) | undefined;
  readonly locked?: { readonly name: string; readonly onUnlock: () => void } | undefined;
  /** The draft came back from an earlier visit: announce it once on open. */
  readonly restored?: boolean;
  /** `primary` or `cancel` focus that button on open; a ref focuses that element. */
  readonly initialFocus?: RefObject<HTMLElement | null> | 'primary' | 'cancel' | undefined;
  readonly finalFocus?: RefObject<HTMLElement | null> | undefined;
  /** A line in the footer's place when there is no action (the shortcuts overlay's note). */
  readonly footnote?: ReactNode;
  readonly testId?: string | undefined;
  readonly children?: ReactNode;
}

export function Sheet({
  id,
  kind,
  open,
  onClose,
  title,
  description,
  subtitle,
  docName,
  primary,
  cancel,
  secondary,
  closeLabel,
  back,
  locked,
  restored = false,
  initialFocus,
  finalFocus,
  footnote,
  testId,
  children,
}: SheetProps) {
  const frame = useSizeClass();
  const layout = presentationOf(kind, frame);
  const formId = useId();
  const primaryRef = useRef<HTMLButtonElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  // The latest props for the handlers the motion and Base UI keep.
  const onCloseRef = useRef(onClose);
  const openRef = useRef(open);
  const layoutRef = useRef(layout);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
    openRef.current = open;
    layoutRef.current = layout;
  });
  // Created on first use, outside render.
  const motionRef = useRef<SheetMotion | null>(null);
  const motionOf = (): SheetMotion => {
    motionRef.current ??= createSheetMotion(() => onCloseRef.current('swipe'));
    return motionRef.current;
  };

  // The panel enters as soon as it is in the document (the portal may mount it a render after
  // `open` turns true) and leaves when `open` turns false; both retarget from where it is.
  const panelRef = useCallback((el: HTMLDivElement | null) => {
    const motion = motionOf();
    motion.attach(el);
    if (el && openRef.current) {
      motion.setLayout(layoutRef.current);
      motion.enter();
    }
  }, []);
  useLayoutEffect(() => {
    motionOf().setLayout(layout);
  });
  useLayoutEffect(() => {
    if (open) motionOf().enter();
    else motionOf().exit();
  }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const onResize = () => motionOf().relayout();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open]);

  // One sheet at a time (§1.1 rule 1); confirmations stack.
  const front = useSheetStore((s) => s.front);
  useEffect(() => {
    if (!open || kind === 'confirmation') return undefined;
    claimFront(id);
    return () => releaseFront(id);
  }, [open, id, kind]);
  useEffect(() => {
    if (open && kind !== 'confirmation' && front !== null && front !== id) {
      onCloseRef.current('replaced');
    }
  }, [front, open, id, kind]);

  useEffect(() => {
    if (open && restored) announce(m.sheet_draft_restored());
  }, [open, restored]);

  const unavailable = !primary || primary.disabled === true || primary.busy === true || !!locked;
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (!unavailable) primary.onPress();
  };
  // Enter from a radio or a segment submits too (§2.6); fields submit natively.
  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Enter' || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as Element;
    if (target.matches('[role="radio"], input[type="radio"], [data-segment]')) {
      event.preventDefault();
      event.currentTarget.requestSubmit();
    }
  };

  const compactTool = kind === 'tool' && layout.presentation === 'bottom';
  const confirmation = kind === 'confirmation';
  const cancelLabel =
    cancel === false ? null : (cancel ?? (primary && !compactTool ? m.sheet_cancel() : null));

  const primaryButton = primary ? (
    <Button
      ref={primaryRef}
      type="submit"
      form={formId}
      variant={primary.danger ? 'danger' : 'prominent'}
      icon={primary.icon}
      disabled={primary.disabled === true && !locked}
      reason={primary.reason}
      busy={primary.busy === true}
      busyLabel={primary.busyLabel}
      blocked={locked ? { reason: m.sheet_locked_reason(), onPress: locked.onUnlock } : undefined}
      data-sheet-primary=""
    >
      {locked ? m.sheet_locked_reason() : primary.label}
    </Button>
  ) : null;

  const focusOnOpen =
    initialFocus === 'primary' ? primaryRef : initialFocus === 'cancel' ? cancelRef : initialFocus;

  const Root = layout.role === 'alertdialog' ? AlertDialog.Root : Dialog.Root;
  const style = {
    '--sheet-w': layout.width === null ? '100%' : `${layout.width}px`,
  } as CSSProperties;
  const heading = docName ? m.sheet_bound_title({ title, name: docName }) : title;
  const centred = layout.presentation === 'dialog';

  return (
    <Root
      open={open}
      modal={layout.modal}
      // A tool sheet stays open while the page is used; a confirmation ignores the scrim.
      {...(layout.role === 'dialog' ? { disablePointerDismissal: !layout.modal } : {})}
      onOpenChange={(next, details) => {
        if (next) return;
        const reason = details.reason;
        onCloseRef.current(
          reason === 'escape-key' ? 'escape' : reason === 'outside-press' ? 'scrim' : 'close',
        );
      }}
    >
      <Dialog.Portal>
        {layout.scrim ? (
          <Dialog.Backdrop className={styles.scrim} data-presentation={layout.presentation} />
        ) : null}
        <Dialog.Popup
          ref={panelRef}
          className={styles.panel}
          style={style}
          data-presentation={layout.presentation}
          data-kind={kind}
          data-sheet={id}
          data-testid={testId}
          data-swipe={layout.swipe ?? undefined}
          inert={!open || undefined}
          {...(focusOnOpen ? { initialFocus: focusOnOpen } : {})}
          {...(finalFocus ? { finalFocus } : {})}
          onPointerDown={(event) => motionOf().pointer.onPointerDown(event.nativeEvent)}
          onPointerMove={(event) => motionOf().pointer.onPointerMove(event.nativeEvent)}
          onPointerUp={(event) => motionOf().pointer.onPointerUp(event.nativeEvent)}
          onPointerCancel={(event) => motionOf().pointer.onPointerCancel(event.nativeEvent)}
          onClickCapture={(event) => motionOf().pointer.onClickCapture(event.nativeEvent)}
        >
          {layout.presentation === 'bottom' ? (
            <div className={styles.grabber} data-sheet-handle="" aria-hidden="true">
              <span className={styles.grabberBar} />
            </div>
          ) : null}
          {confirmation && centred ? (
            <div className={styles.dialogHeading}>
              <Dialog.Title className={styles.dialogTitle}>{heading}</Dialog.Title>
              {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
            </div>
          ) : (
            <SheetHeader
              title={heading}
              description={confirmation ? undefined : description}
              subtitle={subtitle}
              back={back}
              closeLabel={confirmation ? null : (closeLabel ?? m.sheet_close())}
              onClose={() => onCloseRef.current('close')}
              trailing={compactTool ? primaryButton : undefined}
              handle={layout.swipe !== null}
            />
          )}
          {locked ? <LockBanner name={locked.name} onUnlock={locked.onUnlock} /> : null}
          {/* The form only routes Enter from radios and segments to its submit (07 §2.6). */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
          <form
            id={formId}
            className={styles.form}
            noValidate
            onSubmit={submit}
            onKeyDown={onKeyDown}
          >
            <div className={styles.body} data-sheet-body="">
              {confirmation && description ? (
                <Dialog.Description className={styles.dialogBody}>{description}</Dialog.Description>
              ) : null}
              {children}
            </div>
            {primary?.disabled && primary.reason && !locked ? (
              <p className={styles.reason} aria-hidden="true">
                {primary.reason}
              </p>
            ) : null}
            {primaryButton && !compactTool ? (
              <SheetFooter
                secondary={secondary}
                cancel={
                  cancelLabel === null ? null : (
                    <Button
                      ref={cancelRef}
                      variant="standard"
                      onClick={() => onCloseRef.current('cancel')}
                    >
                      {cancelLabel}
                    </Button>
                  )
                }
                primary={primaryButton}
                fill={layout.presentation === 'bottom' && confirmation}
              />
            ) : footnote ? (
              <p className={styles.footnote}>{footnote}</p>
            ) : null}
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Root>
  );
}

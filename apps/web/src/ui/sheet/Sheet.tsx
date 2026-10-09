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
 * - **Focus** (§2.6): on open the opener's control (`initialFocus`), else the first field; but
 *   opened by a pointer or a finger, the panel itself instead of a field, so no ring lights
 *   and no keyboard rises (`ui/initial-focus.ts`, system-audit-2026-10 §3.8); on close back to
 *   the invoker (Base UI), or `finalFocus`. Modal sheets trap Tab.
 * - **Motion** is `sheet-motion.ts`: the panel has its final size before it moves and moves
 *   by `transform` only, on the motion core, with a swipe's velocity handed to the spring; the
 *   scrim is its own element and fades (quality-bar Q-7). The exiting panel is `inert` from its
 *   first frame (A-13). A menu still closing when a sheet opens goes at once
 *   (`ui/menu-handoff.ts`), so the two never show through each other.
 * - **Glass** (§3): one surface, M5 (`mat mat-sheet`, materials.css), registered in
 *   `styles/coverage-registry.ts` per presentation. Inputs and
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
import { usePointerCapabilities } from '../../shell/frame/input-modality';
import { useSizeClass } from '../../shell/frame/size-class';
import { Button } from '../Button';
import { closeMenusAtOnce } from '../menu-handoff';
import { LockBanner } from './LockBanner';
import { type OpenType, resolveInitialFocus } from '../initial-focus';
import { snapToWholePixels } from '../whole-pixels';
import { presentationOf, type SheetKind } from './presentation';
import styles from './Sheet.module.css';
import { createSheetMotion, type SheetMotion } from './sheet-motion';
import { SheetFooter } from './SheetFooter';
import { SheetHeader } from './SheetHeader';
import { claimFront, releaseFront, useSheetStore } from './sheet-store';

/**
 * Starts following a swipe that may begin with `down`: its moves, release and cancel come from
 * the window until the pointer is released, wherever it goes.
 */
function followSwipe(motion: SheetMotion, down: PointerEvent): void {
  if (!motion.pointer.onPointerDown(down)) return;
  const id = down.pointerId;
  const move = (event: PointerEvent) => {
    if (event.pointerId === id) motion.pointer.onPointerMove(event);
  };
  const end = (event: PointerEvent) => {
    if (event.pointerId !== id) return;
    if (event.type === 'pointercancel') motion.pointer.onPointerCancel(event);
    else motion.pointer.onPointerUp(event);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
  };
  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
}

/** Why a sheet closes. Every one of them keeps the draft. */
export type SheetCloseReason = 'escape' | 'close' | 'cancel' | 'scrim' | 'swipe' | 'replaced';

export interface SheetPrimary {
  readonly label: string;
  /** Runs on a press and on Enter from the body (§2.6). */
  readonly onPress: () => void;
  readonly disabled?: boolean;
  /** Why it is disabled: a reason line above the footer and its description (RA-21). */
  readonly reason?: string | undefined;
  /**
   * The reason line keeps its room, unseen, while the primary is enabled, so a sheet whose
   * primary turns on and off keeps its size (quality-bar Q-7; New signature).
   */
  readonly reasonRoom?: boolean;
  readonly busy?: boolean;
  readonly busyLabel?: string | undefined;
  /** A destructive act: the danger label on the standard fill, never lime (§2.4, §27.14). */
  readonly danger?: boolean;
  readonly icon?: ReactNode;
  /** `data-testid` on the button, for a sheet whose tests name its act. */
  readonly testId?: string | undefined;
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
  const pointer = usePointerCapabilities().primary === 'coarse' ? 'coarse' : 'fine';
  const layout = presentationOf(kind, frame, pointer);
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
  const panelEl = useRef<HTMLDivElement | null>(null);
  const snapped = useRef<{ el: HTMLElement; dispose: () => void } | null>(null);
  /** Keeps a centred panel on whole pixels (the layout effect below says why). */
  const snapCentred = (el: HTMLElement | null, presentation: string | null) => {
    const target = el && (presentation === 'form' || presentation === 'dialog') ? el : null;
    if (snapped.current?.el === target) return;
    snapped.current?.dispose();
    snapped.current = null;
    if (!target) return;
    const root = document.documentElement;
    const width = snapToWholePixels(target, 'width', { container: () => root.clientWidth });
    const height = snapToWholePixels(target, 'height', { container: () => root.clientHeight });
    snapped.current = {
      el: target,
      dispose: () => {
        width();
        height();
      },
    };
  };
  const panelRef = useCallback((el: HTMLDivElement | null) => {
    panelEl.current = el;
    snapCentred(el, layoutRef.current.presentation);
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
  // A form sheet or a centred dialog is centred by auto margins, so its content's fractional
  // height put it between pixels (y 174.09): its size rounds so it rests on whole pixels (Q-2).
  // Followed from the ref (the portal may mount the panel without this component rendering)
  // and from each render (the presentation changes with the window).
  useLayoutEffect(() => {
    snapCentred(panelEl.current, layout.presentation);
  });
  useEffect(() => () => snapCentred(null, null), []);
  useLayoutEffect(() => {
    if (open) {
      // A menu whose item opened this sheet goes at once, never over the entrance (Q-7).
      closeMenusAtOnce();
      motionOf().enter();
    } else motionOf().exit();
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
    // The store's front, not this render's: the claim above has just run in this commit, so
    // a sheet reopened while the one that replaced it is still closing (Settings → New
    // signature → Settings) does not read the old front and close itself.
    const current = useSheetStore.getState().front;
    if (open && kind !== 'confirmation' && current !== null && current !== id) {
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
      data-testid={primary.testId}
    >
      {locked ? m.sheet_locked_reason() : primary.label}
    </Button>
  ) : null;

  // §2.6: the opener's control, else the first control that needs input, else the first one;
  // a field gives way to the panel when a pointer opened the sheet (system audit §3.8).
  const firstInput = (): HTMLElement | true =>
    panelEl.current?.querySelector<HTMLElement>(
      '[data-sheet-body] :is(input:not([type="hidden"], [aria-hidden="true"], :disabled), textarea, select)',
    ) ?? true;
  const focusOnOpen = (openType: OpenType) =>
    resolveInitialFocus(
      initialFocus === 'primary'
        ? primaryRef
        : initialFocus === 'cancel'
          ? cancelRef
          : (initialFocus ?? firstInput),
      openType,
      panelEl.current,
    );

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
          <Dialog.Backdrop
            className={styles.scrim}
            data-presentation={layout.presentation}
            data-scrim=""
          />
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
          initialFocus={focusOnOpen}
          {...(finalFocus ? { finalFocus } : {})}
          onPointerDown={(event) => followSwipe(motionOf(), event.nativeEvent)}
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
            {primary?.reason && !locked && (primary.disabled || primary.reasonRoom) ? (
              <p
                className={styles.reason}
                aria-hidden="true"
                data-idle={primary.disabled ? undefined : ''}
              >
                {primary.reason}
              </p>
            ) : null}
            {compactTool && secondary ? (
              <SheetFooter secondary={secondary} />
            ) : primaryButton && !compactTool ? (
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

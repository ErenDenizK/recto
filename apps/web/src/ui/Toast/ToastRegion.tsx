/**
 * The toast region (`08-feedback` FB4 §2, §4, §6–§8; spec redesign X14, X9; 01-frame F13; A-13,
 * A-14, A-24): our own region on `toast-store.ts`, about two hundred lines, in place of Base
 * UI's toast viewport, whose live region, dialog roles and global F6 binding each fought a rule
 * here.
 *
 * - **Silent.** `role="region"` named "Notifications", not live: `toast.ts` says each toast
 *   once through the announcer. Each toast is a `role="group"` named by its text.
 * - **Never takes focus.** F6 reaches it as the last stop of the cycle
 *   (`shell/LeftRail.regions.ts`, landing on the newest toast's action); Up and Down move
 *   between toasts; Esc dismisses the focused one; after an action or a dismissal focus goes
 *   back to where it was before F6, else the page.
 * - **Holds** (A-24): hover, focus within, a pointer down on a toast, a hidden tab and an open
 *   modal pause every timer, which then resumes with what was left.
 * - **Motion** (FB4 §7; Q-2, Q-3, Q-10): *toast* in, 16 px up and a fade on `quick`; the stack
 *   re-flows by FLIP on `smooth`; out by a fade on `track` (about 120 ms), `inert` from its
 *   first frame (A-13); a swipe (touch, pen) past half the width or faster than 800 px/s
 *   flings it away, else it springs back. Each animation moves the toast's own element, is
 *   interruptible from where it is, and leaves no transform or `will-change` behind.
 * - **Both editions**: the compact edition passes `edition="compact"` and whether its capsule
 *   is on screen (`band`), so the stack sits above the capsule or the home indicator.
 */
import { CheckCircle2, RefreshCw, TriangleAlert, X, XCircle } from 'lucide-react';
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';

import { m } from '../../i18n';
import { animateStyle, flip, type Motion, velocityTracker } from '../../motion';
import { Button } from '../Button';
import { IconButton } from '../IconButton';
import { ProgressCapsule } from './ProgressCapsule';
import styles from './Toast.module.css';
import { dismissToast, setToastPause, type Toast, useToastStore } from './toast-store';

/** A rendered toast: the store's, or one on its way out. */
interface Item {
  readonly toast: Toast;
  readonly leaving: boolean;
}

/** FB4 §6 (MC-31): a swipe dismisses past half the width or above this speed. */
const FLING_PX_PER_S = 800;

/** The store's toasts merged into what is on screen: kept in place, gone ones leaving. */
function merge(items: readonly Item[], shown: readonly Toast[]): Item[] {
  const byId = new Map(shown.map((t) => [t.id, t]));
  const next = items.map((item) => {
    const now = byId.get(item.toast.id);
    return now ? { toast: now, leaving: false } : { toast: item.toast, leaving: true };
  });
  for (const toast of shown) {
    if (!items.some((item) => item.toast.id === toast.id)) next.push({ toast, leaving: false });
  }
  return next;
}

/** Where focus goes when the toast holding it leaves: before F6, else the page. */
let returnTo: HTMLElement | null = null;

function restoreFocus(region: HTMLElement | null): void {
  if (!region?.contains(document.activeElement)) return;
  const back =
    returnTo?.isConnected && !region.contains(returnTo)
      ? returnTo
      : document.querySelector<HTMLElement>('[data-read-viewport]');
  if (back) back.focus();
  else (document.activeElement as HTMLElement | null)?.blur();
}

/** Pauses while the tab is hidden or a modal dialog is open (FB4 §4). */
function useEnvironmentPauses(): void {
  useEffect(() => {
    const hidden = () => setToastPause('hidden', document.visibilityState === 'hidden');
    let queued = false;
    const modal = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        setToastPause(
          'modal',
          document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"]') !==
            null,
        );
      });
    };
    hidden();
    modal();
    document.addEventListener('visibilitychange', hidden);
    const observer = new MutationObserver(modal);
    observer.observe(document.body, { childList: true });
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      observer.disconnect();
      for (const reason of ['hidden', 'modal', 'hover', 'focus', 'pointer'] as const) {
        setToastPause(reason, false);
      }
    };
  }, []);
}

export interface ToastRegionProps {
  readonly edition?: 'full' | 'compact';
  /** The compact edition: whether the capsule the stack sits above is on screen. */
  readonly band?: 'shown' | 'away';
}

export function ToastRegion({ edition = 'full', band = 'shown' }: ToastRegionProps) {
  const shown = useToastStore((s) => s.shown);
  const waiting = useToastStore((s) => s.waiting.length);
  const [items, setItems] = useState<Item[]>(() => merge([], shown));
  const region = useRef<HTMLElement>(null);
  const elements = useRef(new Map<string, HTMLElement>());
  useEnvironmentPauses();

  // Store changes re-flow the stack by FLIP: measured before React commits, played after.
  useLayoutEffect(
    () =>
      useToastStore.subscribe((state, previous) => {
        if (state.shown === previous.shown) return;
        void flip(elements.current.values(), () =>
          flushSync(() => setItems((current) => merge(current, state.shown))),
        );
      }),
    [],
  );
  // A store change made before the subscription (the first render) still lands.
  if (items.length === 0 && shown.length > 0) setItems(merge([], shown));

  const exited = (id: string) => {
    void flip(
      [...elements.current].filter(([key]) => key !== id).map(([, el]) => el),
      () => flushSync(() => setItems((current) => current.filter((i) => i.toast.id !== id))),
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const toast = (event.target as Element).closest<HTMLElement>('[data-toast-id]');
    if (!toast) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      restoreFocus(region.current);
      dismissToast(toast.dataset.toastId as string, 'dismissed');
      return;
    }
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    const all = [...(region.current?.querySelectorAll<HTMLElement>('[data-toast-id]') ?? [])];
    const next = all[all.indexOf(toast) + (event.key === 'ArrowUp' ? -1 : 1)];
    const target = next?.querySelector<HTMLElement>('button:not([tabindex="-1"])');
    if (target) {
      event.preventDefault();
      target.focus();
    }
  };

  const newest = items.findLast((item) => !item.leaving)?.toast.id;
  const top = items.find((item) => !item.leaving)?.toast.id;
  return (
    // The region hosts its toasts' keys (Esc, Up, Down) and the focus hold; the controls inside
    // are the interactive elements, the region only listens to what bubbles from them.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <section
      ref={region}
      className={styles.region}
      aria-label={m.toast_region()}
      data-region="toasts"
      data-edition={edition}
      data-band={band}
      onKeyDown={onKeyDown}
      onFocus={(event) => {
        const from = event.relatedTarget as HTMLElement | null;
        if (from && !event.currentTarget.contains(from)) returnTo = from;
        setToastPause('focus', true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setToastPause('focus', false);
        }
      }}
    >
      {items.map(({ toast, leaving }) => (
        <ToastView
          key={toast.id}
          toast={toast}
          leaving={leaving}
          newest={toast.id === newest}
          waiting={toast.id === top ? waiting : 0}
          register={(el) => {
            if (el) elements.current.set(toast.id, el);
            else elements.current.delete(toast.id);
          }}
          onExited={() => exited(toast.id)}
          onDone={(reason) => {
            restoreFocus(region.current);
            dismissToast(toast.id, reason);
          }}
        />
      ))}
    </section>
  );
}

function glyphOf(toast: Toast): ReactNode {
  switch (toast.kind) {
    case 'success':
      return <CheckCircle2 className={styles.glyph} data-tone="success" aria-hidden="true" />;
    case 'failure':
      return toast.tone === 'warning' ? (
        <TriangleAlert className={styles.glyph} data-tone="warning" aria-hidden="true" />
      ) : (
        <XCircle className={styles.glyph} data-tone="danger" aria-hidden="true" />
      );
    case 'system':
      return <RefreshCw className={styles.glyph} aria-hidden="true" />;
    default:
      return null;
  }
}

interface ToastViewProps {
  readonly toast: Toast;
  readonly leaving: boolean;
  readonly newest: boolean;
  readonly waiting: number;
  readonly register: (el: HTMLElement | null) => void;
  readonly onExited: () => void;
  readonly onDone: (reason: 'dismissed' | 'action') => void;
}

function ToastView({
  toast,
  leaving,
  newest,
  waiting,
  register,
  onExited,
  onDone,
}: ToastViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const fade = useRef<Motion | null>(null);
  const hovered = useRef(false);
  const swipe = useRef<{ x: number; id: number; track: ReturnType<typeof velocityTracker> } | null>(
    null,
  );

  // The latest callbacks, so the motion effects below run on their own changes only.
  const callbacks = useRef({ register, onExited });
  useLayoutEffect(() => {
    callbacks.current = { register, onExited };
  });

  // *toast* in: 16 px up and a fade, on the element itself (Q-3).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    callbacks.current.register(el);
    animateStyle(el, 'transform', [0, 16], [0, 0], { spring: 'quick' });
    fade.current = animateStyle(el, 'opacity', 0, 1, { spring: 'quick' });
    return () => {
      callbacks.current.register(null);
      if (hovered.current) setToastPause('hover', false);
    };
  }, []);

  // Out: inert at once (A-13), a fade from wherever the entrance is, then gone.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!leaving || !el) return;
    if (hovered.current) {
      hovered.current = false;
      setToastPause('hover', false);
    }
    let gone = false;
    const done = () => {
      if (gone) return;
      gone = true;
      callbacks.current.onExited();
    };
    const from = fade.current?.value ?? 1;
    fade.current = animateStyle(el, 'opacity', from, 0, {
      spring: 'track',
      keep: true,
      onComplete: done,
    });
    // Already transparent: nothing to fade.
    if (from <= 0) done();
  }, [leaving]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    setToastPause('pointer', true);
    const release = () => setToastPause('pointer', false);
    window.addEventListener('pointerup', release, { once: true });
    window.addEventListener('pointercancel', release, { once: true });
    if (event.pointerType === 'mouse' || (event.target as Element).closest('button')) return;
    const track = velocityTracker();
    track.add(event.timeStamp, event.clientX, event.clientY);
    swipe.current = { x: event.clientX, id: event.pointerId, track };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const s = swipe.current;
    if (s?.id !== event.pointerId || !ref.current) return;
    s.track.add(event.timeStamp, event.clientX, event.clientY);
    // Direct manipulation: 1:1 under the finger.
    ref.current.style.transform = `translateX(${Math.round(event.clientX - s.x)}px)`;
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const s = swipe.current;
    const el = ref.current;
    swipe.current = null;
    if (s?.id !== event.pointerId || !el) return;
    const dx = event.clientX - s.x;
    const velocity = s.track.velocity(event.timeStamp).x;
    el.style.removeProperty('transform');
    const width = el.getBoundingClientRect().width;
    if (Math.abs(dx) > width / 2 || Math.abs(velocity) > FLING_PX_PER_S) {
      const away = Math.sign(dx || velocity) * width;
      animateStyle(el, 'transform', [dx, 0], [away, 0], {
        spring: 'fling',
        velocity: [velocity, 0],
        keep: true,
      });
      onDone('dismissed');
    } else {
      animateStyle(el, 'transform', [dx, 0], [0, 0], { spring: 'fling', velocity: [velocity, 0] });
    }
  };

  const dismissible = toast.kind !== 'system' && toast.kind !== 'progress';
  const run = (action: NonNullable<Toast['action']>) => {
    action.run();
    if (!action.keepOpen) onDone('action');
  };
  return (
    <div
      ref={ref}
      className={styles.toast}
      role="group"
      aria-label={toast.text}
      data-bar="toast"
      data-kind={toast.kind}
      data-toast-id={toast.id}
      data-toast-newest={newest || undefined}
      data-testid={toast.testId ?? 'toast'}
      inert={leaving}
      onPointerEnter={() => {
        hovered.current = true;
        setToastPause('hover', true);
      }}
      onPointerLeave={() => {
        hovered.current = false;
        setToastPause('hover', false);
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {toast.kind === 'progress' && toast.jobId !== undefined ? (
        <ProgressCapsule jobId={toast.jobId} />
      ) : (
        <>
          {glyphOf(toast)}
          <div className={styles.body}>
            <p className={styles.text}>{toast.text}</p>
            {toast.detail ? <p className={styles.detail}>{toast.detail}</p> : null}
          </div>
          {waiting > 0 ? (
            <span className={styles.waiting}>{m.toast_waiting({ count: String(waiting) })}</span>
          ) : null}
          {toast.action || toast.secondary ? (
            <span className={styles.actions}>
              {toast.secondary ? (
                <Button
                  variant="quiet"
                  onClick={() => run(toast.secondary as Toast['action'] & {})}
                >
                  {toast.secondary.label}
                </Button>
              ) : null}
              {toast.action ? (
                <Button
                  variant={toast.kind === 'system' ? 'prominent' : 'standard'}
                  data-toast-action=""
                  onClick={() => run(toast.action as Toast['action'] & {})}
                >
                  {toast.action.label}
                </Button>
              ) : null}
            </span>
          ) : null}
          {dismissible ? (
            <IconButton
              label={m.toast_dismiss()}
              icon={<X />}
              className={styles.close}
              tooltipSide="top"
              onClick={() => onDone('dismissed')}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

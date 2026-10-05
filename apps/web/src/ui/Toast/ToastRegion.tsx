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
 * - **Motion** (FB4 §7; Q-2, Q-3, Q-6, Q-10; `stack-motion.ts`): the stack makes room first,
 *   re-flowing by a translate-only FLIP on `quick`, and a new toast rises 16 px and fades in on
 *   `quick` once the toast above it is far enough ahead that the two pills never meet; out by
 *   a fade on `track` (about 120 ms), `inert` from its first frame (A-13), and only then does
 *   the stack close up. Each fade carries the glass's backdrop filter with the opacity, so a
 *   fading toast never leaves a dark empty pill. A toast's width is its own, so nothing ever
 *   tweens a width. A swipe (touch, pen) past half the width or faster than 800 px/s flings it
 *   away, else it springs back. Each animation moves the toast's own element (the glass, never
 *   a wrapper), is interruptible from where it is, and leaves no transform or `will-change`.
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
import { animateStyle, type Motion, velocityTracker } from '../../motion';
import { Button } from '../Button';
import { IconButton } from '../IconButton';
import { ProgressCapsule } from './ProgressCapsule';
import { after, entranceDelay, fadeBackdrop, RISE_PX, reflow } from './stack-motion';
import styles from './Toast.module.css';
import { dismissToast, setToastPause, type Toast, useToastStore } from './toast-store';

/** A rendered toast: the store's, or one on its way out. */
interface Item {
  readonly toast: Toast;
  readonly leaving: boolean;
}

/** A toast on screen as the region drives it: its glass element and its entrance. */
interface View {
  readonly el: HTMLElement;
  /** Whether its entrance has begun (a held or waiting toast is hidden, 16 px down). */
  readonly entered: () => boolean;
  /** Holds a toast whose entrance has not begun: it waits for the region's next word. */
  readonly hold: () => void;
  /** Starts the entrance after `delay` ms on the animation timeline, unless it has begun. */
  readonly enter: (delay: number) => void;
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
  const views = useRef(new Map<string, View>());
  // Toasts whose entrance waits for the stack to make room (set while a change commits).
  const held = useRef(new Set<string>());
  useEnvironmentPauses();

  /**
   * Re-flows the stack around `mutate` (a React update, applied in `flushSync`): measured before
   * React commits, played after. Toasts not yet in (the new ones, and any still waiting from an
   * earlier change, which wait again) are hidden and take no part in the re-flow; each then
   * comes in once the toast above it has made room (FB4 §7), and never before a toast above it
   * that is still to come in (the same rise, started later, stays clear of it).
   */
  const restack = (mutate: () => void, gone?: HTMLElement) => {
    const waiting = new Set<HTMLElement>();
    for (const view of views.current.values()) {
      if (view.entered()) continue;
      view.hold();
      waiting.add(view.el);
    }
    const moves = reflow(
      [...views.current.values()].map((v) => v.el).filter((el) => el !== gone && !waiting.has(el)),
      () => flushSync(mutate),
    );
    held.current.clear();
    const delays = new Map<Element, number>();
    for (const el of region.current?.children ?? []) {
      const view = [...views.current.values()].find((v) => v.el === el);
      if (!view || view.entered()) continue;
      const above = el.previousElementSibling;
      const slotTop = el.getBoundingClientRect().top - RISE_PX;
      const delay =
        above && delays.has(above)
          ? (delays.get(above) as number)
          : entranceDelay(slotTop, above ? moves.get(above as HTMLElement) : undefined);
      delays.set(el, delay);
      view.enter(delay);
    }
  };

  // Store changes re-flow the stack; a new toast mounts held (`held`) until `restack` lets it in.
  useLayoutEffect(
    () =>
      useToastStore.subscribe((state, previous) => {
        if (state.shown === previous.shown) return;
        for (const t of state.shown) if (!views.current.has(t.id)) held.current.add(t.id);
        restack(() => setItems((current) => merge(current, state.shown)));
      }),
    [],
  );
  // A store change made before the subscription (the first render) still lands.
  if (items.length === 0 && shown.length > 0) setItems(merge([], shown));

  // A toast has faded out: it goes, and the stack closes up behind it.
  const exited = (id: string) => {
    restack(
      () => setItems((current) => current.filter((i) => i.toast.id !== id)),
      views.current.get(id)?.el,
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
          held={() => held.current.has(toast.id)}
          register={(view) => {
            if (view) views.current.set(toast.id, view);
            else views.current.delete(toast.id);
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
  /** Whether the region will start the entrance itself, once the stack has made room. */
  readonly held: () => boolean;
  readonly register: (view: View | null) => void;
  readonly onExited: () => void;
  readonly onDone: (reason: 'dismissed' | 'action') => void;
}

function ToastView({
  toast,
  leaving,
  newest,
  waiting,
  held,
  register,
  onExited,
  onDone,
}: ToastViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const fade = useRef<Motion | null>(null);
  /** Where the entrance is: held by the region, waiting out its delay, or in. */
  const phase = useRef<'held' | 'waiting' | 'in'>('held');
  /** Cancels the wait of an entrance not yet begun. */
  const wait = useRef<(() => void) | null>(null);
  const hovered = useRef(false);
  const swipe = useRef<{ x: number; id: number; track: ReturnType<typeof velocityTracker> } | null>(
    null,
  );

  // The latest callbacks, so the motion effects below run on their own changes only.
  const callbacks = useRef({ held, register, onExited });
  useLayoutEffect(() => {
    callbacks.current = { held, register, onExited };
  });

  // *toast* in: 16 px up and a fade on the glass element itself (Q-3), its backdrop filter
  // with it. Held hidden, 16 px down, while the stack above makes room.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const hide = () => {
      el.style.opacity = '0';
      el.style.transform = `translate(0px, ${RISE_PX}px)`;
    };
    const view: View = {
      el,
      entered: () => phase.current === 'in',
      hold() {
        if (phase.current === 'in') return;
        wait.current?.();
        wait.current = null;
        phase.current = 'held';
        hide();
      },
      enter(delay) {
        if (phase.current === 'in') return;
        wait.current?.();
        phase.current = 'waiting';
        let came = false;
        const cancel = after(delay, () => {
          came = true;
          wait.current = null;
          phase.current = 'in';
          // The motions take both properties over from the hold, and clear them at rest (Q-2).
          animateStyle(el, 'transform', [0, RISE_PX], [0, 0], { spring: 'quick' });
          fade.current = animateStyle(el, 'opacity', 0, 1, { spring: 'quick' });
          fadeBackdrop(el, 'in');
        });
        wait.current = came ? null : cancel;
      },
    };
    callbacks.current.register(view);
    if (callbacks.current.held()) view.hold();
    else view.enter(0);
    return () => {
      wait.current?.();
      callbacks.current.register(null);
      if (hovered.current) setToastPause('hover', false);
    };
  }, []);

  // Out: inert at once (A-13), a fade of the glass and its backdrop from wherever the entrance
  // is, then gone. A toast still held never showed: it goes at once.
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
    if (phase.current !== 'in') {
      // Never shown: nothing to fade.
      wait.current?.();
      wait.current = null;
      done();
      return;
    }
    const from = fade.current?.value ?? 1;
    fade.current = animateStyle(el, 'opacity', from, 0, {
      spring: 'track',
      keep: true,
      onComplete: done,
    });
    fadeBackdrop(el, 'out', from);
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
                  className={styles.action}
                  onClick={() => run(toast.secondary as Toast['action'] & {})}
                >
                  {toast.secondary.label}
                </Button>
              ) : null}
              {toast.action ? (
                <Button
                  variant={toast.kind === 'system' ? 'prominent' : 'standard'}
                  className={styles.action}
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

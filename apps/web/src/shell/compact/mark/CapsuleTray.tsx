/**
 * The single capsule's tray (EDN-24, Labs `phone-capsule`; plan "Component structure"): one
 * 56 px row, 324 px wide (`--tray-w`) and centred on the capsule, that holds the armed tool's
 * options in 7 targets of 44 px. It renders the tool's `Tray`, else its `Options` (`registry.ts`);
 * Pen and Highlight add the Eraser at the end (`toggleEraser`). The pressed tool is
 * `trayTool`: the Eraser counts as the tool it took over from, Edit text as Text.
 *
 * - **Shows** while `editing && trayOpen && !capsuleAway` with a tool armed. It takes no scrim
 *   and no focus: presses on the page go to the page (EDN-18's intent), so drawing, placing and
 *   selecting work with it open.
 * - **Semantics.** A non-modal `role="toolbar"`, `id="compact-tool-tray"` (the pressed tool's
 *   `aria-controls`), named "{tool} options". Marked `data-compact-chrome` and
 *   `data-annotation-keep` (a press on it keeps the annotation selection) and
 *   `data-compact-above-capsule` (the selection bar and the keyboard band stay clear of it).
 * - **Closing.** Esc (focus goes back to the armed tool), Android's back (a close watcher where
 *   the browser has one) and a swipe down that follows the finger; the spring starts at the
 *   finger's speed as it lifts (`velocityTracker`, MOT-18). A press that scrolls the tray
 *   sideways (a narrow screen, the saved signatures) is a scroll, never the swipe.
 * - **A new tool** fades the content over (out 90 ms, in 160 ms); the tray keeps its width.
 * - **Motion** is `tray-motion.ts`; nothing is left inline at rest.
 */
import { type PointerEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { m } from '../../../i18n';
import { receivePulse } from '../../../motion/receive';
import { velocityTracker, type VelocityTracker } from '../../../motion/velocity';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { capsuleAway, setTrayOpen, useCompactStore } from '../compact-store';
import { eraserFrom, toggleEraser } from './bridge';
import { trayTool } from './capsule-state';
import { type CompactToolSpec, useCompactTools } from './registry';
import { swipeCloses } from './drawer-motion';
import { chipOf } from './use-drawer-panel';
import styles from './CapsuleTray.module.css';
import { fadeContent, trayMotion, type TrayMotion } from './tray-motion';

/** A drag this far down (CSS px) takes the tray with the finger. */
const DRAG_START_PX = 6;

/** The browser's close watcher (Android's back), where it has one. */
interface CloseWatcherLike {
  onclose: (() => void) | null;
  destroy(): void;
}

/** The armed tool's button in the capsule (it carries `data-compact-tool-chip`). */
function armedTool(): HTMLElement | null {
  const chip = chipOf();
  if (!(chip instanceof HTMLElement)) return null;
  return chip.matches('button') ? chip : (chip.querySelector('button') ?? chip);
}

/** Tools whose tray ends with the Eraser. */
const WITH_ERASER: ReadonlySet<string> = new Set(['pen', 'highlight']);

export function CapsuleTray() {
  const specs = useCompactTools();
  const tool = useCompactStore((s) => s.tool);
  const open = useCompactStore((s) => s.editing && s.trayOpen && !capsuleAway(s));
  const spec = specs.get(trayTool(tool, eraserFrom()) ?? 'pen');
  const live = open && tool !== null && (spec?.Tray ?? spec?.Options) !== undefined;
  // Closing keeps the last tool's tray on screen until it has gone.
  const [held, setHeld] = useState<CompactToolSpec | null>(null);
  if (live && spec !== held) setHeld(spec ?? null);
  const [shown, setShown] = useState(live);
  if (live && !shown) setShown(true);
  return shown && held ? <Panel open={live} spec={held} onClosed={() => setShown(false)} /> : null;
}

function Panel({
  open,
  spec,
  onClosed,
}: {
  readonly open: boolean;
  readonly spec: CompactToolSpec;
  readonly onClosed: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const motion = useRef<TrayMotion | null>(null);
  const closed = useRef(onClosed);
  const tool = useCompactStore((s) => s.tool);
  const eraser = useCompactTools().get('eraser');
  // The tool whose content shows: it lags a change by the fade out.
  const [item, setItem] = useState(spec);
  const first = useRef(true);
  useLayoutEffect(() => {
    closed.current = onClosed;
  });

  // Open and close.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    motion.current ??= trayMotion(panel);
    if (open) {
      void motion.current.to(1);
      if (first.current) {
        first.current = false;
        const content = contentRef.current;
        if (content)
          content.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: 160,
            delay: 60,
            fill: 'backwards',
            easing: 'ease-out',
          });
      }
      return;
    }
    const hadFocus = panel.contains(document.activeElement);
    let live = true;
    void motion.current.to(0).then(() => {
      if (!live) return;
      const now = document.activeElement;
      const free = now === null || now === document.body || panel.contains(now);
      if (hadFocus && free) armedTool()?.focus();
      closed.current();
    });
    return () => {
      live = false;
    };
  }, [open]);

  // A new tool: the content fades over, the tray stays.
  useEffect(() => {
    const content = contentRef.current;
    if (!open || spec === item || !content) return;
    let live = true;
    void fadeContent(content, 'out').finished.then(
      () => {
        if (!live) return;
        setItem(spec);
        requestAnimationFrame(() => {
          if (contentRef.current) fadeContent(contentRef.current, 'in');
        });
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [open, spec, item]);

  // Esc closes from anywhere while open, and focus goes back to the armed tool; so does
  // Android's back, through a close watcher.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      setTrayOpen(false);
      armedTool()?.focus();
    };
    window.addEventListener('keydown', onKey);
    const Watcher = (window as unknown as { CloseWatcher?: new () => CloseWatcherLike })
      .CloseWatcher;
    let watcher: CloseWatcherLike | undefined;
    try {
      watcher = Watcher ? new Watcher() : undefined;
    } catch {
      // Without a user activation a browser may refuse one: Esc and the swipe still close it.
    }
    if (watcher) watcher.onclose = () => setTrayOpen(false);
    return () => {
      window.removeEventListener('keydown', onKey);
      watcher?.destroy();
    };
  }, [open]);

  // Swipe down: the tray follows the finger; a long or quick enough swipe closes it.
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    t: number;
    on: boolean;
    tracker: VelocityTracker;
  } | null>(null);
  const swipe = {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      if (!event.isPrimary || !open) return;
      const tracker = velocityTracker();
      tracker.add(event.timeStamp, event.clientX, event.clientY);
      drag.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        t: event.timeStamp,
        on: false,
        tracker,
      };
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      if (d?.id !== event.pointerId) return;
      const dy = event.clientY - d.y;
      d.tracker.add(event.timeStamp, event.clientX, event.clientY);
      if (!d.on) {
        if (dy < DRAG_START_PX || Math.abs(event.clientX - d.x) > dy) return;
        d.on = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      motion.current?.drag(dy);
    },
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      drag.current = null;
      if (!d?.on || d.id !== event.pointerId) return;
      const dy = event.clientY - d.y;
      const ms = Math.max(1, event.timeStamp - d.t);
      const velocity = d.tracker.velocity(event.timeStamp).y;
      if (swipeCloses(dy, dy / ms)) {
        motion.current?.thrown(velocity);
        setTrayOpen(false);
      } else motion.current?.release(velocity);
    },
    onPointerCancel: () => {
      drag.current = null;
      motion.current?.release();
    },
  };

  const Content = item.Tray ?? item.Options;
  return (
    <div
      ref={panelRef}
      id="compact-tool-tray"
      role="toolbar"
      aria-label={m.compact_tray_label({ tool: item.label() })}
      className={styles.tray}
      data-compact-chrome=""
      data-annotation-keep=""
      data-compact-above-capsule=""
      data-closing={open ? undefined : ''}
      data-testid="compact-tool-tray"
      inert={!open}
      {...swipe}
    >
      <div ref={contentRef} className={styles.content}>
        {Content ? <Content key={item.id} /> : null}
        {WITH_ERASER.has(item.id) && eraser ? (
          <>
            <span className={styles.rule} aria-hidden="true" />
            <Button
              variant="quiet"
              className={styles.eraser}
              aria-label={eraser.label()}
              aria-pressed={tool === 'eraser'}
              data-testid="compact-tray-eraser"
              onClick={(event) => {
                void receivePulse(event.currentTarget);
                toggleEraser();
              }}
            >
              <Icon name={eraser.glyph} />
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

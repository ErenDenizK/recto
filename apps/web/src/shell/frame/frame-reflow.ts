/**
 * The canvas reflows on a spring when the docked sidebar comes or goes (docs/design/motion-2026-10
 * frame.md §1; language.md §7.3 *reflow*, *panel*). The free rectangle's left inset changes at
 * once (`frame-insets.ts`), and the Read view lays its pages out in the new rectangle in the same
 * frame (a fit-width page also changes size), so without this the pages and the dock jump.
 *
 * `captureReflow()` is called while the old layout is still on screen (the sidebar's layout
 * effect, before the free rectangle is written): it reads the first visible page and the dock
 * band's items. The returned `play()` runs once the new layout is in (the stage's next resize,
 * after layout and before paint): FLIP by the individual `translate` and `scale` properties, so
 * whatever `transform` the elements carry (the pill's rise, the dock's hide on scroll) composes
 * with it untouched.
 *
 * - **The pages:** the Read view's content (the viewport's child that holds the pages) is moved
 *   and scaled so the reference page starts exactly where it was, then springs home on `smooth`
 *   (the *panel* token, as the sidebar's own slide), about the page's new centre.
 * - **The band:** the dock and the pill slide by `translate` only (a glass piece never scales,
 *   Q-6); a piece that did not move (the trailing pill) is left alone.
 * - **Interruptible:** a reflow that starts while one runs reads the elements where they are
 *   drawn (`getBoundingClientRect` includes the running animation), cancels it and starts from
 *   there, so a quick open-close turns around without a jump.
 * - **At rest** nothing is left inline (Q-2), and nothing runs (Q-10). Reduced motion: no
 *   reflow motion; the layout changes at once, as before (§7.5).
 */
import { reducedMotion } from '../../motion/reduced-motion';
import { springToLinear } from '../../motion/springs';

/** The dock band's pieces (as `FRAME_LAYER.bandItem` in frame-insets.ts). */
const BAND_ITEMS =
  '[data-frame-layer="band"] [data-band-item], [data-frame-layer="band"] [data-region="toolbar"]';

/** Moves under this (px), and scale changes under this ratio, are not animated. */
const STILL_PX = 0.5;
const STILL_SCALE = 0.002;

/** A reflow with nothing to play. */
const nothing = (): void => undefined;

/** The reflows running now, per element, so the next one can cancel them. */
const running = new WeakMap<Element, Animation>();

interface Target {
  readonly el: HTMLElement;
  /** The box that is matched before and after: the reference page, or the piece itself. */
  readonly box: () => Element | null;
  readonly first: DOMRect;
  /** Whether it may scale (the pages) or only move (a glass piece). */
  readonly scales: boolean;
}

/** The first page whose box crosses the middle third of the stage, else the first one drawn. */
function referencePage(stage: HTMLElement): HTMLElement | null {
  const pages = [...stage.querySelectorAll<HTMLElement>('[data-read-viewport] [data-page-id]')];
  const s = stage.getBoundingClientRect();
  const mid = s.top + s.height / 2;
  return (
    pages.find((p) => {
      const r = p.getBoundingClientRect();
      return r.top <= mid && r.bottom >= mid;
    }) ??
    pages[0] ??
    null
  );
}

/** The viewport's child that holds `page` (the content that scrolls). */
function contentOf(page: HTMLElement): HTMLElement | null {
  const viewport = page.closest<HTMLElement>('[data-read-viewport]');
  let node: HTMLElement | null = page;
  while (node && node.parentElement !== viewport) node = node.parentElement;
  return node;
}

function cancelRunning(el: Element): void {
  running.get(el)?.cancel();
  running.delete(el);
}

/**
 * Reads where the pages and the band's pieces are drawn now; `play()` animates them from there
 * to where the next layout puts them. Returns a no-op under reduced motion or with no stage.
 */
export function captureReflow(doc: Document = document): () => void {
  if (reducedMotion()) return nothing;
  const stage = doc.getElementById('stage');
  if (!stage) return nothing;
  const targets: Target[] = [];
  const page = referencePage(stage);
  const content = page ? contentOf(page) : null;
  if (page && content) {
    const id = page.dataset.pageId ?? '';
    targets.push({
      el: content,
      box: () => content.querySelector(`[data-page-id="${CSS.escape(id)}"]`),
      first: page.getBoundingClientRect(),
      scales: true,
    });
  }
  for (const piece of doc.querySelectorAll<HTMLElement>(BAND_ITEMS)) {
    if (piece.getClientRects().length === 0) continue;
    targets.push({
      el: piece,
      box: () => piece,
      first: piece.getBoundingClientRect(),
      scales: false,
    });
  }
  // Read before any write: a running reflow is cancelled only now, its drawn place kept above.
  for (const t of targets) cancelRunning(t.el);
  return () => play(targets);
}

function play(targets: readonly Target[]): void {
  const { easing, duration } = springToLinear('smooth');
  // Every read before the first write.
  const moves = targets.map((t) => {
    const box = t.box();
    if (!box || !t.el.isConnected) return null;
    const last = box.getBoundingClientRect();
    if (last.width === 0 || t.first.width === 0) return null;
    const s = t.scales ? t.first.width / last.width : 1;
    const dx = t.first.left + t.first.width / 2 - (last.left + last.width / 2);
    const dy = t.scales ? t.first.top + t.first.height / 2 - (last.top + last.height / 2) : 0;
    if (Math.abs(dx) < STILL_PX && Math.abs(dy) < STILL_PX && Math.abs(s - 1) < STILL_SCALE) {
      return null;
    }
    // Scale about the reference page's new centre, in the content's own box.
    const own = t.el.getBoundingClientRect();
    const origin = t.scales
      ? `${last.left + last.width / 2 - own.left}px ${last.top + last.height / 2 - own.top}px`
      : null;
    return { el: t.el, dx, dy, s, origin };
  });
  for (const move of moves) {
    if (!move) continue;
    const { el, dx, dy, s, origin } = move;
    const from: Keyframe = { translate: `${dx}px ${dy}px` };
    const to: Keyframe = { translate: '0px 0px' };
    if (s !== 1) {
      from.scale = `${s}`;
      to.scale = '1';
    }
    if (origin) el.style.transformOrigin = origin;
    const animation = el.animate([from, to], { duration, easing });
    running.set(el, animation);
    const done = () => {
      if (running.get(el) !== animation) return;
      running.delete(el);
      if (origin) el.style.removeProperty('transform-origin');
    };
    animation.onfinish = done;
    animation.oncancel = done;
  }
}

/**
 * Plays `play` once the new layout is in: the stage's first `ResizeObserver` callback, after
 * layout and before paint, or two frames on if none comes.
 */
export function whenStageResized(play: () => void, doc: Document = document): () => void {
  const stage = doc.getElementById('stage');
  let done = false;
  const once = () => {
    if (done) return;
    done = true;
    observer?.disconnect();
    cancelAnimationFrame(frame);
    play();
  };
  // Observed before the free rectangle is written, its first callback comes in this frame's
  // resize step, after the new layout (the pages included) and before paint.
  const observer = stage ? new ResizeObserver(once) : null;
  observer?.observe(stage as HTMLElement);
  // Two frames: the free rectangle is written in a microtask and the pages laid out after it.
  let frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame(once);
  });
  return () => {
    done = true;
    observer?.disconnect();
    cancelAnimationFrame(frame);
  };
}

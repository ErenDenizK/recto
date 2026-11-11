/**
 * The fingertip seen in phone clips (`Scene.device: 'phone'`). A phone has no pointer to
 * draw, and a tap is over in one frame, so the harness shows each touch as a soft disc that
 * appears where the finger lands, follows it while it moves and fades once it lifts: long
 * enough for a viewer to see where the tap went. It listens to the page's own pointer events
 * (touch only) and never takes one: `pointer-events: none`, above everything.
 */
import type { Page } from '@playwright/test';

/** How long the disc stays after the finger lifts, in milliseconds. */
const FADE_MS = 420;
/** A fingertip's contact, about the 48 CSS px iOS reports (e2e/compact-pen.spec.ts). */
const SIZE = 44;

function injectTouch(options: { fadeMs: number; size: number }): void {
  const dot = document.createElement('div');
  dot.setAttribute('aria-hidden', 'true');
  dot.dataset.media = 'touch';
  Object.assign(dot.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: `${options.size}px`,
    height: `${options.size}px`,
    borderRadius: '50%',
    background: 'rgb(255 255 255 / 0.28)',
    boxShadow: '0 0 0 1.5px rgb(255 255 255 / 0.7), 0 2px 10px rgb(0 0 0 / 0.35)',
    pointerEvents: 'none',
    zIndex: '2147483647',
    opacity: '0',
    translate: '-100px -100px',
    transition: `opacity ${options.fadeMs}ms ease-out, scale ${options.fadeMs}ms ease-out`,
  });
  const half = options.size / 2;
  const place = (event: PointerEvent) => {
    dot.style.translate = `${event.clientX - half}px ${event.clientY - half}px`;
  };
  const opts = { capture: true, passive: true } as const;
  window.addEventListener(
    'pointerdown',
    (event) => {
      if (event.pointerType !== 'touch') return;
      place(event);
      dot.style.transition = 'none';
      dot.style.opacity = '1';
      dot.style.scale = '1';
    },
    opts,
  );
  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType === 'touch' && dot.style.opacity === '1') place(event);
    },
    opts,
  );
  const lift = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return;
    dot.style.transition = `opacity ${options.fadeMs}ms ease-out, scale ${options.fadeMs}ms ease-out`;
    dot.style.opacity = '0';
    dot.style.scale = '1.25';
  };
  window.addEventListener('pointerup', lift, opts);
  window.addEventListener('pointercancel', lift, opts);
  const attach = () => document.documentElement.append(dot);
  if (document.documentElement) attach();
  else document.addEventListener('DOMContentLoaded', attach, { once: true });
}

/** Installs the fingertip before the page's own scripts run. */
export async function installTouch(page: Page): Promise<void> {
  await page.addInitScript(injectTouch, { fadeMs: FADE_MS, size: SIZE });
}

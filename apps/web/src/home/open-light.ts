/**
 * The light's answer to a document opening (R26 concept 2 "opening in light", DSN-64; DSN-5: the
 * light answers events; MOT-4: rest is still). Once per session, when the sharp render has
 * landed, a halo of the aurora's lime breathes round the page: it swells on `quick` and settles
 * on `glide`, both springs of the motion core, and is gone. It reaches under 64 px out. Later
 * opens keep only the grow (`library-transition.ts`). Reduced motion plays nothing (A-9).
 */
import { animate } from '../motion/animate';
import { deskEnabled } from './desk-flag';
import { homeFlagEnabled, OPEN_LIGHT_FLAG } from './home-flags';
import { reducedMotion } from '../motion/reduced-motion';
import { clamp } from '../motion/velocity';

/**
 * Whether the open moment is on (DSN-64): on the desk (DSN-87, Masa) by default, `?open=0` turns
 * it off; elsewhere behind `?open=light` or Labs' "Open in light".
 */
export function openLightOn(): boolean {
  if (deskEnabled()) return new URLSearchParams(location.search).get('open') !== '0';
  return homeFlagEnabled(OPEN_LIGHT_FLAG);
}

/** True once the pulse has played in this session. */
let pulsed = false;

/** The longest to wait for the sharp render before the light answers anyway (a safety, ms). */
const LANDING_WAIT_MS = 2500;

const HALO =
  'position:absolute;inset:0;pointer-events:none;border-radius:var(--radius-page);opacity:0;' +
  'box-shadow:0 0 0 1px color-mix(in srgb,var(--aura-lime) 70%,transparent),' +
  '0 0 44px 8px color-mix(in srgb,var(--aura-lime) 55%,transparent);';

function rendered(page: HTMLElement): boolean {
  return page.querySelector('canvas[data-layer="page"]')?.getAttribute('data-state') === 'rendered';
}

/** Resolves when the page's sharp render shows, or after `LANDING_WAIT_MS`. */
function landed(page: HTMLElement): Promise<void> {
  if (rendered(page)) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      observer.disconnect();
      clearTimeout(timer);
      resolve();
    };
    const observer = new MutationObserver(() => rendered(page) && done());
    observer.observe(page, { subtree: true, attributes: true, attributeFilter: ['data-state'] });
    const timer = setTimeout(done, LANDING_WAIT_MS);
  });
}

/** Pulses the light round `page` once the sharp render has landed; only the session's first. */
export async function lightPulse(page: HTMLElement): Promise<void> {
  if (pulsed || reducedMotion()) return;
  pulsed = true;
  await landed(page);
  if (!page.isConnected) return;
  const halo = document.createElement('div');
  halo.setAttribute('aria-hidden', 'true');
  halo.dataset.openLight = '';
  halo.style.cssText = HALO;
  page.append(halo);
  const set = (v: number) => {
    halo.style.opacity = String(clamp(v, 0, 1));
  };
  await animate(0, 1, { spring: 'quick', onUpdate: set }).finished;
  await animate(1, 0, { spring: 'glide', onUpdate: set }).finished;
  halo.remove();
}

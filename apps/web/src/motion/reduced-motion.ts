/**
 * Reduced motion: the only source script asks (language.md §7.5–§7.6; ADR-0026 §2 item 8;
 * research 22 §5.2, A-9; 09-primitives §31).
 *
 * Motion is reduced when the system asks (`prefers-reduced-motion: reduce`) or when the in-app
 * setting "Reduce motion: System · On" is On, stored as `data-motion="reduced"` on the root and
 * matched by the same CSS blocks as the media query. Every script animation in the module reads
 * `reducedMotion()` when it starts or retargets: spatial springs become instant, a fade is kept
 * (at most 150 ms), projection and rubber band are off, and View Transitions are skipped. Direct
 * manipulation (drag, pinch, pan, ink) stays 1:1 and is the caller's business.
 */

const QUERY = '(prefers-reduced-motion: reduce)';

/** True when the system or the in-app setting asks for reduced motion (§7.6). */
export function reducedMotion(): boolean {
  return document.documentElement.dataset.motion === 'reduced' || systemReducedMotion();
}

/**
 * True when the system alone asks (`prefers-reduced-motion: reduce`): for the Reduce motion
 * setting to show "On, set by your system" (§7.6). Animations ask `reducedMotion()`.
 */
export function systemReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia(QUERY).matches;
}

/**
 * Calls `listener` with the answer whenever either path changes (the system setting, or the
 * root's `data-motion`); returns the unsubscribe. The shape fits
 * `useSyncExternalStore(subscribeReducedMotion, reducedMotion)`.
 */
export function subscribeReducedMotion(listener: (reduced: boolean) => void): () => void {
  const notify = () => listener(reducedMotion());
  const query = matchMedia(QUERY);
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributeFilter: ['data-motion'] });
  query.addEventListener('change', notify);
  return () => {
    observer.disconnect();
    query.removeEventListener('change', notify);
  };
}

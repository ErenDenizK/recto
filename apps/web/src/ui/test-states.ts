/**
 * Test support for the primitives' browser-mode suites (quality-bar Q-14: every state rendered):
 * force a pseudo-class (`:hover`, `:active`, `:focus-visible`) on an element through the Chrome
 * DevTools Protocol, so a test reads the computed style of a real pressed or hovered control.
 * Chromium only, like the browser-mode suite. Not part of the app.
 *
 * The coarse density is not emulated here: CDP's touch emulation, once turned off, leaves the
 * page with `pointer: none` and `hover: none` for every later file of the run. The 44 px sizes
 * are checked in `e2e/surfaces.visual.spec.ts` on a touch context and by `bar-audit.spec.ts` on
 * the `tablet` project.
 */
import { cdp } from 'vitest/browser';

/** Chrome DevTools Protocol, typed loosely (the provider's session type is not exported). */
export function devtools<T = unknown>(method: string, params: object = {}): Promise<T> {
  return (cdp() as unknown as { send(m: string, p: object): Promise<T> }).send(method, params);
}

interface CdpNode {
  readonly nodeId: number;
  readonly nodeName: string;
  readonly children?: readonly CdpNode[];
  readonly contentDocument?: CdpNode;
}

/** The CDP node id of `element`, which lives in the test's iframe. */
async function nodeIdOf(element: Element): Promise<number> {
  // Unique across the run: earlier files' iframes may still hold their own keyed elements.
  const key = `force-${crypto.randomUUID()}`;
  element.setAttribute('data-cdp-key', key);
  await devtools('DOM.enable');
  const { root } = await devtools<{ root: CdpNode }>('DOM.getDocument', {
    depth: -1,
    pierce: true,
  });
  const documents: CdpNode[] = [];
  const walk = (node: CdpNode) => {
    if (node.contentDocument) documents.push(node.contentDocument);
    for (const child of node.children ?? []) walk(child);
    if (node.contentDocument) walk(node.contentDocument);
  };
  walk(root);
  for (const doc of documents) {
    const { nodeId } = await devtools<{ nodeId: number }>('DOM.querySelector', {
      nodeId: doc.nodeId,
      selector: `[data-cdp-key="${key}"]`,
    });
    if (nodeId) return nodeId;
  }
  throw new Error('element not found through CDP');
}

export type PseudoState = 'hover' | 'active' | 'focus' | 'focus-visible';

/** Forces `states` on `element` until the returned function is called. */
export async function forceState(
  element: Element,
  states: readonly PseudoState[],
): Promise<() => Promise<void>> {
  const nodeId = await nodeIdOf(element);
  await devtools('CSS.enable');
  await devtools('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: states });
  return async () => {
    await devtools('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
  };
}

/**
 * Turns CSS transitions and animations off for the rest of the file, so a computed style read
 * straight after a state change is the state's value, not the first frame of its transition.
 */
export function stillStyles(): void {
  if (document.getElementById('still-styles')) return;
  const style = document.createElement('style');
  style.id = 'still-styles';
  style.textContent =
    '*, *::before, *::after { transition: none !important; animation: none !important; }';
  document.head.append(style);
}

/**
 * Whether the page can hover. An earlier file of the run that turned CDP touch emulation on and
 * off leaves `hover: none` behind, and then no hover rule applies (rightly): the hover checks
 * run only where hover is possible.
 */
export const canHover = (): boolean => matchMedia('(hover: hover)').matches;

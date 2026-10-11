/**
 * Where the Use flight lands (`flight.ts`, motion-2026-10 forms-compact §2): the new
 * signature's chip, else the Sign button, else the phone's tool chip (design/phone-2026-10
 * README §4), and never the annotation layer, whose `data-tool` names the armed tool too (a
 * pulse there scales the page under the finger that places the signature).
 */
import { afterEach, describe, expect, it } from 'vitest';

import { flightTarget } from './flight';

function mount(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.append(root);
  return root;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('flightTarget', () => {
  it('lands on the new signature’s chip when it shows', () => {
    const root = mount(`
      <div data-annotation-layer="0" data-tool="signature"></div>
      <button data-tool="signature">Sign</button>
      <button data-saved-signature="s-1">Kept</button>`);
    expect(flightTarget('s-1', root)?.getAttribute('data-saved-signature')).toBe('s-1');
  });

  it('falls back to the Sign button, not the annotation layer before it', () => {
    const root = mount(`
      <div data-annotation-layer="0" data-tool="signature">
        <svg><g data-tool="signature"></g></svg>
      </div>
      <button data-tool="signature">Sign</button>`);
    expect(flightTarget(undefined, root)?.tagName).toBe('BUTTON');
  });

  it('on the phone, falls back to the tool chip', () => {
    const root = mount(`
      <div data-annotation-layer="0" data-tool="signature"></div>
      <div data-compact-tool-chip=""><button>Sign</button></div>`);
    expect(flightTarget('missing', root)?.hasAttribute('data-compact-tool-chip')).toBe(true);
  });

  it('finds nothing rather than the page', () => {
    const root = mount(`<div data-annotation-layer="0" data-tool="signature"></div>`);
    expect(flightTarget(undefined, root)).toBeNull();
  });
});

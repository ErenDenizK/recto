/**
 * Focus after an open from the picker (01-frame F3 §6; XD-3): the opened document's pages take
 * it once they mount, unless the focus moved meanwhile; never the previous document's pages.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { focusOpenedPage } from './focus-opened-page';

const frames = (n: number) =>
  new Promise<void>((resolve) => {
    let left = n;
    const step = () => (--left <= 0 ? resolve() : requestAnimationFrame(step));
    requestAnimationFrame(step);
  });

/** A stage showing `documentId` (labelled by its tab) with its page viewport. */
function stage(documentId: string | null): HTMLElement {
  document.getElementById('stage')?.remove();
  const main = document.createElement('main');
  main.id = 'stage';
  if (documentId) {
    main.setAttribute('aria-labelledby', `tab-${documentId}`);
    const viewport = document.createElement('div');
    viewport.tabIndex = 0;
    viewport.setAttribute('data-read-viewport', '');
    main.append(viewport);
  }
  document.body.append(main);
  return main;
}

function button(name: string): HTMLButtonElement {
  const el = document.createElement('button');
  el.textContent = name;
  document.body.append(el);
  return el;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('focusOpenedPage', () => {
  it('moves the focus from + to the pages once they mount', async () => {
    const plus = button('+');
    plus.focus();
    stage(null);
    focusOpenedPage('d1', plus);
    await frames(2);
    expect(document.activeElement).toBe(plus);
    stage('d1');
    await frames(2);
    expect(document.activeElement?.hasAttribute('data-read-viewport')).toBe(true);
  });

  it('moves it when the control that opened left with its view (focus on body)', async () => {
    const open = button('Open files');
    open.focus();
    open.remove();
    stage('d1');
    focusOpenedPage('d1', open);
    await frames(2);
    expect(document.activeElement?.hasAttribute('data-read-viewport')).toBe(true);
  });

  it('keeps a focus that moved elsewhere meanwhile', async () => {
    const plus = button('+');
    const field = document.createElement('input');
    document.body.append(field);
    plus.focus();
    focusOpenedPage('d1', plus);
    field.focus();
    stage('d1');
    await frames(2);
    expect(document.activeElement).toBe(field);
  });

  it("waits for the opened document, not the previous one's pages", async () => {
    const plus = button('+');
    plus.focus();
    stage('d0');
    focusOpenedPage('d1', plus);
    await frames(2);
    expect(document.activeElement).toBe(plus);
    stage('d1');
    await frames(2);
    expect(document.getElementById('stage')?.getAttribute('aria-labelledby')).toBe('tab-d1');
    expect(document.activeElement?.hasAttribute('data-read-viewport')).toBe(true);
  });
});

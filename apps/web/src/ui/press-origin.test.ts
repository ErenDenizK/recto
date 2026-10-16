import { afterEach, describe, expect, it } from 'vitest';

import { installPressOrigin, recentOrigin, resetPressOrigin } from './press-origin';

/** A 32 px control on the page, pressed by a click. */
function press(): HTMLButtonElement {
  const button = document.createElement('button');
  button.textContent = 'Open files';
  button.style.cssText = 'width: 32px; height: 32px';
  document.body.append(button);
  button.click();
  return button;
}

const key = (key: string, init: KeyboardEventInit = {}) =>
  document.body.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
  );

describe('press origin (motion-2026-10/platform.md §1; MOT-9)', () => {
  installPressOrigin();

  afterEach(() => {
    resetPressOrigin();
    document.body.replaceChildren();
  });

  it('notes the control a click pressed', () => {
    const button = press();
    expect(recentOrigin()?.returnTo).toBe(button);
  });

  it('forgets it at a shortcut, so what the shortcut opens keeps its own entrance', () => {
    press();
    key('Control', { ctrlKey: true });
    key('Shift', { ctrlKey: true, shiftKey: true });
    // A modifier alone may belong to a click or start the shortcut: the press stands.
    expect(recentOrigin()).not.toBeNull();
    key('S', { ctrlKey: true, shiftKey: true });
    expect(recentOrigin()).toBeNull();
  });

  it('notes Enter on a control as its press', () => {
    const button = press();
    resetPressOrigin();
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(recentOrigin()?.returnTo).toBe(button);
  });
});

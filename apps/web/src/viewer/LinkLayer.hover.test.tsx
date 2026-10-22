/**
 * Link hover gating in a real browser (DSN-3: nothing looks selected on arrival): a pointer
 * parked where the page opens marks no link; only a mouse pointermove over it does, and leaving
 * clears it. The selection-blue rule itself is LinkLayer.module.css's `[data-hover]`.
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { hoverMark } from './LinkLayer';
import styles from './LinkLayer.module.css';

function renderHotspot(): HTMLElement {
  render(
    <div className={styles.layer} data-live="true">
      <button type="button" className={styles.hotspot} {...hoverMark}>
        link
      </button>
    </div>,
  );
  return screen.getByRole('button', { name: 'link' });
}

const fire = (el: HTMLElement, type: string, pointerType = 'mouse') =>
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType }));

describe('link hover mark', () => {
  it('marks nothing for a parked pointer, then marks on a mouse move and clears on leave', () => {
    const link = renderHotspot();
    // A parked pointer reaches the page as over, never as a move (React derives leave from out).
    fire(link, 'pointerover');
    expect(link.dataset.hover).toBeUndefined();
    fire(link, 'pointermove', 'touch');
    expect(link.dataset.hover).toBeUndefined();
    fire(link, 'pointermove');
    expect(link.dataset.hover).toBe('');
    fire(link, 'pointerout');
    expect(link.dataset.hover).toBeUndefined();
  });
});

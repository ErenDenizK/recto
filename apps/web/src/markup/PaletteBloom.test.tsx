/**
 * The labels that bloom (DSN-71), Vitest browser mode on a stand-in palette: they come by
 * themselves in the first two sessions, only on a press and hold after that, name the unlabelled
 * buttons (and none that show a name), and go again.
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { act, cleanup, render, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import PaletteBloom from './PaletteBloom';
import { HOLD_MS, LABELS_SESSIONS_KEY, resetPaletteLabels, SHOWN_MS } from './palette-labels';

function Palette() {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} data-testid="content" style={{ width: 300 }}>
      <div role="toolbar" style={{ display: 'flex', gap: 4 }}>
        <button type="button" data-size="bar" aria-label="Lasso" style={{ width: 32 }} />
        <span data-sep="" style={{ width: 1 }} />
        <button type="button" data-size="bar" aria-label="Text box" style={{ width: 32 }} />
        <button type="button" data-size="bar" data-labelled="" aria-label="Done" />
      </div>
      <PaletteBloom contentRef={ref} />
    </div>
  );
}

const labels = (root: HTMLElement) =>
  [...root.querySelectorAll('[title]')].map((e) => e.textContent);

describe('PaletteBloom', () => {
  beforeEach(() => {
    localStorage.clear();
    resetPaletteLabels();
  });
  afterEach(cleanup);

  it('blooms by itself in the first session, naming only the unlabelled buttons', async () => {
    const { getByTestId } = render(<Palette />);
    const content = getByTestId('content');
    await waitFor(() => expect(labels(content)).toEqual(['Lasso', 'Text box']), { timeout: 3000 });
    expect(localStorage.getItem(LABELS_SESSIONS_KEY)).toBe('1');
  });

  it('settles back to icons only', async () => {
    const { getByTestId } = render(<Palette />);
    const content = getByTestId('content');
    await waitFor(() => expect(labels(content).length).toBe(2), { timeout: 3000 });
    await waitFor(() => expect(labels(content)).toEqual([]), { timeout: SHOWN_MS + 2000 });
  });

  it('after the first two sessions waits for a press and hold', async () => {
    localStorage.setItem(LABELS_SESSIONS_KEY, '2');
    const { getByTestId } = render(<Palette />);
    const content = getByTestId('content');
    await new Promise((r) => setTimeout(r, 800));
    expect(labels(content)).toEqual([]);
    const target = content.querySelector('[role="toolbar"]') as HTMLElement;
    await act(async () => {
      target.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          pointerType: 'touch',
          clientX: 5,
          clientY: 5,
        }),
      );
      await new Promise((r) => setTimeout(r, HOLD_MS + 150));
    });
    await waitFor(() => expect(labels(content)).toEqual(['Lasso', 'Text box']));
  });
});

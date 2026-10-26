/**
 * The Aa popover (DSN-84, PRD-36 §4, §7): the size stepper, the three segmented rows, keys, and
 * that every choice is kept on the device.
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { act, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import { settled } from '../../test/settled';
import { ReadingOptions } from './ReadingOptions';
import { pinchStep } from './TextView';
import { READING_PREFS_KEY, reloadReadingPrefs, useReadingPrefs } from './reading-prefs';

beforeEach(() => {
  localStorage.clear();
  reloadReadingPrefs();
});

async function open() {
  render(
    <div style={{ height: 600, paddingTop: 500 }}>
      <ReadingOptions />
    </div>,
  );
  const aa = screen.getByRole('button', { name: 'Reading options' });
  await userEvent.click(aa);
  const popup = await settled(await screen.findByTestId('text-view-options-popup'));
  return { aa, popup };
}

describe('ReadingOptions', () => {
  it('steps the size between 15 and 28 and stops at the ends', async () => {
    const { popup } = await open();
    expect(within(popup).getByTestId('text-view-size')).toHaveTextContent('18');
    await userEvent.click(within(popup).getByRole('button', { name: 'Larger text' }));
    expect(within(popup).getByTestId('text-view-size')).toHaveTextContent('20');
    act(() => useReadingPrefs.setState({ size: 0 }));
    expect(within(popup).getByRole('button', { name: 'Smaller text' })).toBeDisabled();
    act(() => useReadingPrefs.setState({ size: 6 }));
    expect(within(popup).getByRole('button', { name: 'Larger text' })).toBeDisabled();
  });

  it('chooses spacing and theme, and keeps them on the device', async () => {
    const { popup } = await open();
    await userEvent.click(within(popup).getByRole('radio', { name: 'Loose' }));
    await userEvent.click(within(popup).getByRole('radio', { name: 'Dark' }));
    // The Typeface row is gated off (DSN-84, pending the owner's face answer).
    expect(within(popup).queryByRole('radio', { name: 'Serif' })).toBeNull();
    expect(useReadingPrefs.getState()).toMatchObject({
      spacing: 'loose',
      theme: 'dark',
    });
    expect(JSON.parse(localStorage.getItem(READING_PREFS_KEY) ?? '{}')).toMatchObject({
      spacing: 'loose',
      theme: 'dark',
    });
  });

  it('takes the arrow keys on a row, closes on Escape and returns focus to Aa', async () => {
    const { aa, popup } = await open();
    within(popup).getByRole('radio', { name: 'Normal' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(useReadingPrefs.getState().spacing).toBe('loose');
    await userEvent.keyboard('{Escape}');
    await expect.poll(() => screen.queryByTestId('text-view-options-popup')).toBeNull();
    expect(aa).toHaveFocus();
  });
});

describe('pinchStep', () => {
  it('is one step per ×1.15 of spread, in either direction', () => {
    expect(pinchStep(100, 116)).toBe(1);
    expect(pinchStep(100, 110)).toBe(0);
    expect(pinchStep(100, 86)).toBe(-1);
    expect(pinchStep(100, 90)).toBe(0);
    expect(pinchStep(0, 90)).toBe(0);
  });
});

/**
 * The scrubber's slider (08-feedback FB7, coarse pointers) on its own: the keys preview and
 * never keep, Enter keeps, Cancel cancels, the value is spoken as the step. The coarse density
 * itself is not emulated in browser mode (ui/test-states.ts); `e2e/history.spec.ts` drives the
 * slider on the `tablet` project.
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { cleanup, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { HistorySlider } from './HistorySlider';
import type { ScrubberStep } from './labels';

afterEach(cleanup);

const steps: ScrubberStep[] = [1, 2, 3, 4].map((index) => ({
  index,
  state: index < 4 ? 'past' : 'present',
  label: `Step ${index}`,
  time: `14:0${index}`,
  name: `Step ${index}, 14:0${index}`,
  phrase: `step ${index}`,
}));

function Harness({ onKeep, onCancel }: { onKeep: (i: number) => void; onCancel: () => void }) {
  const [active, setActive] = useState(4);
  return (
    <HistorySlider
      steps={steps}
      active={active}
      onActiveChange={setActive}
      onKeep={onKeep}
      onCancel={onCancel}
    />
  );
}

describe('HistorySlider', () => {
  it('steps with the arrows without keeping, keeps on Enter, says the step', async () => {
    const onKeep = vi.fn();
    const onCancel = vi.fn();
    render(<Harness onKeep={onKeep} onCancel={onCancel} />);
    const slider = screen.getByRole('slider', { name: 'History step' });
    expect(slider).toHaveAttribute('aria-valuetext', 'step 4');
    expect(screen.getByText('4 of 4')).toBeVisible();
    slider.focus();
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(slider).toHaveAttribute('aria-valuetext', 'step 2');
    expect(screen.getByText('2 of 4')).toBeVisible();
    expect(onKeep).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    expect(onKeep).toHaveBeenCalledWith(2);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

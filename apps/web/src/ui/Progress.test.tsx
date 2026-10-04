import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setLocale } from '../i18n';
import { Activity, ACTIVITY_DELAY_MS } from './Activity';
import { EmptyNote } from './EmptyNote';
import { Progress, PROGRESS_THROTTLE_MS } from './Progress';
import { devtools } from './test-states';

afterEach(async () => {
  vi.useRealTimers();
  setLocale('en');
  await devtools('Emulation.setEmulatedMedia', { features: [] });
});

describe('Progress (09-primitives §24)', () => {
  it('is a progressbar named by its label, valued in words, with a 4 px neutral fill', () => {
    render(<Progress value={40} label="Exporting…" />);
    const bar = screen.getByRole('progressbar', { name: 'Exporting…' });
    expect(bar).toHaveAttribute('aria-valuenow', '40');
    expect(bar).toHaveAttribute('aria-valuetext', '40 percent');
    expect(screen.getByText('40%')).toBeVisible();
    const fill = bar.querySelector('[class*="fill"]') as HTMLElement;
    expect(fill.parentElement?.getBoundingClientRect().height).toBe(4);
    expect(getComputedStyle(fill).backgroundColor).toBe('rgb(230, 231, 234)');
    expect(fill.style.transform).toBe('scaleX(0.4)');
  });

  it('puts the Turkish percent sign first', () => {
    setLocale('tr');
    render(<Progress value={40} label="Dışa aktarılıyor…" />);
    expect(screen.getByText('%40')).toBeVisible();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'yüzde 40');
  });

  it('updates no faster than every 200 ms, and the last value lands', () => {
    vi.useFakeTimers();
    const { rerender } = render(<Progress value={10} label="Exporting…" />);
    const bar = screen.getByRole('progressbar');
    rerender(<Progress value={20} label="Exporting…" />);
    rerender(<Progress value={30} label="Exporting…" />);
    expect(bar).toHaveAttribute('aria-valuenow', '10');
    act(() => {
      vi.advanceTimersByTime(PROGRESS_THROTTLE_MS);
    });
    expect(bar).toHaveAttribute('aria-valuenow', '30');
  });

  it('sweeps a segment while indeterminate, and pulses it under reduced motion', async () => {
    render(<Progress value={null} label="Preparing…" />);
    const bar = screen.getByRole('progressbar', { name: 'Preparing…' });
    expect(bar).toHaveAttribute('data-indeterminate');
    const fill = bar.querySelector('[class*="fill"]') as HTMLElement;
    expect(getComputedStyle(fill).animationName).toContain('sweep');
    await devtools('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    expect(getComputedStyle(fill).animationName).toContain('pulse');
    expect(getComputedStyle(fill).animationDuration).toBe('1.6s');
  });
});

describe('Activity glyph (09-primitives §24)', () => {
  it('shows nothing for 400 ms, then a decorative 16 px glyph that turns', () => {
    vi.useFakeTimers();
    const { container } = render(<Activity />);
    expect(container.querySelector('svg')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(ACTIVITY_DELAY_MS);
    });
    const glyph = container.querySelector('svg') as SVGElement;
    expect(glyph).toHaveAttribute('aria-hidden', 'true');
    expect(glyph.getBoundingClientRect().width).toBe(16);
    expect(getComputedStyle(glyph).animationName).toContain('spin');
  });

  it('pulses instead of turning under reduced motion', async () => {
    await devtools('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    const { container } = render(<Activity delay={0} size="md" />);
    const glyph = container.querySelector('svg') as SVGElement;
    expect(glyph.getBoundingClientRect().width).toBe(20);
    expect(getComputedStyle(glyph).animationName).toContain('pulse');
  });
});

describe('EmptyNote (09-primitives §22)', () => {
  it('shows a title and a line, centred, with an optional quiet action', () => {
    let clicked = 0;
    render(
      <EmptyNote
        title="No comments"
        body="Select text to comment on it."
        action={{ label: 'Recognize text…', onClick: () => (clicked += 1) }}
      />,
    );
    const title = screen.getByText('No comments');
    expect(getComputedStyle(title).color).toBe('rgb(230, 231, 234)');
    expect(getComputedStyle(title.parentElement as Element).textAlign).toBe('center');
    screen.getByRole('button', { name: 'Recognize text…' }).click();
    expect(clicked).toBe(1);
  });

  it('is a live status only when it replaces results', () => {
    render(<EmptyNote title="No matches in report.pdf" status />);
    expect(screen.getByRole('status')).toHaveTextContent('No matches in report.pdf');
  });
});

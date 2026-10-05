import '../styles/tokens.css';
import '../styles/global.css';

import { act, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import { Segmented, SegmentedPanel, segmentedLayout } from './Segmented';

type View = 'grid' | 'spectrum' | 'sliders';

const VIEWS = [
  { value: 'grid', label: 'Grid' },
  { value: 'spectrum', label: 'Spectrum' },
  { value: 'sliders', label: 'Sliders' },
] as const;

function Host({
  width = 300,
  zoom,
  semantics,
  options = VIEWS,
}: {
  width?: number;
  zoom?: number;
  semantics?: 'radio' | 'tabs';
  options?: readonly { value: View; label: string; disabled?: boolean; reason?: string }[];
}) {
  const [v, setV] = useState<View>('grid');
  return (
    <div style={{ width, ...(zoom ? { zoom } : {}) }}>
      <Segmented
        label="View"
        value={v}
        onValueChange={setV}
        options={options}
        semantics={semantics}
      >
        {semantics === 'tabs'
          ? options.map((o) => (
              <SegmentedPanel key={o.value} value={o.value}>
                {`${o.label} panel`}
              </SegmentedPanel>
            ))
          : null}
      </Segmented>
      <output data-testid="value">{v}</output>
    </div>
  );
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 500));

function thumbOf(group: HTMLElement): HTMLElement {
  return group.querySelector<HTMLElement>(':scope > span[aria-hidden="true"]')!;
}

function expectOver(thumb: HTMLElement, segment: HTMLElement) {
  const t = thumb.getBoundingClientRect();
  const s = segment.getBoundingClientRect();
  expect(t.left).toBeCloseTo(s.left, 1);
  expect(t.width).toBeCloseTo(s.width, 1);
}

describe('segmentedLayout', () => {
  it('shares equally while the widest fits, then sizes to content, then becomes a Select', () => {
    expect(segmentedLayout([60, 80, 70], 300)).toBe('equal');
    expect(segmentedLayout([60, 160, 70], 300)).toBe('content');
    expect(segmentedLayout([120, 160, 70], 300)).toBe('select');
  });

  it('keeps equal shares while the widest label has 8 px either side (72 · 150 · 300 · Custom)', () => {
    // Measured with 12 px a side: "Custom" is 73.5 wide, four shares of 66.5 hold it at 8.
    expect(segmentedLayout([39.9, 46.4, 49.8, 73.5], 266)).toBe('equal');
    expect(segmentedLayout([39.9, 46.4, 49.8, 76], 266)).toBe('content');
  });
});

describe('Segmented, radio semantics', () => {
  it('is a 32 px radio group whose thumb sits on the choice, after the spring settles', async () => {
    render(<Host />);
    const group = screen.getByRole('radiogroup', { name: 'View' });
    expect(group.getBoundingClientRect().height).toBe(32);
    const thumb = thumbOf(group);
    expectOver(thumb, screen.getByRole('radio', { name: 'Grid' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Sliders' }));
    expect(screen.getByRole('radio', { name: 'Sliders' })).toHaveAttribute('aria-checked', 'true');
    await settle();
    expectOver(thumb, screen.getByRole('radio', { name: 'Sliders' }));
    // At rest the thumb carries no transform (Q-2): layout alone placed it.
    expect(getComputedStyle(thumb).transform).toBe('none');
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByTestId('value').textContent).toBe('spectrum');
  });

  it('places the thumb exactly under CSS zoom (2×), where measured offsets used to miss', async () => {
    render(<Host zoom={2} />);
    const group = screen.getByRole('radiogroup', { name: 'View' });
    await userEvent.click(screen.getByRole('radio', { name: 'Spectrum' }));
    await settle();
    expectOver(thumbOf(group), screen.getByRole('radio', { name: 'Spectrum' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Sliders' }));
    await settle();
    expectOver(thumbOf(group), screen.getByRole('radio', { name: 'Sliders' }));
  });

  it('moves the thumb by transform only while it springs over', async () => {
    render(<Host />);
    const group = screen.getByRole('radiogroup', { name: 'View' });
    const thumb = thumbOf(group);
    const before = thumb.getBoundingClientRect().width;
    await userEvent.click(screen.getByRole('radio', { name: 'Sliders' }));
    const animations = thumb.getAnimations();
    expect(animations.length).toBe(1);
    // Mid-flight its layout box is already the target's; only the transform moves.
    expect(thumb.offsetWidth).toBeCloseTo(before, 0);
    await settle();
    expect(thumb.getAnimations().length).toBe(0);
  });

  it('sizes long labels to their content, then falls back to a Select when they overflow', async () => {
    const long = [
      { value: 'grid', label: 'Grid' },
      { value: 'spectrum', label: 'A much longer spectrum label' },
      { value: 'sliders', label: 'Sliders' },
    ] as const;
    const { rerender } = render(<Host width={400} options={long} />);
    const group = screen.getByRole('radiogroup', { name: 'View' });
    expect(group).toHaveAttribute('data-layout', 'content');
    const grid = screen.getByRole('radio', { name: 'Grid' }).getBoundingClientRect().width;
    const spectrum = screen
      .getByRole('radio', { name: 'A much longer spectrum label' })
      .getBoundingClientRect().width;
    expect(spectrum).toBeGreaterThan(grid);
    rerender(<Host width={200} options={long} />);
    await act(() => settle());
    expect(screen.queryByRole('radiogroup')).toBeNull();
    const select = screen.getByRole('combobox', { name: 'View' });
    expect(select).toHaveTextContent('Grid');
    await userEvent.click(select);
    await userEvent.click(await screen.findByRole('option', { name: 'Sliders' }));
    expect(screen.getByTestId('value').textContent).toBe('sliders');
    // Room again: back to segments, with the thumb on the choice.
    rerender(<Host width={400} options={long} />);
    await act(() => settle());
    const back = screen.getByRole('radiogroup', { name: 'View' });
    expectOver(thumbOf(back), screen.getByRole('radio', { name: 'Sliders' }));
  });

  it('describes a disabled segment by its reason', () => {
    render(
      <Host
        options={[
          { value: 'grid', label: 'This document' },
          {
            value: 'spectrum',
            label: 'All open',
            disabled: true,
            reason: 'open a second document',
          },
        ]}
      />,
    );
    const all = screen.getByRole('radio', { name: 'All open' });
    expect(all).toHaveAttribute('data-disabled');
    expect(all).toHaveAccessibleDescription('open a second document');
  });

  it('lets a finger drag the thumb across segments, committing on release', async () => {
    render(<Host />);
    const group = screen.getByRole('radiogroup', { name: 'View' });
    const from = screen.getByRole('radio', { name: 'Grid' }).getBoundingClientRect();
    const to = screen.getByRole('radio', { name: 'Sliders' }).getBoundingClientRect();
    const y = from.top + from.height / 2;
    const fire = (type: string, x: number, target: Element) =>
      act(() => {
        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            pointerId: 7,
            pointerType: 'touch',
            isPrimary: true,
            button: 0,
            buttons: type === 'pointerup' ? 0 : 1,
          }),
        );
      });
    const grid = screen.getByRole('radio', { name: 'Grid' });
    fire('pointerdown', from.left + 10, grid);
    fire('pointermove', from.left + 40, grid);
    fire('pointermove', to.left + 20, group);
    // Not chosen until release.
    expect(screen.getByTestId('value').textContent).toBe('grid');
    fire('pointerup', to.left + 20, group);
    expect(screen.getByTestId('value').textContent).toBe('sliders');
    await settle();
    expectOver(thumbOf(group), screen.getByRole('radio', { name: 'Sliders' }));
  });
});

describe('Segmented, tabs semantics', () => {
  it('is a tab list whose arrows move and activate, with its panels', async () => {
    render(<Host semantics="tabs" />);
    const list = screen.getByRole('tablist', { name: 'View' });
    expect(list.getBoundingClientRect().height).toBe(32);
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Grid panel');
    screen.getByRole('tab', { name: 'Grid' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Spectrum' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Spectrum panel');
    await settle();
    expectOver(thumbOf(list), screen.getByRole('tab', { name: 'Spectrum' }));
  });
});

import '../styles/tokens.css';

import { act, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';

import { setLocale } from '../i18n';
import { Slider, type SliderProps } from './Slider';
import { valueToPosition } from './slider-math';

/** Chrome DevTools Protocol, typed loosely (the provider's session type is not exported). */
function devtools(method: string, params: object): Promise<unknown> {
  return (cdp() as unknown as { send(m: string, p: object): Promise<unknown> }).send(
    method,
    params,
  );
}

afterEach(async () => {
  setLocale('en');
  await devtools('Emulation.setEmulatedMedia', { features: [] });
});

type Harness = Omit<SliderProps, 'value' | 'onValueChange'> & {
  readonly initial: number;
  readonly onChange?: (v: number) => void;
};

function Controlled({ initial, onChange, ...props }: Harness) {
  const [value, setValue] = useState(initial);
  return (
    <div style={{ width: 222, margin: '80px 120px' }}>
      <Slider
        {...props}
        value={value}
        onValueChange={(v) => {
          setValue(v);
          onChange?.(v);
        }}
      />
      <output data-testid="value">{value}</output>
    </div>
  );
}

/** A synthetic pointer event; id 0 keeps Base UI from capturing a pointer that is not down. */
function pointer(type: string, target: EventTarget, x: number, y: number, pointerType = 'mouse') {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: x,
      clientY: y,
      pointerId: 0,
      pointerType,
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
    }),
  );
}

function geometry() {
  const root = document.querySelector<HTMLElement>('[data-track]')!;
  const thumb = root.querySelector<HTMLElement>('[data-slider-thumb]')!;
  const ctl = thumb.parentElement!;
  const rect = ctl.getBoundingClientRect();
  const pad = Number.parseFloat(getComputedStyle(ctl).paddingLeft);
  return {
    root,
    thumb,
    control: ctl,
    y: rect.top + rect.height / 2,
    /** Client x of a knob position (0–1). */
    x: (t: number) => rect.left + pad + t * (rect.width - 2 * pad),
  };
}

const value = () => Number(screen.getByTestId('value').textContent);

describe('Slider', () => {
  it('is a labelled slider that speaks its value with the unit', () => {
    render(
      <Controlled
        initial={1.5}
        min={0.25}
        max={24}
        scale="log"
        label="Width"
        format={(v) => `${v} pt`}
        valueText={(v) => `${v} points`}
        readout
      />,
    );
    const slider = screen.getByRole('slider', { name: 'Width' });
    expect(slider).toHaveAttribute('aria-valuetext', '1.5 points');
  });

  it('commits once per drag, after live changes', () => {
    const committed = vi.fn();
    const changed = vi.fn();
    render(
      <Controlled
        initial={20}
        min={0}
        max={100}
        label="Opacity"
        onChange={changed}
        onValueCommitted={committed}
      />,
    );
    const g = geometry();
    act(() => {
      pointer('pointerdown', g.thumb, g.x(0.2), g.y);
      for (const t of [0.3, 0.4, 0.5, 0.6]) pointer('pointermove', document, g.x(t), g.y);
      pointer('pointerup', document, g.x(0.6), g.y);
    });
    expect(changed.mock.calls.length).toBeGreaterThan(1);
    expect(committed).toHaveBeenCalledTimes(1);
    expect(committed).toHaveBeenCalledWith(60);
    expect(value()).toBe(60);
  });

  it('springs to a track press and commits it once', () => {
    const committed = vi.fn();
    render(<Controlled initial={10} min={0} max={100} label="Size" onValueCommitted={committed} />);
    const g = geometry();
    act(() => {
      pointer('pointerdown', g.control, g.x(0.8), g.y);
    });
    expect(g.root.dataset.jump).toBe('spring');
    act(() => {
      pointer('pointerup', document, g.x(0.8), g.y);
    });
    expect(value()).toBe(80);
    expect(committed).toHaveBeenCalledTimes(1);
  });

  it('snaps to a detent within 4 px for a mouse', () => {
    render(
      <Controlled
        initial={0.5}
        min={0.25}
        max={24}
        scale="log"
        detents={[0.5, 1, 1.5, 2, 3, 5, 8, 12]}
        track="taper"
        label="Width"
      />,
    );
    const g = geometry();
    const at = valueToPosition(1.5, { min: 0.25, max: 24, scale: 'log' });
    act(() => {
      pointer('pointerdown', g.control, g.x(at) - 3, g.y);
      pointer('pointerup', document, g.x(at) - 3, g.y);
    });
    expect(value()).toBe(1.5);
  });

  it('steps with the keys: one step, ten with Shift and PageUp, the ends with Home and End', async () => {
    const committed = vi.fn();
    render(<Controlled initial={50} min={0} max={100} label="Hue" onValueCommitted={committed} />);
    screen.getByRole('slider').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(value()).toBe(51);
    await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    expect(value()).toBe(41);
    await userEvent.keyboard('{PageUp}');
    expect(value()).toBe(51);
    await userEvent.keyboard('{End}');
    expect(value()).toBe(100);
    await userEvent.keyboard('{Home}');
    expect(value()).toBe(0);
    expect(committed).toHaveBeenCalledTimes(5);
  });

  it('moves a width to the next detent with an arrow', async () => {
    render(
      <Controlled
        initial={1.5}
        min={0.25}
        max={24}
        scale="log"
        detents={[0.5, 1, 1.5, 2, 3, 5, 8, 12]}
        track="taper"
        label="Width"
      />,
    );
    screen.getByRole('slider').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(value()).toBe(2);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(value()).toBe(1);
  });

  it('turns the held knob into a lens, and not with reduced motion', async () => {
    render(<Controlled initial={40} min={0} max={100} label="Size" />);
    let g = geometry();
    act(() => {
      pointer('pointerdown', g.thumb, g.x(0.4), g.y);
    });
    expect(g.root).toHaveAttribute('data-lens');
    expect(getComputedStyle(g.thumb.querySelector('[class*="lens"]')!).display).toBe('block');
    act(() => {
      pointer('pointerup', document, g.x(0.4), g.y);
    });
    expect(g.root).not.toHaveAttribute('data-lens');

    await devtools('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    g = geometry();
    act(() => {
      pointer('pointerdown', g.thumb, g.x(0.4), g.y);
      pointer('pointermove', document, g.x(1) + 60, g.y);
    });
    expect(g.root).not.toHaveAttribute('data-lens');
    expect(g.root.style.getPropertyValue('--slider-stretch')).toBe('');
    act(() => {
      pointer('pointerup', document, g.x(1), g.y);
    });
  });

  it('stretches past the end by at most 6 px and springs back on release', () => {
    render(<Controlled initial={90} min={0} max={100} label="Size" />);
    const g = geometry();
    act(() => {
      pointer('pointerdown', g.thumb, g.x(0.9), g.y);
      pointer('pointermove', document, g.x(1) + 400, g.y);
    });
    const share = Number(g.root.style.getPropertyValue('--slider-stretch'));
    const width = g.control.getBoundingClientRect().width;
    expect(share * width).toBeGreaterThan(4);
    expect(share * width).toBeLessThanOrEqual(6);
    act(() => {
      pointer('pointerup', document, g.x(1) + 400, g.y);
    });
    expect(g.root.style.getPropertyValue('--slider-stretch')).toBe('0');
    expect(g.root).toHaveAttribute('data-release');
  });

  it('keeps the bubble inside the viewport at the edge', () => {
    render(
      <div style={{ position: 'fixed', left: 0, top: 120, width: 160 }}>
        <Slider
          value={0}
          min={0}
          max={100}
          label="Edge"
          bubble="always"
          format={(v) => `${v} %%%%`}
        />
      </div>,
    );
    const g = geometry();
    act(() => {
      pointer('pointerdown', g.thumb, g.x(0), g.y);
    });
    const bubble = g.thumb.querySelector<HTMLElement>('[aria-hidden="true"][class*="bubble"]')!;
    expect(bubble).toBeTruthy();
    expect(bubble.getBoundingClientRect().left).toBeGreaterThanOrEqual(7.5);
    act(() => {
      pointer('pointerup', document, g.x(0), g.y);
    });
  });

  it('shows the bubble for touch only when a readout sits beside it (auto)', () => {
    render(<Controlled initial={50} min={0} max={100} label="Size" readout />);
    const g = geometry();
    const bubble = () => g.thumb.querySelector('[class*="bubble"]');
    act(() => {
      pointer('pointerdown', g.thumb, g.x(0.5), g.y, 'mouse');
    });
    expect(bubble()).toBeNull();
    act(() => {
      pointer('pointerup', document, g.x(0.5), g.y, 'mouse');
      pointer('pointerdown', g.thumb, g.x(0.5), g.y, 'touch');
    });
    expect(bubble()).not.toBeNull();
    act(() => {
      pointer('pointerup', document, g.x(0.5), g.y, 'touch');
    });
  });

  it('is 32 px tall with a 22 px knob on a fine pointer, and 44 / 28 on a coarse one', async () => {
    render(<Controlled initial={50} min={0} max={100} label="Size" />);
    let g = geometry();
    expect(g.control.getBoundingClientRect().height).toBe(32);
    expect(g.thumb.getBoundingClientRect().width).toBe(22);
    await devtools('Emulation.setTouchEmulationEnabled', {
      enabled: true,
      maxTouchPoints: 5,
    });
    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      g = geometry();
      expect(g.control.getBoundingClientRect().height).toBe(44);
      expect(g.thumb.getBoundingClientRect().width).toBe(28);
    } finally {
      await devtools('Emulation.setTouchEmulationEnabled', { enabled: false });
    }
  });

  it('formats in the active language', () => {
    setLocale('tr');
    render(<Slider value={1.5} min={0.25} max={24} scale="log" label="Kalınlık" readout />);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '1,5');
  });
});

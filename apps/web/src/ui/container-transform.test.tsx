/**
 * Things come out of the control you pressed and go back into it (motion-2026-10/platform.md
 * §1): a menu grows from its trigger and closes back into it, which then takes it in with the
 * *receive* pulse; the trigger stays pressed while it is open; a keyboard-opened menu and the
 * menu → sheet hand-off skip the motion; a side sheet opened from a button comes out of it and
 * goes back into it.
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { Menu } from '@base-ui/react/menu';
import { act, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { EXIT_TIMEOUT, settled } from '../../test/settled';
import { installContainerTransform } from './container-transform';
import menuStyles from './Menu.module.css';
import { resetPressOrigin } from './press-origin';
import { Sheet } from './sheet/Sheet';
import { useSheetStore } from './sheet/sheet-store';

installContainerTransform();

const props = (el: Element) =>
  new Set(
    el
      .getAnimations()
      .flatMap((a) => (a.effect as KeyframeEffect).getKeyframes())
      .flatMap((k) => Object.keys(k))
      .filter((k) => !['offset', 'computedOffset', 'easing', 'composite'].includes(k)),
  );

beforeEach(async () => {
  resetPressOrigin();
  useSheetStore.setState({ open: null, front: null, confirm: null, drafts: {} });
  await page.viewport(1440, 900);
});

afterEach(async () => {
  await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
});

function DocumentMenu() {
  return (
    <div style={{ padding: 80 }}>
      <Menu.Root>
        <Menu.Trigger className="btn btn-quiet">Document</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner sideOffset={8}>
            <Menu.Popup className={menuStyles.popup}>
              <Menu.Item className={menuStyles.item}>Rename</Menu.Item>
              <Menu.Item className={menuStyles.item}>Duplicate</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}

describe('a menu (the container transform)', () => {
  it('grows out of its trigger, keeps it pressed, and goes back into it with a pulse', async () => {
    render(<DocumentMenu />);
    const trigger = screen.getByRole('button', { name: 'Document' });
    await userEvent.click(trigger);
    const menu = await screen.findByRole('menu');
    await waitFor(() => expect(menu).toHaveAttribute('data-ct'));
    await waitFor(() => expect(menu.getAnimations().length).toBeGreaterThan(0));
    expect([...props(menu)].sort()).toEqual(['clipPath', 'opacity', 'transform']);
    // The first frame is the trigger's rect: the region's size is the trigger's.
    const first = (menu.getAnimations()[0]?.effect as KeyframeEffect).getKeyframes()[0];
    const t = trigger.getBoundingClientRect();
    const box = (menu.parentElement as HTMLElement).getBoundingClientRect();
    const inset = /inset\(([-\d.]+)px ([-\d.]+)px ([-\d.]+)px ([-\d.]+)px/
      .exec(String(first?.clipPath))
      ?.slice(1)
      .map(Number) as number[];
    expect(box.width - (inset[1] ?? 0) - (inset[3] ?? 0)).toBeCloseTo(
      Math.min(t.width, box.width),
      0,
    );
    expect(box.height - (inset[0] ?? 0) - (inset[2] ?? 0)).toBeCloseTo(t.height, 0);
    expect(trigger).toHaveAttribute('data-popup-open');
    await settled(menu);
    expect(menu.style.cssText).toBe('');

    await userEvent.keyboard('{Escape}');
    // Esc is a dismissal: Base UI closes it at once (`data-instant`), no return.
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());

    // A press elsewhere closes it back into the trigger, which takes it in with the pulse.
    await userEvent.click(trigger);
    const again = await screen.findByRole('menu');
    await settled(again);
    await userEvent.click(document.body, { position: { x: 1000, y: 700 } });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull(), {
      timeout: EXIT_TIMEOUT,
    });
    expect(props(trigger).has('scale')).toBe(true);
    await settled(trigger);
    expect(trigger.getAnimations()).toEqual([]);
  });

  it('under reduced motion only fades, within 150 ms', async () => {
    document.documentElement.dataset.motion = 'reduced';
    try {
      render(<DocumentMenu />);
      await userEvent.click(screen.getByRole('button', { name: 'Document' }));
      const menu = await screen.findByRole('menu');
      await waitFor(() => expect(menu.getAnimations().length).toBeGreaterThan(0));
      expect([...props(menu)]).toEqual(['opacity']);
      for (const a of menu.getAnimations()) {
        expect(Number(a.effect?.getTiming().duration)).toBeLessThanOrEqual(150);
      }
    } finally {
      delete document.documentElement.dataset.motion;
    }
  });
});

function ToolSheet() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ padding: 80 }}>
      <button type="button" className="btn btn-quiet" onClick={() => setOpen(true)}>
        Crop
      </button>
      <Sheet id="crop" kind="tool" open={open} onClose={() => setOpen(false)} title="Crop">
        <p>Drag the edges.</p>
      </Sheet>
    </div>
  );
}

describe('a side sheet from a button', () => {
  it('comes out of the button at a uniform scale, and goes back into it', async () => {
    render(<ToolSheet />);
    const button = screen.getByRole('button', { name: 'Crop' });
    await userEvent.click(button);
    const panel = await screen.findByRole('dialog', { name: 'Crop' });
    await waitFor(() => expect(panel.getAnimations().length).toBeGreaterThan(0));
    const frames = panel
      .getAnimations()
      .map((a) => (a.effect as KeyframeEffect).getKeyframes())
      .find((k) => 'transform' in (k[0] ?? {}));
    // translate(x, y) scale(s, s): from a small uniform scale near the button.
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([\d.]+), ([\d.]+)\)/.exec(
      String(frames?.[0]?.transform),
    );
    expect(m).not.toBeNull();
    expect(Number(m?.[3])).toBeLessThan(0.3);
    expect(m?.[3]).toBe(m?.[4]);
    expect(button).toHaveAttribute('data-origin-open');
    await settled(panel);
    expect(panel.style.transform).toBe('');

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(button).not.toHaveAttribute('data-origin-open'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), {
      timeout: EXIT_TIMEOUT,
    });
  });
});

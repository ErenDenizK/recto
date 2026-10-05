/**
 * The menu recipe in a real browser (`ui/Menu.module.css`; quality-bar Q-7; XD-3):
 *
 * - a menu taller than the room Base UI's positioner has stays inside the window and scrolls
 *   in its glass, and the keyboard's row scrolls into view;
 * - the menu → sheet hand-off (`ui/menu-handoff.ts`): an item that opens a sheet closes its
 *   menu at once, while an item that opens nothing still fades it out.
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { Menu } from '@base-ui/react/menu';
import { act, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import menuStyles from './Menu.module.css';
import { MENU_HANDOFF_MS } from './menu-handoff';
import { Sheet } from './sheet/Sheet';
import { useSheetStore } from './sheet/sheet-store';

const frames = (count: number) =>
  act(
    () =>
      new Promise<void>((resolve) => {
        const step = (left: number) => {
          if (left === 0) resolve();
          else requestAnimationFrame(() => step(left - 1));
        };
        step(count);
      }),
  );

beforeEach(async () => {
  useSheetStore.setState({ open: null, front: null, confirm: null, drafts: {} });
  await page.viewport(1440, 900);
});

afterEach(async () => {
  // Let a hand-off mark from the test before go.
  await act(() => new Promise((resolve) => setTimeout(resolve, MENU_HANDOFF_MS + 20)));
});

function LongMenu({ rows }: { readonly rows: number }) {
  return (
    <Menu.Root>
      <Menu.Trigger>Document</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={4} collisionPadding={8}>
          <Menu.Popup className={menuStyles.popup} aria-label="Document">
            {Array.from({ length: rows }, (_, i) => (
              <Menu.Item key={i} className={menuStyles.item}>
                <span className={menuStyles.label}>Row {i + 1}</span>
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

describe('room: a long menu scrolls inside the window', () => {
  it('is never taller than the window, and the last row scrolls into view', async () => {
    await page.viewport(1440, 400);
    render(<LongMenu rows={30} />);
    await userEvent.click(screen.getByRole('button', { name: 'Document' }));
    const menu = await screen.findByRole('menu', { name: 'Document' });
    await waitFor(() => expect(menu.getAnimations().length).toBe(0));
    const box = menu.getBoundingClientRect();
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.bottom).toBeLessThanOrEqual(400);
    expect(menu.scrollHeight).toBeGreaterThan(menu.clientHeight);
    expect(getComputedStyle(menu).overflowY).toBe('auto');

    // The keyboard: End (or wrapping up) reaches the last row, which comes into view.
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{End}');
    const last = screen.getByRole('menuitem', { name: 'Row 30' });
    await waitFor(() => expect(last).toHaveAttribute('data-highlighted'));
    await waitFor(() => {
      const row = last.getBoundingClientRect();
      const view = menu.getBoundingClientRect();
      expect(row.bottom).toBeLessThanOrEqual(view.bottom + 0.5);
      expect(row.top).toBeGreaterThanOrEqual(view.top - 0.5);
    });
    expect(menu.scrollTop).toBeGreaterThan(0);
  });

  it('a menu that fits does not scroll and shows no edge fade', async () => {
    render(<LongMenu rows={4} />);
    await userEvent.click(screen.getByRole('button', { name: 'Document' }));
    const menu = await screen.findByRole('menu', { name: 'Document' });
    expect(menu.scrollHeight).toBeLessThanOrEqual(menu.clientHeight);
    expect(getComputedStyle(menu, '::before').opacity).toBe('0');
    expect(getComputedStyle(menu, '::after').opacity).toBe('0');
  });
});

function MenuThatOpensASheet() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Menu.Root>
        <Menu.Trigger>File</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner sideOffset={4}>
            <Menu.Popup className={menuStyles.popup} aria-label="File">
              <Menu.Item className={menuStyles.item} onClick={() => setOpen(true)}>
                Save a copy…
              </Menu.Item>
              <Menu.Item className={menuStyles.item}>Nothing</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <Sheet
        id="copy"
        kind="task"
        open={open}
        onClose={() => setOpen(false)}
        title="Save a copy"
        testId="copy-sheet"
      >
        <p>Body</p>
      </Sheet>
    </>
  );
}

describe('the menu → sheet hand-off (Q-7)', () => {
  it('an item that opens a sheet closes the menu at once', async () => {
    render(<MenuThatOpensASheet />);
    await userEvent.click(screen.getByRole('button', { name: 'File' }));
    const menu = await screen.findByRole('menu', { name: 'File' });
    await waitFor(() => expect(menu.getAnimations().length).toBe(0));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Save a copy…' }));
    expect(document.documentElement.hasAttribute('data-menu-handoff')).toBe(true);
    // Two frames: Base UI's ending style, then the unmount; no 120 ms fade over the sheet.
    await frames(3);
    expect(screen.queryByRole('menu', { name: 'File' })).toBeNull();
    expect(document.querySelector('[data-testid="copy-sheet"]')).not.toBeNull();
  });

  it('an item that opens nothing still fades its menu out', async () => {
    render(<MenuThatOpensASheet />);
    await userEvent.click(screen.getByRole('button', { name: 'File' }));
    const menu = await screen.findByRole('menu', { name: 'File' });
    await waitFor(() => expect(menu.getAnimations().length).toBe(0));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Nothing' }));
    await frames(2);
    expect(document.documentElement.hasAttribute('data-menu-handoff')).toBe(false);
    expect(menu.getAnimations().length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.queryByRole('menu', { name: 'File' })).toBeNull());
  });
});

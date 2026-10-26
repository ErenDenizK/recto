/**
 * The single capsule's tray (CapsuleTray.tsx, TextTray.tsx, SignTray; EDN-24): what each tool's
 * tray holds, the Eraser at the end of Pen's and Highlight's, the Edit text switch, Sign's
 * sideways plates with New pinned, and the ways it closes (Esc with focus back on the armed tool,
 * a swipe down). Nothing is left inline at rest, and reduced motion is a fade.
 */
import '../../../styles/tokens.css';
import '../../../styles/reset.css';
import '../../../styles/global.css';

import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetAnnotationStore } from '../../../annotations/annotation-store';
import {
  memorySignatureBackend,
  setSignatureBackend,
  type SavedSignature,
} from '../../../signatures/saved-signatures';
import { resetToolStore } from '../../../viewer/tool-store';
import { settled } from '../../../../test/settled';
import { resetCompactStore, setTyping, useCompactStore } from '../compact-store';
import { CapsuleTray } from './CapsuleTray';
import { resetBridge } from './bridge';
import { SignTray } from './sign-options';
import './tools';
import './text-tool';
import './edit-text';

const compact = () => useCompactStore.getState();

/** The armed tool's button, as the capsule draws it. */
function Armed() {
  return (
    <button type="button" data-compact-tool-chip="">
      Armed
    </button>
  );
}

function arm(tool: 'pen' | 'highlight' | 'text' | 'edit-text' | 'eraser' | 'sign' | null) {
  act(() => useCompactStore.setState({ editing: true, tool, trayOpen: tool !== null }));
}

beforeEach(() => {
  resetAnnotationStore();
  resetToolStore();
  resetBridge();
  resetCompactStore();
});

afterEach(() => {
  cleanup();
  resetCompactStore();
  delete document.documentElement.dataset.motion;
});

const tray = () => screen.getByRole('toolbar');

describe('what each tray holds', () => {
  it('Pen: its colours and sizes, then the Eraser, in a 324 × 56 px toolbar', async () => {
    arm('pen');
    render(<CapsuleTray />);
    const bar = await settled(await screen.findByRole('toolbar', { name: 'Pen options' }));
    expect(bar.id).toBe('compact-tool-tray');
    expect(bar.hasAttribute('data-compact-chrome')).toBe(true);
    expect(bar.hasAttribute('data-annotation-keep')).toBe(true);
    expect(bar.hasAttribute('data-compact-above-capsule')).toBe(true);
    const box = bar.getBoundingClientRect();
    expect([box.width, box.height]).toEqual([324, 56]);
    expect(within(bar).getAllByRole('radio')).toHaveLength(6);
    const buttons = within(bar).getAllByRole('button');
    expect(buttons.at(-1)?.getAttribute('aria-label')).toBe('Eraser');
  });

  it('Highlight ends with the Eraser too, Text does not', async () => {
    arm('highlight');
    render(<CapsuleTray />);
    expect(await screen.findByRole('button', { name: 'Eraser' })).toBeTruthy();
    arm('text');
    await waitFor(() => expect(screen.getByRole('toolbar', { name: 'Text options' })).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Eraser' })).toBeNull();
  });

  it('the Eraser takes over and the tray stays the pressed tool’s', async () => {
    arm('pen');
    render(<CapsuleTray />);
    const eraser = await screen.findByRole('button', { name: 'Eraser' });
    act(() => eraser.click());
    expect(compact().tool).toBe('eraser');
    expect(screen.getByRole('toolbar', { name: 'Pen options' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Eraser' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    act(() => screen.getByRole('button', { name: 'Eraser' }).click());
    expect(compact().tool).toBe('pen');
  });

  it('Text: the Edit text switch, then the options; on, the hint takes their place', async () => {
    arm('text');
    render(<CapsuleTray />);
    const toggle = await screen.findByRole('switch', { name: 'Edit text' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(within(tray()).getAllByRole('radio')).toHaveLength(6);
    act(() => toggle.click());
    expect(compact().tool).toBe('edit-text');
    expect(screen.getByRole('toolbar', { name: 'Text options' })).toBeTruthy();
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByText('Tap a paragraph to change its text.')).toBeTruthy();
    act(() => screen.getByRole('switch').click());
    expect(compact().tool).toBe('text');
    expect(screen.getAllByRole('radio')).toHaveLength(6);
  });

  it('a new tool fades the content over and the tray stays', async () => {
    arm('pen');
    render(<CapsuleTray />);
    await settled(await screen.findByRole('toolbar', { name: 'Pen options' }));
    const bar = tray();
    arm('highlight');
    await waitFor(() =>
      expect(screen.getByRole('toolbar').getAttribute('aria-label')).toBe('Highlight options'),
    );
    expect(tray()).toBe(bar);
  });

  it('shows only while editing with a tool and the tray open, and not while typing', async () => {
    render(<CapsuleTray />);
    expect(screen.queryByRole('toolbar')).toBeNull();
    arm('pen');
    await screen.findByRole('toolbar');
    act(() => setTyping(true));
    await waitFor(() => expect(screen.queryByRole('toolbar')).toBeNull());
    act(() => setTyping(false));
    await screen.findByRole('toolbar');
  });

  it('leaves nothing inline at rest', async () => {
    arm('pen');
    render(<CapsuleTray />);
    const bar = await settled(await screen.findByRole('toolbar'));
    await waitFor(() => expect(bar.hasAttribute('data-glass-settle')).toBe(false));
    expect(bar.getAttribute('style') ?? '').toBe('');
    expect(bar.hasAttribute('data-glass-moving')).toBe(false);
    // The content's entrance is a fade with no wait: the whole of it ends within 150 ms.
    const ends =
      bar
        .querySelectorAll('div')[0]
        ?.getAnimations()
        .map((a) => Number(a.effect?.getComputedTiming().endTime ?? 0)) ?? [];
    expect(Math.max(0, ...ends)).toBeLessThanOrEqual(150);
  });
});

describe('closing', () => {
  it('Esc closes the tray and puts focus back on the armed tool', async () => {
    arm('pen');
    render(
      <>
        <Armed />
        <CapsuleTray />
      </>,
    );
    const bar = await settled(await screen.findByRole('toolbar'));
    within(bar).getAllByRole('radio')[0]?.focus();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    });
    expect(compact().trayOpen).toBe(false);
    expect(compact().tool).toBe('pen');
    expect(document.activeElement).toBe(screen.getByText('Armed'));
    await waitFor(() => expect(screen.queryByRole('toolbar')).toBeNull());
  });

  const pointer = (type: string, y: number, t: number) => {
    const event = new PointerEvent(type, {
      pointerId: 7,
      isPrimary: true,
      bubbles: true,
      clientX: 100,
      clientY: y,
    });
    Object.defineProperty(event, 'timeStamp', { value: t });
    return event;
  };

  it('a long swipe down follows the finger and closes it', async () => {
    arm('pen');
    render(<CapsuleTray />);
    const bar = await settled(await screen.findByRole('toolbar'));
    bar.setPointerCapture = () => undefined;
    act(() => {
      bar.dispatchEvent(pointer('pointerdown', 100, 0));
      bar.dispatchEvent(pointer('pointermove', 120, 20));
      bar.dispatchEvent(pointer('pointermove', 150, 40));
    });
    expect(bar.style.translate).toBe('0px 50px');
    act(() => {
      bar.dispatchEvent(pointer('pointerup', 190, 60));
    });
    expect(compact().trayOpen).toBe(false);
    await waitFor(() => expect(screen.queryByRole('toolbar')).toBeNull());
  });

  it('a short, slow swipe springs back and the tray stays open', async () => {
    arm('pen');
    render(<CapsuleTray />);
    const bar = await settled(await screen.findByRole('toolbar'));
    bar.setPointerCapture = () => undefined;
    act(() => {
      bar.dispatchEvent(pointer('pointerdown', 100, 0));
      bar.dispatchEvent(pointer('pointermove', 112, 400));
      bar.dispatchEvent(pointer('pointerup', 112, 800));
    });
    expect(compact().trayOpen).toBe(true);
    expect(bar.style.translate).toBe('');
  });

  it('is a fade of 150 ms or less under reduced motion', async () => {
    document.documentElement.dataset.motion = 'reduced';
    arm('pen');
    render(<CapsuleTray />);
    const bar = await screen.findByRole('toolbar');
    const run = bar.getAnimations().find((a) => !(a instanceof CSSAnimation));
    expect(Number(run?.effect?.getTiming().duration ?? 0)).toBeLessThanOrEqual(150);
    expect(bar.hasAttribute('data-glass-moving')).toBe(false);
  });
});

describe('Sign’s tray', () => {
  const plate = (id: string, createdAt: number): SavedSignature => ({
    id,
    createdAt,
    name: id,
    kind: 'typed',
    text: id,
  });

  it('scrolls the plates sideways with New pinned at the end', async () => {
    setSignatureBackend(
      memorySignatureBackend(['a', 'b', 'c', 'd', 'e'].map((id, i) => plate(id, i + 1))),
    );
    // In the tray's own row: `CapsuleTray.module.css` sets `flex: none` on its test-id children.
    render(
      <div style={{ width: 324, display: 'flex' }}>
        <div className="row" style={{ display: 'flex', flex: '1 1 0', minWidth: 0 }}>
          <style>{'.row > [data-testid] { flex: none; }'}</style>
          <SignTray />
        </div>
      </div>,
    );
    const group = await screen.findByRole('group', { name: 'Saved signatures' });
    await waitFor(() => expect(group.querySelectorAll('[data-saved-signature]')).toHaveLength(5));
    expect(group.hasAttribute('data-scrolls')).toBe(true);
    expect(group.scrollWidth).toBeGreaterThan(group.clientWidth);
    expect(
      screen.getByTestId('compact-sign-tray').getBoundingClientRect().width,
    ).toBeLessThanOrEqual(324);
    const add = screen.getByRole('button', { name: 'New signature' });
    expect(group.contains(add)).toBe(false);
    expect(add.getBoundingClientRect().left).toBeGreaterThan(
      group.getBoundingClientRect().right - 1,
    );
    setSignatureBackend(undefined);
  });

  it('with none kept shows one "New signature" text button and no hairline', async () => {
    setSignatureBackend(memorySignatureBackend([]));
    const { container } = render(<SignTray />);
    const add = await screen.findByRole('button', { name: 'New signature' });
    expect(add.textContent).toBe('New signature');
    expect(screen.queryByRole('group', { name: 'Saved signatures' })).toBeNull();
    expect(container.querySelector('[aria-hidden="true"]:not(svg)')).toBeNull();
    setSignatureBackend(undefined);
  });
});

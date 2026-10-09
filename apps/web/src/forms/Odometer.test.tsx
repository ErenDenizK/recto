/**
 * The stepper's odometer (motion-2026-10 forms-compact §3): changed slots roll in the
 * direction the number moved, the text stays readable, and reduced motion only fades.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { Odometer } from './Odometer';

let root: Root | null = null;

function mount(text: string): { host: HTMLElement; set: (next: string) => void } {
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<Odometer text={text} />));
  return { host, set: (next) => act(() => root?.render(<Odometer text={next} />)) };
}

/** The first transform keyframe of each running animation under `host`, by glyph text. */
function rolls(host: HTMLElement): Map<string, string> {
  const out = new Map<string, string>();
  for (const glyph of host.querySelectorAll<HTMLElement>('[data-slot] > :first-child')) {
    const first = (
      glyph.getAnimations()[0]?.effect as KeyframeEffect | undefined
    )?.getKeyframes()[0];
    if (first) out.set(glyph.textContent ?? '', String(first.transform ?? first.opacity));
  }
  return out;
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  delete document.documentElement.dataset.motion;
  document.body.replaceChildren();
});

describe('Odometer', () => {
  it('rolls only the changed slots up when the number grows, and keeps the text', () => {
    const { host, set } = mount('3 / 12');
    set('4 / 12');
    const glyphs = [...host.querySelectorAll('[data-slot] > :first-child')];
    expect(glyphs.map((g) => g.textContent).join('')).toBe('4 / 12');
    const rolled = rolls(host);
    expect([...rolled.keys()]).toEqual(['4']);
    expect(rolled.get('4')).toMatch(/^translate\(0px, [1-9][\d.]*px\)/);
    // The leaving digit rides up and out, hidden from assistive technology.
    const ghost = host.querySelector('[aria-hidden="true"]');
    expect(ghost?.textContent).toBe('3');
  });

  it('rolls down when the number shrinks', () => {
    const { host, set } = mount('10 / 12');
    set('9 / 12');
    expect(rolls(host).get('9')).toMatch(/^translate\(0px, -[1-9][\d.]*px\)/);
  });

  it('only fades a changed slot under reduced motion', () => {
    document.documentElement.dataset.motion = 'reduced';
    const { host, set } = mount('3 / 12');
    set('4 / 12');
    expect(rolls(host).get('4')).toBe('0');
    expect(host.querySelector('[aria-hidden="true"]')).toBeNull();
  });
});

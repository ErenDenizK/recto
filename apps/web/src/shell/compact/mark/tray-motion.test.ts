/**
 * The single capsule's tray motion (tray-motion.ts): the frames grow from the origin, a close
 * hands the finger's speed to the spring, nothing is left inline at rest, and reduced motion is
 * a fade of 150 ms or less.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { settled } from '../../../../test/settled';
import { progressFrames } from './drawer-motion';
import { springs } from '../../../motion/springs';
import {
  fadeContent,
  originX,
  TRAY_RISE_PX,
  TRAY_SCALE,
  trayFrame,
  trayMotion,
} from './tray-motion';

function panel(): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:20px;bottom:80px;width:324px;height:56px;';
  document.body.append(el);
  return el;
}

afterEach(() => {
  document.body.replaceChildren();
  delete document.documentElement.dataset.motion;
});

describe('a tool change’s fade', () => {
  it('ends with the content opaque: the fade in drops the fade out’s held frame', async () => {
    const el = panel();
    await fadeContent(el, 'out').finished;
    expect(getComputedStyle(el).opacity).toBe('0');
    await fadeContent(el, 'in').finished;
    expect(getComputedStyle(el).opacity).toBe('1');
  });
});

describe('the tray’s frames', () => {
  it('rise from 12 px below at .92 and settle at the identity, growing from the origin', () => {
    const from = trayFrame(0, '40px');
    expect(from.transform).toBe(`translateY(${TRAY_RISE_PX}.00px) scale(${TRAY_SCALE.toFixed(4)})`);
    expect(from.transformOrigin).toBe('40px 100%');
    expect(from.opacity).toBe('0');
    const rest = trayFrame(1, '40px');
    expect(rest.transform).toBe('translateY(0.00px) scale(1.0000)');
    expect(rest.opacity).toBe('1');
  });

  it('read the origin from --tray-origin-x, else the armed tool’s centre, else the middle', () => {
    const el = panel();
    expect(originX(el)).toBe('50%');
    const tool = document.createElement('button');
    tool.setAttribute('data-compact-tool-chip', '');
    tool.style.cssText = 'position:fixed;left:120px;bottom:20px;width:44px;height:44px;';
    document.body.append(tool);
    expect(originX(el)).toBe('122px');
    el.style.setProperty('--tray-origin-x', '33px');
    expect(originX(el)).toBe('33px');
  });
});

describe('the tray’s spring', () => {
  it('a close thrown at the finger’s speed starts faster than from rest and never overshoots', () => {
    const still = progressFrames(springs.quick, 1, 0, 0).values;
    const thrown = progressFrames(springs.quick, 1, -8, 0).values;
    expect(1 - (thrown[1] ?? 1)).toBeGreaterThan(1 - (still[1] ?? 1));
    expect(thrown.every((q) => q >= 0)).toBe(true);
  });
});

describe('opening and closing', () => {
  it('is solid while it moves and leaves nothing inline at rest', async () => {
    const el = panel();
    const motion = trayMotion(el);
    const opening = motion.to(1);
    expect(el.hasAttribute('data-glass-moving')).toBe(true);
    await opening;
    await settled(el);
    expect(el.getAttribute('style')).not.toMatch(/transform|opacity|translate/);
    expect(el.hasAttribute('data-glass-moving')).toBe(false);
    expect(el.getAnimations()).toHaveLength(0);
  });

  it('follows the finger with translate, and springs back to nothing inline', async () => {
    const el = panel();
    const motion = trayMotion(el);
    await motion.to(1);
    motion.drag(30);
    expect(el.style.translate).toBe('0px 30px');
    motion.release(-200);
    expect(el.style.translate).toBe('');
    await settled(el);
    expect(el.hasAttribute('data-glass-settle') || el.hasAttribute('data-glass-moving')).toBe(
      el.hasAttribute('data-glass-settle'),
    );
  });

  it('is a fade of 150 ms or less under reduced motion', async () => {
    document.documentElement.dataset.motion = 'reduced';
    const el = panel();
    const motion = trayMotion(el);
    const opening = motion.to(1);
    const run = el.getAnimations()[0];
    expect(Number(run?.effect?.getTiming().duration)).toBeLessThanOrEqual(150);
    expect(el.hasAttribute('data-glass-moving')).toBe(false);
    await opening;
    const closing = motion.to(0);
    expect(Number(el.getAnimations()[0]?.effect?.getTiming().duration)).toBeLessThanOrEqual(150);
    await closing;
  });
});

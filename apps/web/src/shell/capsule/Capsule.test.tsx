/**
 * The capsule's morph in Vitest browser mode (spec X1, D2-2; quality-bar Q-2, Q-3, Q-6, Q-10;
 * `03-markup.md` MK-1 §9): one DOM node for every content, its own width and height on a
 * spring inside `contain: layout style` with the filter untouched, the leaving content `inert`
 * and gone once faded, named pieces sliding into their new places, retargeting mid-morph, and a
 * cross-fade only under reduced motion. Synthetic contents of known sizes stand in for the dock
 * and the palette, so the sizes are exact.
 */
import '../../styles/tokens.css';
import '../../styles/reset.css';
import '../../styles/global.css';

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Capsule } from './Capsule';
import type { CapsuleShape } from './capsule-content';

/** A content of `width` × 42 px, with named pieces of 60 px. */
function Content({ shape }: { readonly shape: CapsuleShape }) {
  const pieces: Record<CapsuleShape, readonly string[]> = {
    dock: ['pages', 'markup', 'sign', 'more'],
    locked: ['pages', 'locked', 'more'],
    palette: ['done', 'select', 'pen', 'eraser', 'shapes', 'text', 'note', 'more-tools'],
  };
  return (
    <div role="toolbar" aria-label={shape} style={{ display: 'flex', height: 42 }}>
      {pieces[shape].map((key) => (
        <button
          key={key}
          type="button"
          data-capsule-item={key}
          style={{ width: 60, height: 32, margin: '5px 0', flex: 'none' }}
        >
          {key}
        </button>
      ))}
    </div>
  );
}

function Harness({
  shape,
  morphKey,
}: {
  readonly shape: CapsuleShape;
  readonly morphKey?: string;
}) {
  return (
    <div style={{ position: 'relative', width: 1200, height: 200 }}>
      <div
        style={{
          position: 'absolute',
          inset: 'auto 0 16px 0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Capsule shape={shape} morphKey={morphKey}>
          {(content) => <Content shape={content} />}
        </Capsule>
      </div>
    </div>
  );
}

const capsule = () => document.querySelector<HTMLElement>('[data-capsule]') as HTMLElement;
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** Every Web Animation in the capsule (the morph's own, not CSS transitions). */
const morphs = () =>
  capsule()
    .getAnimations({ subtree: true })
    .filter((a) => !(a instanceof CSSTransition) && !(a instanceof CSSAnimation));
const settle = async () => {
  for (let i = 0; i < 5 && morphs().length > 0; i++) {
    await Promise.all(morphs().map((a) => a.finished.catch(() => undefined)));
    await nextFrame();
  }
};
const width = () => capsule().getBoundingClientRect().width;
/** dock: 4 × 60 + 2 px rim; palette: 8 × 60 + 2. */
const DOCK = 242;
const PALETTE = 482;
const LOCKED = 182;

function setReduced(on: boolean) {
  if (on) document.documentElement.dataset.motion = 'reduced';
  else delete document.documentElement.dataset.motion;
}

afterEach(() => {
  cleanup();
  setReduced(false);
});

describe('capsule', () => {
  it('is one contained glass element with the pill radius and one σ, sized by its content', () => {
    render(<Harness shape="dock" />);
    const el = capsule();
    const style = getComputedStyle(el);
    expect(style.contain).toBe('layout style');
    expect(style.borderTopLeftRadius).toBe('999px');
    expect(style.backdropFilter).toContain('blur(9px)');
    expect(width()).toBeCloseTo(DOCK, 0);
    expect(el.getAttribute('data-region')).toBe('toolbar');
    // No role of its own: the content names itself.
    expect(el.getAttribute('role')).toBeNull();
  });

  it('morphs its own width on a spring, keeps its node and filter, and rests with nothing inline', async () => {
    const { rerender } = render(<Harness shape="dock" />);
    const el = capsule();
    const filter = getComputedStyle(el).backdropFilter;
    rerender(<Harness shape="palette" />);
    // The same element, now the palette, with the dock still there and leaving.
    expect(capsule()).toBe(el);
    expect(el.dataset.capsule).toBe('palette');
    const leaving = el.querySelector<HTMLElement>('[data-capsule-layer="dock"]');
    expect(leaving).toHaveAttribute('data-leaving');
    expect(leaving).toHaveAttribute('inert');
    expect(leaving).toHaveAttribute('aria-hidden', 'true');
    // Its own width moves (Q-6), from the dock's size towards the palette's.
    const sizes = morphs().filter((a) => {
      const frames = (a.effect as KeyframeEffect).getKeyframes();
      return (a.effect as KeyframeEffect).target === el && 'width' in (frames[0] ?? {});
    });
    expect(sizes).toHaveLength(1);
    await wait(120);
    const mid = width();
    expect(mid).toBeGreaterThan(DOCK + 2);
    expect(mid).toBeLessThan(PALETTE - 2);
    // Mid-morph the shape is still the pill, and the filter has not changed (X20).
    expect(getComputedStyle(el).borderTopLeftRadius).toBe('999px');
    expect(getComputedStyle(el).backdropFilter).toBe(filter);
    // The palette's content keeps its place on screen: centred, whatever the capsule's width.
    const content = el.querySelector('[data-capsule-layer="palette"]') as HTMLElement;
    const centre = (r: DOMRect) => r.left + r.width / 2;
    expect(centre(content.getBoundingClientRect())).toBeCloseTo(
      centre(el.getBoundingClientRect()),
      0,
    );
    await settle();
    expect(width()).toBeCloseTo(PALETTE, 0);
    // At rest: no inline size, no transform, no will-change (Q-2), and the dock is gone.
    expect(el.style.width).toBe('');
    expect(el.style.height).toBe('');
    expect(el.style.willChange).toBe('');
    expect(getComputedStyle(el).transform).toBe('none');
    await act(async () => {
      await wait(50);
    });
    expect(el.querySelector('[data-capsule-layer="dock"]')).toBeNull();
    expect(capsule()).toBe(el);
  });

  it('confines the morph to the capsule: its parent and siblings keep their boxes', async () => {
    const { rerender } = render(<Harness shape="dock" />);
    const parent = capsule().parentElement as HTMLElement;
    const before = parent.getBoundingClientRect();
    rerender(<Harness shape="palette" />);
    await wait(100);
    const during = parent.getBoundingClientRect();
    expect(during.width).toBe(before.width);
    expect(during.height).toBe(before.height);
    expect(during.left).toBe(before.left);
    await settle();
  });

  it('slides a piece both contents name from where it was, and hides its leaving twin', async () => {
    const { rerender } = render(<Harness shape="dock" />);
    const pagesBefore = capsule()
      .querySelector('[data-capsule-item="pages"]')
      ?.getBoundingClientRect();
    rerender(<Harness shape="locked" />);
    const el = capsule();
    const pages = el.querySelector<HTMLElement>(
      '[data-capsule-layer="locked"] [data-capsule-item="pages"]',
    ) as HTMLElement;
    const twin = el.querySelector<HTMLElement>(
      '[data-capsule-layer="dock"] [data-capsule-item="pages"]',
    ) as HTMLElement;
    expect(twin).toHaveAttribute('data-capsule-handed');
    expect(getComputedStyle(twin).visibility).toBe('hidden');
    // The first frame draws it where the dock's Pages was (a translate, no scale: Q-8).
    expect(pages.getBoundingClientRect().left).toBeCloseTo(pagesBefore?.left ?? 0, 0);
    expect(pages.getAnimations().length).toBeGreaterThan(0);
    // The piece only Locked has fades in.
    const locked = el.querySelector('[data-capsule-item="locked"]') as HTMLElement;
    const fade = locked.getAnimations()[0];
    expect(fade).toBeDefined();
    expect(JSON.stringify((fade?.effect as KeyframeEffect).getKeyframes())).toContain('opacity');
    await settle();
    expect(width()).toBeCloseTo(LOCKED, 0);
    expect(getComputedStyle(pages).transform).toBe('none');
    expect(pages.style.transform).toBe('');
  });

  it('retargets a morph in flight from where it is, without a jump', async () => {
    const { rerender } = render(<Harness shape="dock" />);
    const el = capsule();
    const dock = el.querySelector('[data-capsule-layer="dock"]');
    rerender(<Harness shape="palette" />);
    await wait(100);
    const at = width();
    expect(at).toBeGreaterThan(DOCK + 2);
    rerender(<Harness shape="dock" />);
    // The width continues from where it was drawn (velocity kept), and the dock comes back.
    expect(Math.abs(width() - at)).toBeLessThan(12);
    expect(el.querySelector('[data-capsule-layer="dock"]')).toBe(dock);
    expect(dock).not.toHaveAttribute('data-leaving');
    expect(dock).not.toHaveAttribute('inert');
    await settle();
    await act(async () => {
      await wait(50);
    });
    expect(width()).toBeCloseTo(DOCK, 0);
    expect(el.querySelector('[data-capsule-layer="palette"]')).toBeNull();
    expect(getComputedStyle(dock as Element).opacity).toBe('1');
  });

  it('morphs inside one content when its morph key changes, and follows other sizes at once', async () => {
    const { rerender } = render(<Harness shape="palette" morphKey="a" />);
    const el = capsule();
    rerender(<Harness shape="palette" morphKey="b" />);
    // Same size: nothing to animate.
    expect(morphs().filter((a) => (a.effect as KeyframeEffect).target === el)).toHaveLength(0);
    await settle();
  });

  it('cross-fades under reduced motion: no size travel, no slides, a fade of at most 150 ms', async () => {
    setReduced(true);
    const { rerender } = render(<Harness shape="dock" />);
    rerender(<Harness shape="locked" />);
    const el = capsule();
    // The size is the new content's at once.
    expect(width()).toBeCloseTo(LOCKED, 0);
    for (const animation of morphs()) {
      const effect = animation.effect as KeyframeEffect;
      const props = new Set(effect.getKeyframes().flatMap((frame) => Object.keys(frame)));
      for (const prop of ['offset', 'computedOffset', 'easing', 'composite']) props.delete(prop);
      expect([...props]).toEqual(['opacity']);
      expect(Number(effect.getComputedTiming().duration)).toBeLessThanOrEqual(150);
    }
    expect(morphs().length).toBeGreaterThan(0);
    await settle();
    await act(async () => {
      await wait(50);
    });
    expect(el.querySelector('[data-capsule-layer="dock"]')).toBeNull();
  });

  it('keeps focus in the capsule: it follows the twin of the focused piece, else the Tab stop', async () => {
    const { rerender } = render(<Harness shape="dock" />);
    (capsule().querySelector('[data-capsule-item="more"]') as HTMLElement).focus();
    rerender(<Harness shape="locked" />);
    expect(document.activeElement).toBe(
      capsule().querySelector('[data-capsule-layer="locked"] [data-capsule-item="more"]'),
    );
    await settle();
  });
});

/**
 * The paragraph outlines (TXT-25): the boxes are the layer's paragraph items, the open
 * paragraph has none, above the cap only the hovered one shows, the setting and the Labs gate
 * remove them. Vitest browser mode.
 */
import type { LocatedRun, ParagraphBlock } from '@pdf-editor/engine';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { PageFrame } from '../annotations/geometry';
import { runKey } from './model';
import { OUTLINE_CAP, ParagraphOutlines, useOutlinesOn } from './ParagraphOutlines';
import { useOutlineSetting } from './outline-setting';
import { setParagraphOutlinesForTests } from './paragraph-outlines-flag';
import { keyboardPlan, type KeyboardItem } from './TextEditLayer';

const frame = {
  size: { width: 600, height: 800 },
  originX: 0,
  originY: 0,
  rotation: 0,
  scale: 1,
} as PageFrame;

function run(object: number): LocatedRun {
  return {
    source: 's',
    pageIndex: 0,
    objectPath: [object],
    charStart: object * 10,
    charCount: 1,
    text: `t${object}`,
    font: { kind: 'truetype' },
    renderMode: 0,
    vertical: false,
  } as unknown as LocatedRun;
}

/** `count` one-run paragraphs stacked down the page, plus the plan the layer would make. */
function plan(count: number) {
  const runs = Array.from({ length: count }, (_, i) => run(i));
  const blocks = runs.map(
    (r, i) =>
      ({
        ref: { source: 's', pageIndex: 0, index: i, runs: [r] },
        text: r.text,
        box: { x: 10, y: 790 - i * 2, width: 100, height: 1.5 },
      }) as unknown as ParagraphBlock,
  );
  return { runs, items: keyboardPlan(runs, blocks).items };
}

function mount(items: readonly KeyboardItem[], openIndex: number | null = null) {
  const view = render(
    <div data-layer>
      <ParagraphOutlines items={items} frame={frame} openIndex={openIndex} />
    </div>,
  );
  const layer = view.container.querySelector('[data-layer]')!;
  return { layer, count: () => layer.querySelectorAll('[data-paragraph-outlines] > span').length };
}

afterEach(() => {
  cleanup();
  setParagraphOutlinesForTests(null);
  useOutlineSetting.setState({ show: true });
});

describe('ParagraphOutlines', () => {
  it('draws one outline per paragraph item, in reading order', () => {
    const { items } = plan(5);
    const { count } = mount(items);
    expect(count()).toBe(items.filter((item) => item.kind === 'paragraph').length);
  });

  it('draws none for the open paragraph', () => {
    const { items } = plan(4);
    expect(mount(items, 2).count()).toBe(3);
  });

  it('above the cap draws only the hovered paragraph', () => {
    const { runs, items } = plan(OUTLINE_CAP + 1);
    const { layer, count } = mount(items);
    expect(count()).toBe(0);
    const target = document.createElement('span');
    target.setAttribute('data-run-key', runKey(runs[7]!));
    layer.append(target);
    act(() => {
      target.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    });
    expect(count()).toBe(1);
    expect(layer.querySelector('[data-strong]')).not.toBeNull();
  });

  it('the setting off, the Labs gate off or the compact edition turn them off', () => {
    const probe = () => {
      let on = false;
      function Probe() {
        on = useOutlinesOn();
        return null;
      }
      render(<Probe />);
      return () => on;
    };
    setParagraphOutlinesForTests(true);
    expect(probe()()).toBe(true);
    act(() => useOutlineSetting.setState({ show: false }));
    expect(probe()()).toBe(false);
    useOutlineSetting.setState({ show: true });
    setParagraphOutlinesForTests(false);
    expect(probe()()).toBe(false);
  });
});

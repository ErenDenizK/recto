/**
 * The Edit text layer's keyboard targets (craft spec §9: "with Edit text armed, Tab moves
 * between paragraphs, Enter opens"; DESIGN §5: targets ≥ 24 × 24). The plan on synthetic
 * runs, then the mounted layer on the tagged Chromium export `word-tagged.pdf`, which prints
 * one text object per glyph: one focusable target per detected paragraph, the glyph runs
 * pointer targets only (out of the tab order, hidden from assistive technology), Enter opens
 * the paragraph editor at the paragraph's start and Esc brings the focus back to the target.
 * Vitest browser mode, PDFium.
 */
import { getActiveDocument, type VirtualDocument } from '@pdf-editor/document-model';
import type { LocatedRun, ParagraphBlock } from '@pdf-editor/engine';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import wordTaggedUrl from '../../../../test/fixtures/text-edit-corpus/word-tagged.pdf?url';
import { fixtureFile } from '../../test/store-harness';
import { resetAnnotationStore } from '../annotations/annotation-store';
import { resetEditRunner, whenIdle } from '../annotations/edit-runner';
import { registerAppCommands } from '../commands/app-commands';
import { useShortcuts } from '../commands/use-shortcuts';
import { ReadView } from '../stage/ReadView';
import { useUiStore } from '../state/ui-store';
import { useViewStore } from '../state/view-store';
import { resetWorkspace, useWorkspaceStore } from '../state/workspace-store';
import { resetToolStore, useToolStore } from '../viewer/tool-store';
import { mirrorOffset } from './mirror-dom';
import { haloOwner, keyboardPlan, MIN_TARGET_PX, paragraphTargetLabel } from './TextEditLayer';
import { pageParagraphs, useTextEditStore } from './text-edit-store';

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

/** A located run with the fields the plan reads (`objectPath`, `charStart`, the blockers). */
function run(object: number, text: string, blocked = false): LocatedRun {
  return {
    source: 's',
    pageIndex: 0,
    objectPath: [object],
    charStart: object * 10,
    charCount: text.length,
    text,
    font: { kind: blocked ? 'type3' : 'truetype' },
    renderMode: 0,
    vertical: false,
  } as unknown as LocatedRun;
}

function block(index: number, runs: readonly LocatedRun[], refusal?: string): ParagraphBlock {
  return {
    ref: { source: 's', pageIndex: 0, index, runs },
    text: runs.map((r) => r.text).join(' '),
    ...(refusal ? { refusal } : {}),
  } as unknown as ParagraphBlock;
}

describe('haloOwner (TXT-28)', () => {
  const frame = {
    size: { width: 612, height: 792 },
    originX: 0,
    originY: 0,
    rotation: 0,
    scale: 1,
  } as const;
  const target = (index: number, y: number) => ({
    block: {
      ...block(index, [run(index, 'a')]),
      box: { x: 100, y, width: 200, height: 50 },
    } as unknown as ParagraphBlock,
    runs: [run(index, 'a')],
  });
  // A's ink ends at css y 200, B's starts at 208: their paddings overlap.
  const a = target(1, 592);
  const b = target(2, 534);

  it('the nearer ink takes a press where two paddings overlap', () => {
    expect(haloOwner(frame, b, [a, b], { x: 150, y: 203 })).toBe(a);
    expect(haloOwner(frame, a, [a, b], { x: 150, y: 205 })).toBe(b);
  });

  it('without the open paragraph among them, a press under it stays with the one it is in', () => {
    expect(haloOwner(frame, b, [b], { x: 150, y: 203 })).toBe(b);
  });
});

describe('keyboardPlan', () => {
  it('one target per paragraph; runs in no paragraph, or in a refused one, keep their own', () => {
    const runs = [
      run(0, 'Heading'),
      run(1, 'Body'),
      run(2, 'text'),
      run(3, 'Caption'),
      run(4, 'Drop'),
      run(5, 'Type3', true),
    ];
    const [heading, body, text, caption, drop, type3] = runs;
    const blocks = [
      block(0, [heading!]),
      block(1, [body!, text!]),
      block(2, [drop!], 'drop-cap'),
      block(3, [type3!], 'type3'),
    ];
    const plan = keyboardPlan(runs, blocks);
    expect(
      plan.items.map((item) =>
        item.kind === 'paragraph' ? `p${item.target.block.ref.index}` : item.run.text,
      ),
    ).toEqual(['p0', 'p1', 'Caption', 'Drop']);
    expect([...plan.covered].map((r) => r.text)).toEqual(['Heading', 'Body', 'text']);
    expect(plan.covered.has(caption!)).toBe(false);
    const second = plan.items[1];
    expect(second?.kind === 'paragraph' ? second.target.runs : []).toEqual([body, text]);
  });

  it('keeps the analysis order of paragraphs and slots stray runs by run order', () => {
    // Two columns: the analysis reads the left column (runs 0, 2) before the right (1, 3).
    const runs = [run(0, 'L1'), run(1, 'R1'), run(2, 'L2'), run(3, 'R2'), run(4, 'Footer')];
    const [l1, r1, l2, r2] = runs;
    const plan = keyboardPlan(runs, [block(0, [l1!, l2!]), block(1, [r1!, r2!])]);
    expect(
      plan.items.map((item) =>
        item.kind === 'paragraph' ? `p${item.target.block.ref.index}` : item.run.text,
      ),
    ).toEqual(['p0', 'p1', 'Footer']);
  });

  it('without paragraphs every editable run is its own target', () => {
    const runs = [run(0, 'One'), run(1, 'Two'), run(2, 'Three', true)];
    const plan = keyboardPlan(runs, []);
    expect(plan.items.map((item) => (item.kind === 'run' ? item.run.text : ''))).toEqual([
      'One',
      'Two',
    ]);
    expect(plan.covered.size).toBe(0);
  });

  it('names a target by its opening words', () => {
    expect(paragraphTargetLabel({ text: 'Short one.' })).toBe('Edit paragraph “Short one.”');
    const long = paragraphTargetLabel({
      text: 'The ferry left the quay at dawn, and the gulls followed it out past the breakwater.',
    });
    expect(long).toBe(
      'Edit paragraph “The ferry left the quay at dawn, and the gulls followed it…”',
    );
  });
});

// ---------------------------------------------------------------------------
// Mounted
// ---------------------------------------------------------------------------

function Harness({ doc }: { readonly doc: VirtualDocument }) {
  useShortcuts();
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: 800 }}>
      <ReadView doc={doc} />
    </div>
  );
}

async function mount() {
  await useWorkspaceStore.getState().openFiles([await fixtureFile(wordTaggedUrl, 'word.pdf')]);
  const doc = getActiveDocument(useWorkspaceStore.getState().workspace) as VirtualDocument;
  const first = doc.pages[0];
  if (first?.ref.kind !== 'source') throw new Error('no source page');
  useUiStore.getState().setZoom(1);
  useViewStore.getState().setCurrentPage(0);
  useUiStore.getState().openMarkup(doc.id);
  const { container } = render(<Harness doc={doc} />);
  await waitFor(
    () => {
      if (!container.querySelector('[data-page-index="0"] canvas[data-state="rendered"]')) {
        throw new Error('page not rendered');
      }
    },
    { timeout: 10_000 },
  );
  return { container, source: first.ref.source };
}

/** Focusable elements of the layer that Tab reaches. */
function tabbable(layer: Element): HTMLElement[] {
  return [...layer.querySelectorAll<HTMLElement>('button, [tabindex]')].filter(
    (el) => el.tabIndex >= 0 && !(el as HTMLButtonElement).disabled,
  );
}

describe('the Edit text layer by keyboard (mounted)', () => {
  let disposeCommands: () => void = () => undefined;
  beforeAll(() => {
    disposeCommands = registerAppCommands();
  });
  afterAll(() => {
    disposeCommands();
  });
  beforeEach(() => {
    resetWorkspace();
    resetEditRunner();
    resetAnnotationStore();
    resetToolStore();
    useTextEditStore.getState().close();
    useUiStore.setState({ destination: 'document', docUi: {} });
  });
  afterEach(async () => {
    cleanup();
    useTextEditStore.getState().close();
    await whenIdle();
    resetWorkspace();
    resetToolStore();
  });

  it('Tab moves between paragraphs, Enter opens one, Esc returns to it', async () => {
    const { container, source } = await mount();
    useToolStore.getState().setMode('edit-text');
    const layer = await waitFor(
      () => {
        const l = container.querySelector<HTMLElement>('[data-text-edit-layer="0"]');
        if (!l?.querySelector('[data-text-paragraph]')) throw new Error('no paragraph targets');
        return l;
      },
      { timeout: 20_000 },
    );
    const blocks = await pageParagraphs(source, 0);
    const offered = blocks.filter((b) => !b.refusal);
    expect(offered.length).toBeGreaterThanOrEqual(4);

    // One target per paragraph, in reading order, and nothing else Tab can reach.
    const targets = [...layer.querySelectorAll<HTMLElement>('[data-text-paragraph]')];
    expect(targets).toHaveLength(offered.length);
    expect(tabbable(layer)).toEqual(targets);
    expect(targets.map((t) => t.getAttribute('aria-label'))).toEqual(
      offered.map((b) => paragraphTargetLabel(b)),
    );
    // The glyph runs stay pointer targets: many, never focusable, hidden from AT.
    const runs = [...layer.querySelectorAll<HTMLElement>('[data-text-run][data-editable]')];
    expect(runs.length).toBeGreaterThan(100);
    expect(runs.every((r) => r.tabIndex < 0 && r.getAttribute('aria-hidden') === 'true')).toBe(
      true,
    );
    expect(runs.every((r) => getComputedStyle(r).pointerEvents === 'auto')).toBe(true);
    // Targets of at least 24 × 24 px that take no pointer.
    for (const target of targets) {
      const box = target.getBoundingClientRect();
      expect(box.width).toBeGreaterThanOrEqual(MIN_TARGET_PX);
      expect(box.height).toBeGreaterThanOrEqual(MIN_TARGET_PX);
      expect(getComputedStyle(target).pointerEvents).toBe('none');
    }
    // Its inset focus ring (4 px, styles/focus.css) stays outside the ink: every line's run
    // target (the line box and 2 px) lies at least that far inside the paragraph's target.
    for (const target of targets) {
      const box = target.getBoundingClientRect();
      for (const run of runs) {
        const r = run.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        if (x < box.left || x > box.right || y < box.top || y > box.bottom) continue;
        expect(r.left - box.left).toBeGreaterThanOrEqual(4 - 0.5);
        expect(r.top - box.top).toBeGreaterThanOrEqual(4 - 0.5);
        expect(box.right - r.right).toBeGreaterThanOrEqual(4 - 0.5);
        expect(box.bottom - r.bottom).toBeGreaterThanOrEqual(4 - 0.5);
      }
    }

    const ferry = targets.find((t) => t.getAttribute('aria-label')?.includes('The ferry'));
    if (!ferry) throw new Error('no ferry paragraph');
    const at = targets.indexOf(ferry);
    ferry.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(targets[at + 1]);
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(ferry);

    await userEvent.keyboard('{Enter}');
    const mirror = await waitFor(
      () => {
        const field = container.querySelector<HTMLElement>('[data-paragraph-mirror]');
        if (!field || document.activeElement !== field) throw new Error('no paragraph editor');
        return field;
      },
      { timeout: 20_000 },
    );
    expect(mirror).toHaveAttribute('role', 'textbox');
    expect(mirror).toHaveAccessibleName('Paragraph on page 1');
    expect(mirror.textContent).toMatch(/^The ferry left the quay/);
    expect(window.getSelection()?.anchorOffset).toBe(0);

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(container.querySelector('[data-paragraph-mirror]')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(ferry), { timeout: 10_000 });
    expect(useToolStore.getState().mode).toBe('edit-text');
  });

  it("a press in a paragraph's padding opens it with the caret at the nearest character (TXT-28)", async () => {
    const { container, source } = await mount();
    useToolStore.getState().setMode('edit-text');
    const layer = await waitFor(
      () => {
        const l = container.querySelector<HTMLElement>('[data-text-edit-layer="0"]');
        if (!l?.querySelector('[data-text-halo]')) throw new Error('no paragraph targets');
        return l;
      },
      { timeout: 20_000 },
    );
    const ferryBlock = (await pageParagraphs(source, 0)).find((b) =>
      b.text.startsWith('The ferry'),
    );
    if (!ferryBlock) throw new Error('no ferry block');
    const second = ferryBlock.lines[1];
    if (!second) throw new Error('the ferry paragraph has one line');
    const ferry = [...layer.querySelectorAll<HTMLElement>('[data-text-paragraph]')].find((t) =>
      t.getAttribute('aria-label')?.includes('The ferry'),
    );
    if (!ferry) throw new Error('no ferry paragraph');
    const boxNow = () => {
      const now = [...layer.querySelectorAll<HTMLElement>('[data-text-paragraph]')].find((t) =>
        t.getAttribute('aria-label')?.includes('The ferry'),
      );
      return (now ?? ferry).getBoundingClientRect();
    };
    const haloOf = () =>
      layer.querySelector<HTMLElement>(`[data-text-halo="${ferryBlock.ref.index}"]`) ?? undefined;
    const halo = haloOf();
    if (!halo) throw new Error('no halo over the ferry paragraph');
    expect(getComputedStyle(halo).pointerEvents).toBe('auto');

    // The run boxes (the ink and 2 px) of a line of the paragraph as laid out now, relative to
    // its target (the page may have scrolled since the last press).
    const lineAt = (n: number) => {
      const at = boxNow();
      const boxes = [...layer.querySelectorAll<HTMLElement>('[data-text-run][data-editable]')]
        .map((r) => r.getBoundingClientRect())
        .filter((r) => r.left >= at.left && r.right <= at.right && r.top >= at.top);
      // Lines by the run boxes' vertical centres: a glyph's box varies with its height.
      const centre = (r: DOMRect) => r.top + r.height / 2;
      const centres = boxes.map(centre).sort((x, y) => x - y);
      const rows: number[] = [];
      for (const c of centres) if (rows.length === 0 || c - (rows.at(-1) ?? 0) > 8) rows.push(c);
      const row = boxes
        .filter((r) => Math.abs(centre(r) - (rows[n] ?? Infinity)) <= 8)
        .sort((x, y) => x.left - y.left);
      const first = row[0];
      const last = row.at(-1);
      if (!first || !last) throw new Error(`no line ${n}`);
      const y = (rows[n] ?? 0) - at.top;
      return { left: first.left - 2 - at.left, right: last.right + 2 - at.left, y };
    };
    const mirrorOf = async () =>
      waitFor(
        () => {
          const field = container.querySelector<HTMLElement>('[data-paragraph-mirror]');
          if (!field?.textContent) throw new Error('no paragraph editor');
          return field;
        },
        { timeout: 20_000 },
      );
    const offsetOf = (mirror: HTMLElement) => {
      const selection = window.getSelection();
      return mirrorOffset(mirror, selection?.anchorNode ?? null, selection?.anchorOffset ?? 0);
    };
    const close = async () => {
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(container.querySelector('[data-paragraph-mirror]')).toBeNull());
      await waitFor(() => expect(haloOf()).toBeDefined());
    };

    // 4 px left of the first line's ink, past the runs' own 2 px: the caret at 0.
    const head = lineAt(0);
    await userEvent.click(halo, { position: { x: head.left, y: head.y } });
    let mirror = await mirrorOf();
    expect(mirror.textContent).toMatch(/^The ferry left the quay/);
    await waitFor(() => expect(offsetOf(mirror)).toBe(0));
    // No halo over the open paragraph: the editor's own controls take its presses.
    expect(haloOf()).toBeUndefined();
    await close();

    // 4 px right of the first line's end: the caret at the line's end (before the space that
    // wrapped), a non-zero offset only the press can have placed.
    await userEvent.click(haloOf() as HTMLElement, {
      position: { x: lineAt(0).right, y: lineAt(0).y },
    });
    mirror = await mirrorOf();
    await waitFor(() => {
      const at = offsetOf(mirror);
      expect(at).toBeGreaterThan(0);
      expect([second.start, second.start - 1]).toContain(at);
    });
    await close();

    // A double press level with the second line, left of its ink, opens one editor with the
    // caret at that line's start: as on a run, the paragraph editor takes only the caret
    // (`openRunEditor`), the word is the editor's own double press.
    const next = lineAt(1);
    await userEvent.dblClick(haloOf() as HTMLElement, {
      position: { x: next.left, y: next.y },
    });
    mirror = await mirrorOf();
    await waitFor(() => expect(offsetOf(mirror)).toBe(second.start));
    expect(container.querySelectorAll('[data-paragraph-mirror]')).toHaveLength(1);
  });
});

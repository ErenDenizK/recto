/**
 * The hit router (05-canvas §6) and its pointer rules: the order itself, links included; the
 * live-kind matrix (9 states × 6 kinds); the winner among stacked targets whatever their
 * stacking; the double-click asymmetry, the hover gate, the link slop, drawing pointers and the
 * first-pen hint; the pointer roles (double-click entry, idle hover, pen eraser and barrel).
 */
import { afterEach, describe, expect, it } from 'vitest';

import {
  createPointerLog,
  doubleClickOpensEditor,
  HIT_MATRIX,
  HIT_ORDER,
  type HitKind,
  hitAt,
  hitKindOf,
  hitMeaning,
  hoverAllowed,
  hoverOutlines,
  INPUT_STATES,
  type InputState,
  inputStateOf,
  isLive,
  linkDragSelects,
  liveHitKinds,
  opensTextOnDoubleClick,
  penButtonOf,
  pointerDraws,
  showsPenHint,
  topHit,
  watchPointers,
} from './hit-order';
import type { ToolMode } from './tool-store';

/** One element per kind, marked as the layers mark their targets. */
function target(kind: HitKind | 'paper'): HTMLElement {
  const element = document.createElement(kind === 'text-run' ? 'button' : 'div');
  switch (kind) {
    case 'annotation':
      element.setAttribute('data-annotation-id', 'a1');
      break;
    case 'form-widget':
      element.setAttribute('data-field-name', 'name');
      break;
    case 'link':
      element.setAttribute('data-link', 'internal');
      break;
    case 'image':
      element.setAttribute('data-image-object', '');
      break;
    case 'text-run':
      element.setAttribute('data-text-run', 'Hello');
      break;
    case 'text-selection': {
      const layer = document.createElement('div');
      layer.setAttribute('data-text-layer', '0');
      const span = document.createElement('span');
      layer.appendChild(span);
      document.body.appendChild(layer);
      return span;
    }
    default:
      break;
  }
  document.body.appendChild(element);
  return element;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('the hit order', () => {
  it('is annotation, form widget, link, image, text run, text selection', () => {
    expect(HIT_ORDER).toEqual([
      'annotation',
      'form-widget',
      'link',
      'image',
      'text-run',
      'text-selection',
    ]);
  });

  it('knows each kind by its marks, and nothing else', () => {
    for (const kind of HIT_ORDER) expect(hitKindOf(target(kind))).toBe(kind);
    expect(hitKindOf(target('paper'))).toBeUndefined();
    expect(hitKindOf(null)).toBeUndefined();
    // A child of a target belongs to it (the rects of a markup's <g>).
    const annotation = target('annotation');
    const child = document.createElement('span');
    annotation.appendChild(child);
    expect(hitKindOf(child)).toBe('annotation');
  });

  it('picks the earliest kind among stacked targets, whatever their stacking', () => {
    const text = target('text-selection');
    const image = target('image');
    const widget = target('form-widget');
    const annotation = target('annotation');
    const paper = target('paper');
    // Top-most first, as elementsFromPoint lists them.
    expect(topHit([paper, text, image, widget, annotation])).toEqual({
      kind: 'annotation',
      element: annotation,
    });
    expect(topHit([text, image, widget])?.kind).toBe('form-widget');
    expect(topHit([text, image, target('link')])?.kind).toBe('link');
    expect(topHit([target('link'), widget])?.kind).toBe('form-widget');
    expect(topHit([text, image])?.kind).toBe('image');
    expect(topHit([text, target('text-run')])?.kind).toBe('text-run');
    expect(topHit([paper, text])?.kind).toBe('text-selection');
    expect(topHit([paper])).toBeUndefined();
    // Within a kind, the top-most element.
    const upper = target('annotation');
    expect(topHit([upper, annotation])?.element).toBe(upper);
  });

  it('resolves a point through elementsFromPoint (live targets only)', () => {
    const style = 'position: fixed; left: 10px; top: 10px; width: 50px; height: 20px;';
    const text = target('text-selection');
    text.parentElement?.setAttribute('style', style);
    text.setAttribute('style', 'display: block; width: 50px; height: 20px;');
    expect(hitAt(20, 15)?.kind).toBe('text-selection');
    const annotation = target('annotation');
    annotation.setAttribute('style', `${style} z-index: -1;`);
    // Below the text in the stacking, first in the order.
    expect(hitAt(20, 15)?.kind).toBe('annotation');
    // A root that lets the pointer through is not a target.
    annotation.style.pointerEvents = 'none';
    expect(hitAt(20, 15)?.kind).toBe('text-selection');
  });
});

describe('the live-kind matrix (05-canvas §6): 9 states × 6 kinds', () => {
  const kinds = (state: InputState) => [...liveHitKinds(state)].sort();
  const facts = (markup: boolean, tool: ToolMode, locked = false, penDraws = false) =>
    inputStateOf({ markup, tool, locked, penDraws });

  it('names the state: Locked wins, then viewing, then the armed tool', () => {
    expect(facts(false, 'select')).toBe('viewing');
    expect(facts(true, 'select')).toBe('markup-select');
    expect(facts(true, 'select', false, true)).toBe('markup-select-pen');
    for (const tool of ['ink', 'eraser', 'lasso', 'highlight', 'rectangle', 'arrow'] as const) {
      expect(facts(true, tool)).toBe('markup-draw');
    }
    for (const tool of ['text-box', 'note', 'stamp', 'signature'] as const) {
      expect(facts(true, tool)).toBe('markup-place');
    }
    expect(facts(true, 'image')).toBe('markup-image');
    expect(facts(true, 'edit-text')).toBe('markup-edit-text');
    expect(facts(true, 'redact')).toBe('markup-redact');
    expect(facts(false, 'select', true)).toBe('locked');
    expect(facts(true, 'ink', true, true)).toBe('locked');
  });

  it('every state has a row and every row every kind', () => {
    expect(Object.keys(HIT_MATRIX).sort()).toEqual([...INPUT_STATES].sort());
    expect(INPUT_STATES).toHaveLength(9);
    for (const state of INPUT_STATES) {
      expect(Object.keys(HIT_MATRIX[state]).sort()).toEqual([...HIT_ORDER].sort());
    }
  });

  it('viewing: select annotations, fill fields, follow links, select text; images by menu', () => {
    expect(HIT_MATRIX.viewing).toEqual({
      annotation: 'select',
      'form-widget': 'fill',
      link: 'follow',
      image: 'menu',
      'text-run': null,
      'text-selection': 'select-text',
    });
    expect(kinds('viewing')).toEqual(['annotation', 'form-widget', 'link', 'text-selection']);
  });

  it('Markup with Select: the same, and the double-click door on page text', () => {
    expect(hitMeaning('text-run', 'markup-select')).toBe('door');
    expect(hitMeaning('annotation', 'markup-select')).toBe('select');
    // The door goes through the text selection's spans: no run targets.
    expect(kinds('markup-select')).toEqual(['annotation', 'form-widget', 'link', 'text-selection']);
  });

  it('a pen that draws with Select, and every drawing, placing or Redact tool: no target', () => {
    const states = ['markup-select-pen', 'markup-draw', 'markup-place', 'markup-redact'] as const;
    for (const state of states) {
      expect(kinds(state)).toEqual([]);
      for (const kind of HIT_ORDER) expect(hitMeaning(kind, state)).toBeNull();
    }
  });

  it('Image takes images only; Edit text takes text runs only', () => {
    expect(kinds('markup-image')).toEqual(['image']);
    expect(hitMeaning('image', 'markup-image')).toBe('transform');
    expect(kinds('markup-edit-text')).toEqual(['text-run']);
    expect(isLive('annotation', 'markup-edit-text')).toBe(false);
    expect(isLive('annotation', 'markup-image')).toBe(false);
  });

  it('Locked: annotations show their comment, fields focus, links follow, text selects', () => {
    expect(HIT_MATRIX.locked).toEqual({
      annotation: 'comment',
      'form-widget': 'focus',
      link: 'follow',
      image: 'menu',
      'text-run': null,
      'text-selection': 'select-text',
    });
    expect(kinds('locked')).toEqual(['annotation', 'form-widget', 'link', 'text-selection']);
  });
});

describe('the double-click asymmetry and the hover outline (flows §3.2, 05-canvas §9)', () => {
  it('opens the editor only in Markup with Select; selects a word everywhere else', () => {
    for (const state of INPUT_STATES) {
      expect(doubleClickOpensEditor(state, 'mouse', false)).toBe(state === 'markup-select');
    }
    // Never from touch; never from a pen once a pen draws (spec 05.12).
    expect(doubleClickOpensEditor('markup-select', 'touch', false)).toBe(false);
    expect(doubleClickOpensEditor('markup-select', 'pen', true)).toBe(false);
    expect(doubleClickOpensEditor('markup-select', 'pen', false)).toBe(true);
  });

  it('outlines on hover only in Markup with Select', () => {
    for (const state of INPUT_STATES) {
      expect(hoverOutlines(state)).toBe(state === 'markup-select');
    }
  });
});

describe('links, long press and the first-pen hint (05-canvas §6, spec 04.11, flows §3.4)', () => {
  it('a press on a link selects text past 4 px (mouse), 3 px (pen), 10 px (touch)', () => {
    expect(linkDragSelects('mouse', 3, 0)).toBe(false);
    expect(linkDragSelects('mouse', 4, 0)).toBe(true);
    expect(linkDragSelects('pen', 2, 2)).toBe(false);
    expect(linkDragSelects('pen', 3, 0)).toBe(true);
    expect(linkDragSelects('touch', 6, 6)).toBe(false);
    expect(linkDragSelects('touch', 0, 10)).toBe(true);
    expect(linkDragSelects('', 4, 0)).toBe(true);
  });

  it('a drawing pointer never long-presses', () => {
    expect(pointerDraws('markup-draw', 'mouse', false)).toBe(true);
    expect(pointerDraws('markup-draw', 'pen', false)).toBe(true);
    expect(pointerDraws('markup-place', 'pen', false)).toBe(true);
    expect(pointerDraws('markup-redact', 'mouse', false)).toBe(true);
    // A finger draws only while "Draw with finger" holds (before a pen was seen).
    expect(pointerDraws('markup-draw', 'touch', true)).toBe(true);
    expect(pointerDraws('markup-draw', 'touch', false)).toBe(false);
    // The pen that writes in Markup with Select; a finger there scrolls and may long-press.
    expect(pointerDraws('markup-select-pen', 'pen', false)).toBe(true);
    expect(pointerDraws('markup-select-pen', 'touch', true)).toBe(false);
    for (const state of ['viewing', 'markup-select', 'markup-image', 'locked'] as const) {
      expect(pointerDraws(state, 'pen', true)).toBe(false);
      expect(pointerDraws(state, 'touch', true)).toBe(false);
    }
  });

  it('the first pen touch in viewing on a touch screen, once, never locked', () => {
    const base = {
      pointerType: 'pen',
      maxTouchPoints: 5,
      state: 'viewing',
      penWritesWithoutMarkup: false,
      shown: false,
    } as const;
    expect(showsPenHint(base)).toBe(true);
    expect(showsPenHint({ ...base, pointerType: 'mouse' })).toBe(false);
    // A desktop drawing tablet (M-24).
    expect(showsPenHint({ ...base, maxTouchPoints: 0 })).toBe(false);
    expect(showsPenHint({ ...base, state: 'locked' })).toBe(false);
    expect(showsPenHint({ ...base, state: 'markup-select' })).toBe(false);
    expect(showsPenHint({ ...base, penWritesWithoutMarkup: true })).toBe(false);
    expect(showsPenHint({ ...base, shown: true })).toBe(false);
  });
});

describe('pointer roles', () => {
  it('a double-click opens the text editor from a mouse or a pen as a pointer, never touch', () => {
    expect(opensTextOnDoubleClick('mouse', false)).toBe(true);
    expect(opensTextOnDoubleClick('mouse', true)).toBe(true);
    expect(opensTextOnDoubleClick('pen', false)).toBe(true);
    expect(opensTextOnDoubleClick('pen', true)).toBe(false);
    expect(opensTextOnDoubleClick('touch', false)).toBe(false);
    expect(opensTextOnDoubleClick('touch', true)).toBe(false);
    // Unknown (synthetic) presses count as a mouse.
    expect(opensTextOnDoubleClick('', true)).toBe(true);
  });

  it('the idle hover: mouse or hovering pen, no button, not within 500 ms of a pen stroke', () => {
    const now = 10_000;
    const never = Number.NEGATIVE_INFINITY;
    expect(hoverAllowed({ pointerType: 'mouse', buttons: 0 }, now, never)).toBe(true);
    expect(hoverAllowed({ pointerType: 'pen', buttons: 0 }, now, never)).toBe(true);
    expect(hoverAllowed({ pointerType: 'touch', buttons: 0 }, now, never)).toBe(false);
    expect(hoverAllowed({ pointerType: 'mouse', buttons: 1 }, now, never)).toBe(false);
    expect(hoverAllowed({ pointerType: 'pen', buttons: 0 }, now, now - 499)).toBe(false);
    expect(hoverAllowed({ pointerType: 'mouse', buttons: 0 }, now, now - 100)).toBe(false);
    expect(hoverAllowed({ pointerType: 'mouse', buttons: 0 }, now, now - 500)).toBe(true);
  });

  it("the pen's eraser end and barrel button", () => {
    expect(penButtonOf({ pointerType: 'pen', button: 0, buttons: 1 })).toBe('tip');
    expect(penButtonOf({ pointerType: 'pen', button: 5, buttons: 32 })).toBe('eraser');
    expect(penButtonOf({ pointerType: 'pen', button: -1, buttons: 32 })).toBe('eraser');
    expect(penButtonOf({ pointerType: 'pen', button: 2, buttons: 2 })).toBe('barrel');
    expect(penButtonOf({ pointerType: 'pen', button: 0, buttons: 3 })).toBe('barrel');
    expect(penButtonOf({ pointerType: 'mouse', button: 2, buttons: 2 })).toBeUndefined();
    expect(penButtonOf({ pointerType: 'touch', button: 0, buttons: 1 })).toBeUndefined();
  });

  it('the pointer log follows presses and pen lifts in the capture phase', () => {
    const log = createPointerLog();
    const host = new EventTarget() as unknown as Window;
    let pens = 0;
    let clock = 500;
    const dispose = watchPointers(
      host,
      log,
      () => {
        pens += 1;
      },
      () => clock,
    );
    host.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse' }));
    expect(log.lastDownType).toBe('mouse');
    expect(pens).toBe(0);
    host.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'pen' }));
    expect(pens).toBe(1);
    host.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'pen' }));
    expect(log.lastDownType).toBe('pen');
    clock = 800;
    host.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'pen' }));
    expect(log.lastPenUpAt).toBe(800);
    host.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'mouse' }));
    expect(log.lastPenUpAt).toBe(800);
    dispose();
    host.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch' }));
    expect(log.lastDownType).toBe('pen');
  });
});

/**
 * Every kind × size class (components/07-sheets.md §1.1, §2.9), the detent offsets and the
 * release rule of §2.6.
 */
import { describe, expect, it } from 'vitest';

import type { SizeClass } from '../../shell/frame/size-class';
import {
  detentOffsets,
  presentationOf,
  releaseTarget,
  type SheetKind,
  TASK_DETENTS,
  TOOL_DETENTS,
} from './presentation';

const at = (size: SizeClass, short = false) => ({ size, short });
const WIDE: readonly SizeClass[] = ['expanded', 'large', 'xlarge'];

describe('presentationOf (07 §1.1)', () => {
  it('tool sheets: bottom with 40 % and 92 % on compact, side 360 then 400, never modal', () => {
    const compact = presentationOf('tool', at('compact'));
    expect(compact).toMatchObject({ presentation: 'bottom', modal: false, scrim: false });
    expect(compact.detents).toEqual(TOOL_DETENTS);
    expect(compact.swipe).toBe('down');
    expect(presentationOf('tool', at('compact', true))).toMatchObject({
      presentation: 'side',
      width: 360,
      swipe: 'right',
    });
    expect(presentationOf('tool', at('medium'))).toMatchObject({
      presentation: 'side',
      width: 360,
    });
    for (const size of WIDE) {
      expect(presentationOf('tool', at(size))).toMatchObject({
        presentation: 'side',
        width: 400,
        modal: false,
        scrim: false,
        swipe: null,
      });
    }
  });

  it('task sheets: bottom at 92 %, full on compact-height, form 640 on medium, side 400 with a scrim', () => {
    const compact = presentationOf('task', at('compact'));
    expect(compact).toMatchObject({ presentation: 'bottom', modal: true, scrim: true });
    expect(compact.detents).toEqual(TASK_DETENTS);
    expect(presentationOf('task', at('medium', true))).toMatchObject({ presentation: 'full' });
    expect(presentationOf('task', at('medium'))).toMatchObject({
      presentation: 'form',
      width: 640,
    });
    for (const size of WIDE) {
      expect(presentationOf('task', at(size))).toMatchObject({
        presentation: 'side',
        width: 400,
        modal: true,
        scrim: true,
      });
    }
  });

  it('Settings: as a task sheet, but 480 wide from expanded up', () => {
    expect(presentationOf('settings', at('compact')).presentation).toBe('bottom');
    expect(presentationOf('settings', at('compact', true)).presentation).toBe('full');
    expect(presentationOf('settings', at('medium'))).toMatchObject({ presentation: 'form' });
    expect(presentationOf('settings', at('large'))).toMatchObject({
      presentation: 'side',
      width: 480,
    });
  });

  it('confirmations: alertdialogs, a content-high modal sheet on compact, else centred 400', () => {
    const compact = presentationOf('confirmation', at('compact'));
    expect(compact).toMatchObject({ presentation: 'bottom', role: 'alertdialog', modal: true });
    expect(compact.detents).toEqual([]);
    for (const frame of [at('compact', true), at('medium'), at('expanded'), at('xlarge')]) {
      expect(presentationOf('confirmation', frame)).toMatchObject({
        presentation: 'dialog',
        width: 400,
        role: 'alertdialog',
        swipe: null,
      });
    }
  });

  it('the shortcuts overlay: full on narrow windows, centred 760 from medium up', () => {
    expect(presentationOf('overlay', at('compact')).presentation).toBe('full');
    expect(presentationOf('overlay', at('large', true)).presentation).toBe('full');
    expect(presentationOf('overlay', at('medium'))).toMatchObject({
      presentation: 'dialog',
      width: 760,
    });
  });

  it('answers for every kind and class, modal exactly when the scrim shows', () => {
    const kinds: SheetKind[] = ['tool', 'task', 'settings', 'confirmation', 'overlay'];
    const sizes: SizeClass[] = ['compact', 'medium', 'expanded', 'large', 'xlarge'];
    for (const kind of kinds) {
      for (const size of sizes) {
        for (const short of [false, true]) {
          const layout = presentationOf(kind, at(size, short));
          expect(layout.scrim).toBe(layout.modal);
          expect(layout.modal).toBe(kind !== 'tool');
          expect(layout.role).toBe(kind === 'confirmation' ? 'alertdialog' : 'dialog');
          if (layout.presentation !== 'bottom') expect(layout.detents).toEqual([]);
        }
      }
    }
  });
});

describe('detentOffsets', () => {
  it('places each detent below the tallest position, in whole pixels', () => {
    // A 92 % panel on an 844 px window: 776.48 px visible.
    expect(detentOffsets(TOOL_DETENTS, 776.48, 844)).toEqual([439, 0]);
    expect(detentOffsets(TASK_DETENTS, 776.48, 844)).toEqual([0]);
    expect(detentOffsets([], 300, 844)).toEqual([0]);
  });
});

describe('releaseTarget (07 §2.6)', () => {
  const offsets = [439, 0];
  const closed = 778;

  it('snaps to the detent nearest where momentum carries it', () => {
    expect(releaseTarget(120, 0, offsets, closed)).toEqual({ close: false, offset: 0 });
    expect(releaseTarget(380, 0, offsets, closed)).toEqual({ close: false, offset: 439 });
  });

  it('closes below half of the lowest detent, or faster than 800 px/s down', () => {
    // The 40 % detent shows 339 px; under 169.5 px showing closes.
    expect(releaseTarget(610, 0, offsets, closed)).toEqual({ close: true });
    expect(releaseTarget(600, 0, offsets, closed)).toEqual({ close: false, offset: 439 });
    expect(releaseTarget(100, 900, offsets, closed)).toEqual({ close: true });
    // Fast upwards never closes.
    expect(releaseTarget(-50, -2000, offsets, closed)).toEqual({ close: false, offset: 0 });
  });
});

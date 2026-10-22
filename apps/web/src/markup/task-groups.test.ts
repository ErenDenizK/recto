/**
 * The grouped palette's model (`task-groups.ts`) and the palette flag (`palette-variant.ts`):
 * which group a door opens, where an armed tool lives and what its group shows, the fold order,
 * and the flag's decision.
 */
import { describe, expect, it } from 'vitest';

import { foldPalette } from './palette-fold';
import { PALETTE_ITEMS } from './palette-groups';
import { decidePaletteVariant } from './palette-variant';
import {
  armedName,
  doorGroup,
  groupFoldSteps,
  headerOf,
  TASK_GROUPS,
  TASK_ITEMS,
  taskOfMode,
} from './task-groups';

describe('the grouped palette', () => {
  it('holds every tool of the row in one group, Done, Select and + aside', () => {
    const grouped = TASK_GROUPS.flatMap((group) => TASK_ITEMS[group]);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect([...grouped, 'done', 'select', 'more'].sort()).toEqual([...PALETTE_ITEMS].sort());
  });

  it('opens on Draw from Markup and on Fill & sign from Fill & sign', () => {
    expect(doorGroup('draw')).toBe('draw');
    expect(doorGroup('sign')).toBe('sign');
  });

  it('finds the group of an armed tool; Select has none', () => {
    expect(taskOfMode('ink', false)).toBe('draw');
    expect(taskOfMode('ink', true)).toBe('draw');
    expect(taskOfMode('arrow', false)).toBe('draw');
    expect(taskOfMode('note', false)).toBe('comment');
    expect(taskOfMode('signature', false)).toBe('sign');
    expect(taskOfMode('redact', false)).toBe('change');
    expect(taskOfMode('select', false)).toBeUndefined();
  });

  it("names the armed tool on its group when the tool's button has no name", () => {
    expect(armedName('draw', 'eraser', false)).toBe('Eraser');
    // The highlighter's swatch names it; Draw keeps its name (no long name in its slot).
    expect(armedName('draw', 'ink', true)).toBeUndefined();
    expect(armedName('draw', 'ink', false)).toBe('Pen');
    expect(armedName('comment', 'note', false)).toBe('Note');
    // Sign and Edit text carry their own names; another group's tool is not named.
    expect(armedName('sign', 'signature', false)).toBeUndefined();
    expect(armedName('change', 'edit-text', false)).toBeUndefined();
    expect(armedName('comment', 'eraser', false)).toBeUndefined();
  });

  it("drops the closed groups' names first, the open one's last", () => {
    const items = [
      { id: 'done', group: 'done', width: 76, bareWidth: 32 },
      { id: 'select', group: 'select', width: 32 },
      ...TASK_GROUPS.map((group) => ({
        id: headerOf(group),
        group,
        width: 100,
        bareWidth: 32,
      })),
      { id: 'pens', group: 'draw', width: 140 },
      { id: 'eraser', group: 'draw', width: 32 },
      { id: 'more', group: 'more', width: 32 },
    ];
    const metrics = { gap: 4, separator: 9, padding: 10 };
    const full = foldPalette(items, groupFoldSteps('draw'), Infinity, metrics).width;
    const one = foldPalette(items, groupFoldSteps('draw'), full - 60, metrics);
    expect([...one.bare]).toEqual(['group-change']);
    const tight = foldPalette(items, groupFoldSteps('draw'), full - 240, metrics);
    expect([...tight.bare]).toEqual(['group-change', 'group-sign', 'group-comment', 'done']);
    expect(tight.folded).toEqual([]);
  });
});

describe('the palette flag', () => {
  it('takes the address, then the stored choice, else the row', () => {
    expect(decidePaletteVariant('?palette=groups', null)).toBe('groups');
    expect(decidePaletteVariant('?palette=row', 'groups')).toBe('row');
    expect(decidePaletteVariant('', 'labels')).toBe('labels');
    expect(decidePaletteVariant('?palette=nope', 'nope')).toBe('row');
  });
});

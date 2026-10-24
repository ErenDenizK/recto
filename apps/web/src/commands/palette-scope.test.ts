/**
 * The palette's scope chip and suggestions (R25 Epic 4 lanes 2 and 4; PRD-29): the selection's
 * commands lead the list, and a document offers what it is for.
 */
import { describe, expect, it } from 'vitest';

import { buildSections, SCOPE_GROUP } from '../shell/CommandPalette';
import { PAGE_SCOPE_COMMANDS, suggestionsFor } from './palette-scope';
import type { Command } from './registry';

describe('palette suggestions', () => {
  it('offers Fill & sign for fields and Recognize text for scans, and nothing else', () => {
    expect(suggestionsFor({ fields: true, textlessPages: 0 })).toEqual(['fill-sign']);
    expect(suggestionsFor({ fields: false, textlessPages: 3 })).toEqual(['recognize']);
    expect(suggestionsFor({ fields: true, textlessPages: 3 })).toEqual(['fill-sign', 'recognize']);
    expect(suggestionsFor({ fields: false, textlessPages: 0 })).toEqual([]);
  });

  it('scopes only page commands', () => {
    expect(PAGE_SCOPE_COMMANDS.every((id) => id.startsWith('pages.'))).toBe(true);
  });
});

describe('palette scope', () => {
  const command = (id: string, title: string, group: string): Command =>
    ({ id, title, group, shortcuts: [] }) as unknown as Command;
  const commands = [
    command('view.zoomIn', 'Zoom in', 'View'),
    command('pages.rotateRight', 'Rotate right', 'Pages'),
    command('pages.delete', 'Delete pages', 'Pages'),
    command('pages.insertBlank', 'Insert blank page', 'Pages'),
  ];
  const sections = (query: string, scope: readonly string[]) =>
    buildSections(
      query,
      commands,
      [],
      () => true,
      () => undefined,
      scope,
    ).map((s) => [s.group, s.rows.map((r) => r.command.id)]);

  it('shows only the selection actions when scoped and nothing is typed', () => {
    expect(sections('', ['pages.delete', 'pages.rotateRight'])).toEqual([
      [SCOPE_GROUP, ['pages.delete', 'pages.rotateRight']],
    ]);
    expect(sections('', [])).toEqual([
      ['View', ['view.zoomIn']],
      ['Pages', ['pages.rotateRight', 'pages.delete', 'pages.insertBlank']],
    ]);
  });

  it('keeps the other matches below the selection ones when text is typed', () => {
    expect(sections('pages', ['pages.delete']).map(([group]) => group)).toEqual([
      SCOPE_GROUP,
      'Pages',
    ]);
  });

  it('puts a typed selection match above a same-score global one', () => {
    expect(sections('pages', ['pages.delete'])[0]).toEqual([SCOPE_GROUP, ['pages.delete']]);
    expect(sections('pages', [])[0]?.[0]).toBe('Pages');
  });
});

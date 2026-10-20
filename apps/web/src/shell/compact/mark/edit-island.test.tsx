/**
 * The edit island's tool chip (`design/phone-2026-10/README.md` §3 "Feel"; EDN-8): a new tool's
 * glyph cross-fades in over the old one, and once that has settled exactly one glyph is left,
 * after one change, after several in a row, with the ink's dot over it.
 */
import '../../../styles/tokens.css';
import '../../../styles/reset.css';
import '../../../styles/global.css';

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { settled } from '../../../../test/settled';
import { setCompactTool } from '../compact-store';
import { EditIsland } from './EditIsland';
import { registerCompactTool, resetCompactTools } from './registry';

/** The ink's dot: it keys by the tool id, as the glyph does. */
const Dot = () => <span data-testid="dot" />;

beforeEach(() => {
  registerCompactTool({
    id: 'pen',
    glyph: 'pen',
    label: () => 'Pen',
    place: 'tile',
    order: 10,
    Badge: Dot,
  });
  registerCompactTool({
    id: 'highlight',
    glyph: 'highlighter',
    label: () => 'Highlight',
    place: 'tile',
    order: 20,
  });
  registerCompactTool({
    id: 'text',
    glyph: 'textbox',
    label: () => 'Text',
    place: 'tile',
    order: 30,
  });
  setCompactTool('pen');
});

afterEach(() => {
  cleanup();
  resetCompactTools();
  setCompactTool(null);
});

const glyphs = () => [...screen.getByTestId('compact-tool-chip').querySelectorAll('svg')];

describe('the tool chip glyph', () => {
  it('ends with the current glyph alone after several quick changes', async () => {
    render(<EditIsland />);
    expect(glyphs()).toHaveLength(1);
    act(() => setCompactTool('highlight'));
    act(() => setCompactTool('text'));
    act(() => setCompactTool('pen'));
    await settled(screen.getByTestId('compact-tool-chip'));
    await waitFor(() => expect(glyphs()).toHaveLength(1));
    expect(glyphs()[0]?.getAttribute('data-icon')).toBe('pen');
    expect(glyphs()[0]?.getAttribute('class')).toMatch(/in/);
  });
});

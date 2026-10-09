/**
 * The sheet grammar's grouped lists in a real browser (system-audit-2026-10 §3.6.1): the group
 * sits concentric with the panel at its inset, its rows are the M size with hairlines between
 * them, the row text lines up with the header's title, and the label names the group.
 */
import '../../styles/tokens.css';
import '../../styles/reset.css';
import '../../styles/global.css';

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';

import { Button } from '../Button';
import { Sheet } from './Sheet';
import { SheetGroup, SheetRow } from './SheetGroup';
import { useSheetStore } from './sheet-store';

beforeEach(async () => {
  useSheetStore.setState({ open: null, front: null, confirm: null, drafts: {} });
  await page.viewport(1440, 900);
});

function Harness() {
  return (
    <Sheet id="grouped" kind="task" open onClose={() => undefined} title="Save a copy">
      <SheetGroup label="Format" footnote="Applies to this copy only.">
        <SheetRow title="Type" value="PDF" />
        <SheetRow title="Password" description="Anyone with the password can open it">
          <Button size="sm">Set…</Button>
        </SheetRow>
      </SheetGroup>
    </Sheet>
  );
}

describe('SheetGroup and SheetRow (system audit §3.6.1)', () => {
  it('insets the group 8 px at radius 12, rows 44 px, the text on the title’s line', async () => {
    render(<Harness />);
    const group = screen.getByRole('group', { name: 'Format' });
    const panel = group.closest<HTMLElement>('[data-sheet]');
    expect(panel).not.toBeNull();
    await waitFor(() => expect(panel?.getAnimations().length).toBe(0), { timeout: 3000 });
    const p = panel?.getBoundingClientRect() ?? new DOMRect();
    const g = group.getBoundingClientRect();
    // From the panel's inner edge (inside its 1 px rim).
    const rim = panel?.clientLeft ?? 0;
    expect(g.left - p.left - rim).toBe(8);
    expect(p.right - g.right - rim).toBe(8);
    expect(getComputedStyle(group).borderTopLeftRadius).toBe('12px');
    const rows = group.querySelectorAll<HTMLElement>('[data-sheet-row]');
    expect(rows[0]?.getBoundingClientRect().height).toBe(44);
    expect(rows[1]?.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    // The hairline is the second row's, inset by the row padding.
    expect(getComputedStyle(rows[1] as Element, '::before').left).toBe('12px');
    const title = screen.getByRole('heading', { name: 'Save a copy' });
    const name = screen.getByText('Type');
    expect(name.getBoundingClientRect().left).toBeCloseTo(title.getBoundingClientRect().left, 0);
    // The section label: footnote 600 in the secondary colour, on the rows' text line.
    const label = screen.getByRole('heading', { name: 'Format' });
    expect(getComputedStyle(label).fontWeight).toBe('600');
    expect(label.getBoundingClientRect().left + 12).toBeCloseTo(
      name.getBoundingClientRect().left,
      0,
    );
    expect(screen.getByText('PDF')).toBeVisible();
    const set = screen.getByRole('button', { name: 'Set…' });
    // The trailing control ends on the rows' padding.
    expect(g.right - set.getBoundingClientRect().right).toBe(12);
  });
});

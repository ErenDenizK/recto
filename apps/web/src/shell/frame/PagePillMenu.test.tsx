/**
 * The page pill's menu (`01-frame.md` F11 §2, §6; decisions DSN-9, DSN-29; Vitest browser mode,
 * PDFium): it fits. Its width hugs its content between the recipe's width and the free
 * rectangle, it never scrolls sideways (a long Contents title once widened its one column past
 * the popover, cutting off Fit and layout), and Contents is one row naming the current section.
 * It is the popover's glass, with the page field alone (no label, no Go) and the layouts as
 * glyphs named in full.
 */
import '../../styles/tokens.css';
import '../../styles/reset.css';
import '../../styles/global.css';

import {
  getActiveDocument,
  type OutlineNode,
  type VirtualDocument,
} from '@pdf-editor/document-model';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import simpleUrl from '../../../../../test/fixtures/simple-text.pdf?url';
import { fixtureFile } from '../../../test/store-harness';
import { settled } from '../../../test/settled';
import { useViewStore } from '../../state/view-store';
import { resetWorkspace, useWorkspaceStore } from '../../state/workspace-store';
import { closePillMenu, openPillMenu, useFrameStore } from './frame-store';
import { currentSection, PagePillMenu } from './PagePillMenu';

const LONG = 'English Proficiency Exam (EPE) – Writing Section, Opinion and Comparison Essays';

async function openDoc(): Promise<VirtualDocument> {
  await useWorkspaceStore.getState().openFiles([await fixtureFile(simpleUrl, 'simple.pdf')]);
  const doc = getActiveDocument(useWorkspaceStore.getState().workspace) as VirtualDocument;
  const first = doc.pages[0];
  if (!first) throw new Error('no pages');
  const entry = (title: string): OutlineNode => ({
    title,
    open: false,
    children: [],
    destination: { kind: 'page', page: first.id },
  });
  return { ...doc, outline: [entry(LONG), entry('Opinion essay')] };
}

async function openMenu(doc: VirtualDocument): Promise<HTMLElement> {
  render(
    <div id="page-pill" style={{ position: 'fixed', right: 16, bottom: 16, width: 120 }}>
      <PagePillMenu doc={doc} />
    </div>,
  );
  openPillMenu();
  const menu = await screen.findByTestId('page-pill-menu');
  await settled(menu);
  return menu;
}

beforeEach(() => {
  resetWorkspace();
  useViewStore.setState({ currentPage: 0 });
});

afterEach(() => {
  closePillMenu();
  cleanup();
});

describe('the page pill menu fits (DSN-9)', () => {
  for (const width of [1440, 700, 360]) {
    it(`never scrolls sideways and stays inside a ${width} px window`, async () => {
      await page.viewport(width, 800);
      const menu = await openMenu(await openDoc());
      expect(menu.scrollWidth).toBeLessThanOrEqual(menu.clientWidth);
      const box = menu.getBoundingClientRect();
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(window.innerWidth);
      // Every control sits inside the menu's content box.
      for (const control of menu.querySelectorAll<HTMLElement>('button, input, [role="radio"]')) {
        const r = control.getBoundingClientRect();
        expect(r.right, control.textContent ?? '').toBeLessThanOrEqual(box.right + 0.5);
      }
      // Fit and layout stay Segmented at desktop and tablet widths (09 §6.2).
      if (width >= 700) expect(within(menu).getAllByRole('radiogroup')).toHaveLength(2);
    });
  }

  it('hugs the recipe width rather than the long section title', async () => {
    await page.viewport(1440, 800);
    const menu = await openMenu(await openDoc());
    expect(menu.getBoundingClientRect().width).toBeLessThan(400);
  });
});

describe('the page pill menu is small glass (DSN-29)', () => {
  it('takes the popover’s M4 glass, not a solid twin', async () => {
    await page.viewport(1440, 800);
    const menu = await openMenu(await openDoc());
    expect(menu.classList.contains('mat-menu')).toBe(true);
    expect(menu.classList.contains('mat-opaque')).toBe(false);
  });

  it('has the page field alone: named Go to page, the total in its well, Enter jumps', async () => {
    await page.viewport(1440, 800);
    const doc = await openDoc();
    const menu = await openMenu(doc);
    expect(within(menu).queryByRole('button', { name: 'Go' })).toBeNull();
    const field = within(menu).getByRole<HTMLInputElement>('textbox', { name: 'Go to page' });
    expect(field.value).toBe('1');
    const of = document.getElementById(field.getAttribute('aria-describedby')?.split(' ')[0] ?? '');
    expect(of?.textContent).toBe(`/ ${doc.pages.length}`);

    // An unknown page keeps the menu open and says which pages there are.
    await userEvent.fill(field, '99');
    await userEvent.keyboard('{Enter}');
    await expect.poll(() => field.getAttribute('aria-invalid')).toBe('true');
    expect(menu.textContent).toContain(`Pages 1–${doc.pages.length}`);
    expect(useFrameStore.getState().pillMenu).not.toBeNull();

    // A known one jumps and closes the menu.
    await userEvent.fill(field, '1');
    await userEvent.keyboard('{Enter}');
    await expect.poll(() => useFrameStore.getState().pillMenu).toBeNull();
  });

  it('draws the layouts as glyphs, named in full', async () => {
    await page.viewport(1440, 800);
    const menu = await openMenu(await openDoc());
    const layouts = within(menu).getByRole('radiogroup', { name: 'Page layout' });
    for (const name of ['Continuous', 'Single page', 'Two pages']) {
      const radio = within(layouts).getByRole('radio', { name });
      expect(radio.querySelector('svg[data-icon]'), name).not.toBeNull();
    }
  });
});

describe('the page pill menu rows', () => {
  it('shows Contents as one row with the current section, not the outline', async () => {
    await page.viewport(1440, 800);
    const menu = await openMenu(await openDoc());
    const contents = within(menu).getByTestId('pill-contents');
    expect(contents.textContent).toContain('Contents');
    expect(contents.textContent).toContain('Opinion essay');
    expect(within(menu).queryByText(LONG)).toBeNull();
    expect(within(menu).getByRole('radio', { name: 'Fit width' })).toBeTruthy();
    expect(within(menu).getByRole('radio', { name: 'Two pages' })).toBeTruthy();
  });

  it('opens the sidebar from medium up; with no sidebar (compact) it lists the entries', async () => {
    await page.viewport(1440, 800);
    const doc = await openDoc();
    let menu = await openMenu(doc);
    expect(within(menu).getByTestId('pill-contents').getAttribute('aria-expanded')).toBeNull();
    closePillMenu();
    cleanup();

    await page.viewport(560, 800);
    menu = await openMenu(doc);
    const contents = within(menu).getByTestId('pill-contents');
    expect(contents.getAttribute('aria-expanded')).toBe('false');
    expect(within(menu).queryByRole('button', { name: 'Opinion essay' })).toBeNull();
    contents.click();
    await expect.poll(() => contents.getAttribute('aria-expanded')).toBe('true');
    const list = within(menu).getByRole('group', { name: 'Contents' });
    expect(contents.getAttribute('aria-controls')).toBe(list.id);
    expect(within(list).getByRole('button', { name: 'Opinion essay' })).toBeTruthy();
    expect(within(list).getByRole('button', { name: LONG })).toBeTruthy();
    // Still no sideways scroll with the long title listed.
    expect(menu.scrollWidth).toBeLessThanOrEqual(menu.clientWidth);
  });

  it('picks the last top-level entry that starts on or before the page', async () => {
    const doc = await openDoc();
    const [a, b] = doc.pages;
    if (!a || !b) return;
    const node = (title: string, page: typeof a.id): OutlineNode => ({
      title,
      open: false,
      children: [],
      destination: { kind: 'page', page },
    });
    const outlined = { ...doc, outline: [node('One', a.id), node('Two', b.id)] };
    expect(currentSection(outlined, 0)?.title).toBe('One');
    expect(currentSection(outlined, 1)?.title).toBe('Two');
    expect(currentSection({ ...doc, outline: [node('Two', b.id)] }, 0)).toBeUndefined();
  });
});

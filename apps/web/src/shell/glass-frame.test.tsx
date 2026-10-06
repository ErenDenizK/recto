/**
 * The docked frame's paint (ADR-0024 §2.4, §2.8; language.md §2.2, §2.4, §2.8; spec D3-3;
 * Vitest browser mode, real style sheets): the top strip is docked M3 glass by default (σ 8, the
 * panel tint, which over the bare canvas composites to --surface-frame exactly), with the inner
 * light and no shadow; Glass Tinted lays the tint at 0.90 and keeps the blur; Glass Solid paints
 * the frame colour with no filter. The palette sets each value.
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { App } from '../app';
import { commandRegistry } from '../commands/registry';
import { DEFAULT_APPEARANCE, useAppearanceStore } from '../state/appearance-store';
import { useUiStore } from '../state/ui-store';
import { resetWorkspace } from '../state/workspace-store';

const SURFACE_1 = 'rgb(23, 25, 30)';

function frame() {
  const shell = screen.getByTestId('app-shell');
  const el = shell.querySelector<HTMLElement>(':scope > header');
  if (!el) throw new Error('no top strip');
  // The top strip (01-frame F2); the sidebar shows only in a document and the status bar is
  // gone (D2-1), so the strip is the frame with no document open.
  return { shell, title: getComputedStyle(el) };
}

const blurOf = (style: CSSStyleDeclaration) =>
  style.backdropFilter || style.getPropertyValue('-webkit-backdrop-filter');

describe('the docked frame', () => {
  beforeEach(() => {
    useUiStore.setState({ docUi: {}, paletteOpen: false, shortcutsOpen: false });
    useAppearanceStore.setState(DEFAULT_APPEARANCE);
    resetWorkspace();
  });
  afterEach(() => {
    useAppearanceStore.setState(DEFAULT_APPEARANCE);
  });

  it('is docked M3 glass at rest, with no page near (ADR-0024 §2.8)', async () => {
    render(<App />);
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-glass', 'clear'));
    const { shell, title } = frame();
    expect(shell).toHaveAttribute('data-stage-bleed');
    expect(shell.hasAttribute('data-glass-near')).toBe(false);
    // σ 8 at the 44 px strip (coverage registry `top-strip`), the panel tier's chain.
    expect(blurOf(title)).toBe('blur(8px) saturate(1.5) brightness(0.45)');
    expect(title.backgroundColor).toBe('rgba(30, 32, 38, 0.74)');
    // No shadow and no edge on docked glass: the inner top light only (language.md §2.4).
    const layers = title.boxShadow.split(/,(?![^(]*\))/).map((layer) => layer.trim());
    expect(layers.filter((layer) => !layer.startsWith('rgba(0, 0, 0, 0)'))).toEqual([
      'rgba(255, 255, 255, 0.06) 0px 1px 0px 0px inset',
    ]);
    // Text is on the glass ladder at once, so nothing jumps when a page passes.
    expect(title.getPropertyValue('--text-secondary').trim()).toBe('#bbbec3');
    // The stage sits under the frame (the strip is the top layer, AppShell.module.css).
    expect(title.zIndex).toBe('4');
  });

  it('lays the tint at 0.90 under Tinted and paints the frame colour under Solid', async () => {
    render(<App />);
    act(() => useAppearanceStore.getState().setGlass('tinted'));
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-glass', 'tinted'));
    const tinted = frame().title;
    expect(tinted.backgroundColor).toBe('rgba(30, 32, 38, 0.9)');
    expect(blurOf(tinted)).toBe('blur(8px) saturate(1.5) brightness(0.45)');

    act(() => useAppearanceStore.getState().setGlass('solid'));
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-glass', 'solid'));
    const solid = frame().title;
    expect(['', 'none']).toContain(blurOf(solid));
    expect(solid.backgroundColor).toBe(SURFACE_1);
    // Solid keeps the rim (language.md §2.8): the inner light stays.
    expect(solid.boxShadow).toMatch(/rgba\(255, 255, 255, 0\.06\) 0px 1px 0px 0px inset/);
    // The normal text ladder comes back on an opaque surface.
    expect(solid.getPropertyValue('--text-secondary').trim()).not.toBe('#bbbec3');
  });

  it('offers Glass: Clear, Tinted and Solid in the palette, each setting its value', async () => {
    render(<App />);
    const title = (id: string) => commandRegistry.get(id)?.title;
    expect(title('view.glass.clear')).toBe('Glass: Clear');
    expect(title('view.glass.tinted')).toBe('Glass: Tinted');
    expect(title('view.glass.solid')).toBe('Glass: Solid');
    for (const glass of ['solid', 'tinted', 'clear'] as const) {
      await act(async () => {
        await commandRegistry.execute(`view.glass.${glass}`);
      });
      expect(useAppearanceStore.getState().glass).toBe(glass);
      await waitFor(() => expect(document.documentElement).toHaveAttribute('data-glass', glass));
    }
    // Found by M8's wording too.
    expect(commandRegistry.get('view.glass.solid')?.keywords).toContain('reduce transparency');
    expect(commandRegistry.get('view.glass.tinted')?.keywords).toContain('saydamlık');
  });
});

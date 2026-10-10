/**
 * The sidebar laid over the page (01-frame F1 §2): on medium and compact-height it shows only
 * once asked for in this window, whatever the stored layout says; ▤ and Mod+B show and put
 * it away without touching the floating sidebar's stored state.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { showOutlinePanel } from '../../outline/outline-actions';
import { useUiStore } from '../../state/ui-store';
import {
  resetFrameStore,
  setSidebarOverlay,
  showOverlaySidebar,
  sidebarShown,
  toggleSidebar,
  useFrameStore,
} from './frame-store';

const shown = () => sidebarShown(useUiStore.getState().leftPanelOpen, useFrameStore.getState());

describe('the sidebar toggle', () => {
  beforeEach(() => {
    resetFrameStore();
    useUiStore.setState({ leftPanelOpen: true });
  });
  afterEach(() => {
    resetFrameStore();
    useUiStore.setState({ leftPanelOpen: true });
  });

  it('flips the stored state while floating', () => {
    expect(shown()).toBe(true);
    toggleSidebar();
    expect(useUiStore.getState().leftPanelOpen).toBe(false);
    expect(shown()).toBe(false);
    toggleSidebar();
    expect(shown()).toBe(true);
  });

  it('laid over the page, starts away and shows once asked for, keeping the stored state', () => {
    setSidebarOverlay(true);
    expect(shown()).toBe(false);
    toggleSidebar();
    expect(shown()).toBe(true);
    toggleSidebar();
    expect(shown()).toBe(false);
    expect(useUiStore.getState().leftPanelOpen).toBe(true);
  });

  it('laid over the page with the stored state closed, opens both', () => {
    useUiStore.setState({ leftPanelOpen: false });
    setSidebarOverlay(true);
    toggleSidebar();
    expect(useUiStore.getState().leftPanelOpen).toBe(true);
    expect(shown()).toBe(true);
  });

  it('forgets the request when the window changes class', () => {
    setSidebarOverlay(true);
    showOverlaySidebar(true);
    setSidebarOverlay(false);
    setSidebarOverlay(true);
    expect(shown()).toBe(false);
  });

  it("the pill's Contents shows the laid-over sidebar put away on Pages (F11 §6)", () => {
    setSidebarOverlay(true);
    useUiStore.setState({ leftPanelOpen: true, leftPanelView: 'pages', pagesView: 'thumbnails' });
    showOverlaySidebar(true);
    showOverlaySidebar(false);
    showOutlinePanel();
    expect(useUiStore.getState().pagesView).toBe('bookmarks');
    expect(shown()).toBe(true);
    // Already on Contents and put away: still shown again.
    showOverlaySidebar(false);
    showOutlinePanel();
    expect(shown()).toBe(true);
  });
});

/**
 * Option B of the glass scroll bar, the contents ruler (R29 study, GLS-26 amendment;
 * `?scroll=glass-b`, reader only): under the pointer or a finger the outline's section titles
 * stand along the bar where their sections lie, the section being read in a stronger chip; while
 * the bar is dragged a card beside the thumb shows the page's thumbnail, its section's heading
 * and the Find hits on it. It repeats the margin map and the sidebar's Contents (DSN-72, DSN-46)
 * and stays a prototype until the owner picks.
 *
 * Loaded by `scroll-thumbs.ts` once the flag is on, so nothing of it is in the first load. It is
 * told of the vertical bar's state on every move (`RulerState`) and reads no layout: titles are
 * placed by `transform` when the map or the track's length changes, the card follows the thumb by
 * one `transform` per move. Both are solid (Q-5, they move), fade by opacity on `--duration-fast`
 * (MOT-4; reduced motion keeps only the fade) and are `aria-hidden`: keyboard and assistive
 * technology keep native scrolling and the sidebar's Contents. Limits: the titles stand on the
 * bar's left, so a right-to-left reader reads them on its page; sections lie by page index
 * (DSN-62's limit); titles closer than `ROW` px give way, except the current one.
 */
import { getActiveDocument } from '@pdf-editor/document-model';
import { createRoot } from 'react-dom/client';

import { m } from '../i18n';
import { FindThumb } from '../shell/sidebar/FindThumb';
import { useWorkspaceStore } from '../state/workspace-store';
import styles from './scroll-glass.module.css';
import type { RulerState, ScrollMap } from './scroll-thumbs';

/** Titles closer than this along the track give way, px. */
const ROW = 22;
/** The card's size and its distance from the bar's left edge, CSS px. */
const CARD = { width: 264, height: 84 } as const;
const GAP = 12;
const MARGIN = 8;

function Card({
  page,
  total,
  heading,
  hits,
}: {
  readonly page: number;
  readonly total: number;
  readonly heading: string;
  readonly hits: number;
}) {
  const doc = getActiveDocument(useWorkspaceStore.getState().workspace);
  return (
    <>
      {doc ? <FindThumb doc={doc} pageIndex={page} width={44} height={60} /> : null}
      <span className={styles.text}>
        <span className={styles.head}>
          {heading === '' ? m.search_page({ number: page + 1 }) : heading}
        </span>
        <span className={styles.meta}>
          {`${page + 1} / ${total}`}
          {hits > 0 ? (
            <strong className={styles.hits}>{m.findmap_matches({ count: hits })}</strong>
          ) : null}
        </span>
      </span>
    </>
  );
}

/** The ruler and its card, in the scroll bar's layer; `destroy` takes them away. */
export function createRuler(layer: HTMLElement) {
  const ruler = document.createElement('div');
  ruler.className = styles.ruler ?? '';
  ruler.setAttribute('aria-hidden', 'true');
  const host = document.createElement('div');
  host.className = styles.host ?? '';
  host.setAttribute('aria-hidden', 'true');
  host.dataset.testid = 'scroll-card';
  const panel = document.createElement('div');
  panel.className = styles.card ?? '';
  host.append(panel);
  layer.append(ruler, host);
  const root = createRoot(panel);

  let laidFor: ScrollMap | null = null;
  let laidRoom = -1;
  let titles: HTMLElement[] = [];
  let current = -1;
  let cardKey = '';

  const lay = (map: ScrollMap, room: number) => {
    if (map === laidFor && room === laidRoom) return;
    laidFor = map;
    laidRoom = room;
    current = -1;
    let last = -Infinity;
    titles = map.sections.map((section) => {
      const el = document.createElement('div');
      const y = Math.round(section.at * room);
      el.className = styles.title ?? '';
      el.textContent = section.title;
      el.style.transform = `translateY(${y}px)`;
      if (y - last < ROW) el.dataset.skip = '';
      else last = y;
      return el;
    });
    ruler.replaceChildren(...titles);
  };

  const sync = (state: RulerState | null) => {
    if (!state) {
      delete ruler.dataset.open;
      delete host.dataset.open;
      cardKey = '';
      return;
    }
    lay(state.map, state.room);
    ruler.style.transform = `translate(${state.left}px, ${state.top}px)`;
    // The titles are for reaching; dragged, the card speaks and the titles step aside.
    ruler.toggleAttribute('data-open', state.hot && !state.drag);
    const under = state.hot || state.drag ? state.map.at(state.scrollTop) : undefined;
    const section = under?.section ?? -1;
    if (section !== current) {
      titles[current]?.classList.remove(styles.current ?? '');
      titles[section]?.classList.add(styles.current ?? '');
      current = section;
    }
    host.toggleAttribute('data-open', state.drag && under !== undefined);
    if (!state.drag || !under) {
      cardKey = '';
      return;
    }
    // Left of the bar, centred on the thumb, inside the free rectangle (`--free-*`).
    const style = getComputedStyle(document.documentElement);
    const free = (side: string) => Number.parseFloat(style.getPropertyValue(`--free-${side}`)) || 0;
    const low = free('top') + MARGIN;
    const high = Math.max(low, window.innerHeight - free('bottom') - CARD.height - MARGIN);
    const y = Math.min(
      high,
      Math.max(low, state.top + state.thumb + state.size / 2 - CARD.height / 2),
    );
    host.style.transform = `translate(${Math.max(MARGIN, state.left - GAP - CARD.width)}px, ${Math.round(y)}px)`;
    const key = `${under.page}|${under.heading}|${under.hits}`;
    if (key === cardKey) return;
    cardKey = key;
    root.render(
      <Card page={under.page} total={state.map.pages} heading={under.heading} hits={under.hits} />,
    );
  };

  return {
    sync,
    destroy: () => {
      root.unmount();
      ruler.remove();
      host.remove();
    },
  };
}

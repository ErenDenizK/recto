/**
 * The find map's card (R26 concept 3; DSN-65): beside a hit tick on the scroll bar, a small solid
 * card with the page's thumbnail, "Page 4 · 3 matches" and the hit's sentence with the match
 * emphasised (`cutSnippet`, the sidebar's). Loaded at the first hover, tap or step
 * (`find-map.ts`), so it adds nothing to the editor's first load.
 *
 * - **Motion** (motion core, ADR-0026): the card rises and fades in on the `quick` spring and
 *   follows the pointer from tick to tick on a spring that keeps its velocity through a retarget
 *   (Q-10); it fades out on leaving. Under reduced motion it only fades (§7.5).
 * - **Material:** solid, never blurred (Q-5: a small moving part).
 * - **Assistive technology:** the card is a picture of what the tick means; the same words are
 *   spoken by `find-map.ts` (a polite announcement) when a tick is chosen or a step lands, so
 *   the card itself is `aria-hidden` and takes no pointer or focus.
 */
import { getActiveDocument } from '@pdf-editor/document-model';
import { createRoot, type Root } from 'react-dom/client';

import { m } from '../i18n';
import { animate, animateStyle, type Motion } from '../motion';
import { cutSnippet } from '../shell/sidebar/snippet';
import { FindThumb } from '../shell/sidebar/FindThumb';
import { useWorkspaceStore } from '../state/workspace-store';
import styles from './find-map-card.module.css';
import { useSearchStore } from './search';
import type { TickPage } from './tick-hit';

/** The card's size, CSS px (fixed, so placing it never measures). */
export const CARD = { width: 264, height: 84 } as const;
/** Between the card and the rail, and from the window's edges. */
const GAP = 12;
const MARGIN = 8;
/** How far it rises into place. */
const RISE = 8;

let host: HTMLDivElement | null = null;
let panel: HTMLDivElement | null = null;
let root: Root | null = null;
let fade: Motion | null = null;
let move: Motion | null = null;
let at = { x: 0, y: 0 };
let page = -1;
let visible = false;

function Card({ tick }: { readonly tick: TickPage }) {
  const state = useSearchStore.getState();
  const workspace = useWorkspaceStore.getState().workspace;
  const doc = getActiveDocument(workspace);
  // The current hit when it is on this page, else the page's first.
  const index =
    state.current >= tick.first && state.current < tick.first + tick.count
      ? state.current
      : tick.first;
  const hit = state.hits[index];
  if (!doc || !hit) return null;
  const parts = cutSnippet(hit, state.query, state.matchCase);
  return (
    <>
      <FindThumb doc={doc} pageIndex={tick.pageIndex} width={44} height={60} />
      <span className={styles.text}>
        <span className={styles.head}>
          <span className={styles.page}>{m.search_page({ number: tick.pageIndex + 1 })}</span>
          <span className={styles.count}>{m.findmap_matches({ count: tick.count })}</span>
        </span>
        <span className={styles.snippet}>
          {parts.before}
          {parts.match ? <strong className={styles.match}>{parts.match}</strong> : null}
          {parts.after}
        </span>
      </span>
    </>
  );
}

function ensure(): { host: HTMLDivElement; panel: HTMLDivElement; root: Root } {
  if (host && panel && root) return { host, panel, root };
  host = document.createElement('div');
  host.className = styles.host ?? '';
  host.hidden = true;
  host.setAttribute('aria-hidden', 'true');
  host.dataset.testid = 'find-map-card';
  panel = document.createElement('div');
  panel.className = styles.card ?? '';
  host.append(panel);
  document.body.append(host);
  root = createRoot(panel);
  return { host, panel, root };
}

/** Shows the card for `tick`, its right edge `GAP` left of `rail` and centred on `y`. */
export function showCard(tick: TickPage, rail: number, y: number): void {
  const el = ensure();
  const x = Math.max(MARGIN, rail - GAP - CARD.width);
  const top = Math.min(
    Math.max(MARGIN, y - CARD.height / 2),
    Math.max(MARGIN, window.innerHeight - CARD.height - MARGIN),
  );
  const place = (value: number) => {
    at = { x, y: value };
    el.host.style.transform = `translate(${x}px, ${value}px)`;
  };
  if (page !== tick.pageIndex || !visible) {
    el.root.render(<Card tick={tick} />);
    page = tick.pageIndex;
  }
  if (!visible) {
    visible = true;
    move?.stop();
    move = null;
    place(top);
    // Still fading out from a moment ago: turn back from where it is.
    if (fade && !el.host.hidden) fade.retarget(1);
    else {
      el.host.hidden = false;
      fade = animateStyle(el.panel, 'opacity', 0, 1, {
        spring: 'quick',
        keep: true,
        onComplete: () => {
          if (!visible && host) host.hidden = true;
        },
      });
      animateStyle(el.panel, 'transform', [RISE, 0, 0.96], [0, 0, 1], { spring: 'quick' });
    }
    return;
  }
  fade?.retarget(1);
  if (top === at.y) return;
  if (move) move.retarget(top);
  else
    move = animate(at.y, top, {
      spring: 'quick',
      onUpdate: place,
      onComplete: () => {
        move = null;
      },
    });
}

/** Fades the card out; its content stays until it has gone. */
export function hideCard(): void {
  if (!visible) return;
  visible = false;
  page = -1;
  if (fade) fade.retarget(0);
  else if (host) host.hidden = true;
}

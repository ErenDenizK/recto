/**
 * The Text view (PRD-36, DSN-84) against a fake loader built on the contract: its semantic tree,
 * its states (skeleton, failure, scan, OCR progress), the reading prefs as live CSS variables, the
 * place it opens at and keeps, Find's mark, the bar, and reduced motion. The data layer has its
 * own tests; nothing here reaches the engine.
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import type { TextViewBlock } from '@pdf-editor/engine';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { settled } from '../../test/settled';
import type { TextViewHostProps } from './contract';
import {
  type FakeLoader,
  fakeCrops,
  fakeLoader,
  fakeOcr,
  heading,
  paragraph,
  scanPage,
  textPage,
} from './fake-loader';
import { reloadReadingPrefs, setReadingPrefs } from './reading-prefs';
import { TextView } from './TextView';

const LONG =
  'A lease is a contract by which one party conveys an estate in property to another party for a limited term in exchange for rent.';

const list: TextViewBlock = {
  kind: 'list',
  id: 'p1-4',
  page: 0,
  ordered: false,
  bbox: { x: 40, y: 300, width: 400, height: 90 },
  items: [
    { text: 'Alpha', depth: 0, bbox: { x: 40, y: 300, width: 400, height: 20 } },
    { text: 'Beta', depth: 1, bbox: { x: 60, y: 330, width: 380, height: 20 } },
    { text: 'Gamma', depth: 0, bbox: { x: 40, y: 360, width: 400, height: 20 } },
  ],
};

const image: TextViewBlock = {
  kind: 'image',
  id: 'p1-5',
  page: 0,
  bbox: { x: 40, y: 400, width: 200, height: 100 },
};

function documentPages() {
  return [
    textPage(0, [
      heading(0, 0, 1, 'Residential lease'),
      heading(0, 1, 2, 'Rent'),
      paragraph(0, 2, 'The quick brown fox.'),
      paragraph(0, 3, LONG, 200),
      list,
      image,
    ]),
    textPage(
      1,
      Array.from({ length: 14 }, (_, n) => paragraph(1, n, `${LONG} ${LONG}`)),
    ),
    textPage(2, [paragraph(2, 0, 'The last page.')]),
  ];
}

const handlers = () => ({
  onPlace: vi.fn(),
  onPageView: vi.fn(),
  onGoto: vi.fn(),
  onFind: vi.fn(),
  onShowPage: vi.fn(),
});

function View(props: Partial<TextViewHostProps> & { loader: FakeLoader }) {
  const defaults: TextViewHostProps = {
    title: 'Lease',
    loader: props.loader,
    crops: fakeCrops(),
    ocr: fakeOcr(),
    place: { page: 0, y: 0 },
    jump: null,
    mark: null,
    hidden: false,
    ...handlers(),
  };
  return (
    <div style={{ position: 'relative', width: 390, height: 844 }}>
      <TextView {...defaults} {...props} />
    </div>
  );
}

const article = () => screen.getByTestId('text-view-article');
const root = () => screen.getByTestId('text-view');
const topline = () =>
  article().getBoundingClientRect().top +
  Number.parseFloat(getComputedStyle(article()).scrollPaddingTop);
const blockTop = (id: string) =>
  (article().querySelector(`[data-block-id="${id}"]`) as HTMLElement).getBoundingClientRect().top;

beforeEach(() => {
  localStorage.clear();
  reloadReadingPrefs();
});

afterEach(() => {
  document.documentElement.removeAttribute('data-motion');
  document.documentElement.removeAttribute('data-theme');
});

describe('the semantic tree (PRD-36 §7)', () => {
  it('is a labelled article with h2 to h5, nested lists, separators and an honest note', async () => {
    render(<View loader={fakeLoader(documentPages(), { language: 'en' })} />);
    await settled(root());
    const text = screen.getByRole('article', { name: 'Text view of Lease' });
    expect(text).toHaveAttribute('tabindex', '0');
    expect(text).toHaveAttribute('lang', 'en');
    expect(screen.getByText(/Rebuilt from the page/)).toBeVisible();
    // The document title in the top bar stays the only h1: level 1 is an h2, level 2 an h3.
    expect(screen.getByRole('heading', { level: 2, name: 'Residential lease' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 3, name: 'Rent' })).toBeVisible();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    const nested = within(screen.getByTestId('text-view-list')).getAllByRole('list');
    expect(nested).toHaveLength(2);
    expect(within(nested[0] as HTMLElement).getAllByRole('listitem')).toHaveLength(3);
    expect(within(nested[1] as HTMLElement).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getAllByRole('separator', { name: /^Page \d$/ })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Show page' })).toHaveLength(3);
    expect(document.querySelector('[data-text-layer]')).toBeNull();
  });

  it('reserves an image box from its aspect ratio and draws the crop with its alt', async () => {
    const crops = fakeCrops();
    render(<View loader={fakeLoader(documentPages())} crops={crops} />);
    await settled(root());
    const box = screen.getByRole('button', { name: 'Image on page 1' });
    expect(box.style.aspectRatio).toBe('200 / 100');
    expect(await screen.findByRole('img', { name: 'Image on page 1' })).toBeVisible();
    expect(crops.calls[0]?.page).toBe(0);
  });

  it('opens the page view at the image box when it is tapped', async () => {
    const onShowPage = vi.fn();
    render(<View loader={fakeLoader(documentPages())} onShowPage={onShowPage} />);
    await userEvent.click(screen.getByRole('button', { name: 'Image on page 1' }));
    expect(onShowPage).toHaveBeenCalledWith({ page: 0, y: 400 });
  });
});

describe('states (PRD-36 §6)', () => {
  it('shows a skeleton while pages are read, and no text', () => {
    render(<View loader={fakeLoader(documentPages(), { hold: true })} />);
    expect(screen.getAllByTestId('text-view-skeleton')).toHaveLength(3);
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('shows a failure card per page with Try again and Show page', async () => {
    const loader = fakeLoader(documentPages());
    const onShowPage = vi.fn();
    render(<View loader={loader} onShowPage={onShowPage} />);
    act(() => loader.set(1, 'failed'));
    const card = screen.getByTestId('text-view-failed');
    expect(card).toHaveTextContent("This page's text could not be read.");
    await userEvent.click(within(card).getByRole('button', { name: 'Show page' }));
    expect(onShowPage).toHaveBeenCalledWith({ page: 1, y: 0 });
    await userEvent.click(within(card).getByRole('button', { name: 'Try again' }));
    expect(loader.asked).toContain(1);
    await waitFor(() => expect(screen.queryByTestId('text-view-failed')).toBeNull());
  });

  it('offers to recognize a scanned page, with the pack it costs, and runs it as one step', async () => {
    const loader = fakeLoader([textPage(0, [paragraph(0, 0, 'Text.')]), scanPage(1), scanPage(2)]);
    const ocr = fakeOcr();
    render(<View loader={loader} ocr={ocr} />);
    const card = screen.getAllByTestId('text-view-scanned')[0] as HTMLElement;
    expect(card).toHaveTextContent('This page is a scanned image, so it has no text yet.');
    await waitFor(() => expect(card).toHaveTextContent('Turkish and English'));
    await userEvent.click(within(card).getByRole('button', { name: 'Recognize text' }));
    // The page's group of four: the scans among pages 0 to 3.
    expect(ocr.runs).toEqual([[1, 2]]);
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Recognizing text, 0 of 2');
    act(() => ocr.progress(1, 2));
    await waitFor(() => expect(status).toHaveTextContent('1 of 2'));
    await act(async () => {
      ocr.finish();
      await Promise.resolve();
    });
    expect(loader.invalidated).toEqual([[1, 2]]);
    expect(loader.asked).toEqual(expect.arrayContaining([1, 2]));
  });

  it('says so when the run fails, and offers it again', async () => {
    const loader = fakeLoader([textPage(0, [paragraph(0, 0, 'Text.')]), scanPage(1)]);
    const ocr = fakeOcr();
    render(<View loader={loader} ocr={ocr} />);
    await userEvent.click(screen.getByRole('button', { name: 'Recognize text' }));
    await act(async () => {
      ocr.fail();
      await Promise.resolve();
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Text recognition failed');
    expect(screen.getByRole('button', { name: 'Recognize text' })).toBeVisible();
  });

  it('asks once at the top when every page read is a scan', async () => {
    const loader = fakeLoader([scanPage(0), scanPage(1), scanPage(2), scanPage(3)]);
    const ocr = fakeOcr();
    render(<View loader={loader} ocr={ocr} />);
    const top = screen.getByTestId('text-view-scans');
    expect(screen.getAllByRole('button', { name: /^Recognize/ })).toHaveLength(1);
    await userEvent.click(within(top).getByRole('button', { name: 'Recognize all pages' }));
    expect(ocr.runs).toEqual([[0, 1, 2, 3]]);
  });

  it('is inert and loads nothing while it is hidden, then loads and takes focus when shown', async () => {
    const loader = fakeLoader(documentPages());
    const { rerender } = render(<View loader={loader} hidden />);
    expect(root()).toHaveAttribute('inert');
    expect(loader.asked).toEqual([]);
    rerender(<View loader={loader} hidden={false} />);
    await waitFor(() => expect(loader.asked).toContain(0));
    expect(root()).not.toHaveAttribute('inert');
    expect(article()).toHaveFocus();
  });
});

describe('the look (DSN-84)', () => {
  it('sets size, line spacing and face as live variables on the root', () => {
    render(<View loader={fakeLoader(documentPages())} />);
    const body = () => screen.getByText('The quick brown fox.');
    expect(getComputedStyle(body()).fontSize).toBe('18px');
    expect(Number.parseFloat(getComputedStyle(body()).lineHeight)).toBeCloseTo(27, 0);
    act(() => setReadingPrefs({ size: 6, spacing: 'loose' }));
    expect(getComputedStyle(body()).fontSize).toBe('28px');
    expect(Number.parseFloat(getComputedStyle(body()).lineHeight)).toBeCloseTo(47.6, 0);
    expect(getComputedStyle(body()).fontFamily).not.toContain('Georgia');
    act(() => setReadingPrefs({ face: 'serif' }));
    expect(getComputedStyle(body()).fontFamily).toContain('Georgia');
  });

  it('follows the theme setting: Auto is the app’s, Light and Dark are their own', async () => {
    document.documentElement.setAttribute('data-theme', 'light');
    render(<View loader={fakeLoader(documentPages())} />);
    expect(root()).toHaveAttribute('data-theme', 'light');
    document.documentElement.setAttribute('data-theme', 'dark');
    await waitFor(() => expect(root()).toHaveAttribute('data-theme', 'dark'));
    act(() => setReadingPrefs({ theme: 'light' }));
    expect(root()).toHaveAttribute('data-theme', 'light');
    expect(getComputedStyle(root()).backgroundColor).toBe('rgb(253, 253, 255)');
    act(() => setReadingPrefs({ theme: 'dark' }));
    expect(getComputedStyle(root()).backgroundColor).toBe('rgb(16, 18, 21)');
  });

  it('enters with a fade of at most 150 ms and no rise under reduced motion', () => {
    document.documentElement.setAttribute('data-motion', 'reduced');
    render(<View loader={fakeLoader(documentPages())} />);
    const motions = root().getAnimations();
    expect(motions.length).toBeGreaterThan(0);
    for (const motion of motions) {
      const effect = motion.effect as KeyframeEffect;
      expect(Number(effect.getTiming().duration)).toBeLessThanOrEqual(150);
      for (const keyframe of effect.getKeyframes()) {
        expect(new DOMMatrix(String(keyframe.transform ?? 'none')).m42).toBe(0);
      }
    }
  });

  it('rises 4 px while it fades in otherwise', () => {
    render(<View loader={fakeLoader(documentPages())} />);
    const keyframes = (root().getAnimations()[0]?.effect as KeyframeEffect).getKeyframes();
    expect(new DOMMatrix(String(keyframes[0]?.transform)).m42).toBe(4);
  });
});

describe('the place (PRD-36 "Keeping the place")', () => {
  /** The block sits at the top line, the column's rise (a 4 px transform) being over. */
  const atTop = async (id: string) => {
    await waitFor(() => expect(Math.abs(blockTop(id) - topline())).toBeLessThan(2));
  };

  it('opens at the block of the place and reports where the reader goes from there', async () => {
    const onPlace = vi.fn();
    render(
      <View loader={fakeLoader(documentPages())} place={{ page: 1, y: 340 }} onPlace={onPlace} />,
    );
    await atTop('p2-5');
    // The reader takes over: from here on the place is where the column is.
    fireEvent.wheel(article());
    act(() => {
      article().scrollTop = 0;
    });
    await waitFor(() => expect(onPlace.mock.calls.at(-1)?.[0]).toMatchObject({ page: 0 }));
    // While it was being reached, the place asked for was not reported as another.
    expect(
      onPlace.mock.calls.slice(0, -1).every(([place]) => (place as { page: number }).page !== 0),
    ).toBe(true);
  });

  it('keeps the block at the top when the size changes', async () => {
    render(<View loader={fakeLoader(documentPages())} place={{ page: 1, y: 340 }} />);
    await atTop('p2-5');
    act(() => setReadingPrefs({ size: 6 }));
    await atTop('p2-5');
    act(() => setReadingPrefs({ size: 0, spacing: 'tight' }));
    await atTop('p2-5');
  });

  it('moves to a place it is sent, again for the same place when the id is new', async () => {
    const loader = fakeLoader(documentPages());
    const { rerender } = render(<View loader={loader} />);
    const section = () => article().querySelector('section[data-page="1"]') as HTMLElement;
    rerender(<View loader={loader} jump={{ id: 1, place: { page: 1, y: 0 } }} />);
    await settled(article());
    await waitFor(() =>
      expect(Math.abs(section().getBoundingClientRect().top - topline())).toBeLessThan(2),
    );
    act(() => {
      article().scrollTop = 0;
    });
    rerender(<View loader={loader} jump={{ id: 1, place: { page: 1, y: 0 } }} />);
    expect(article().scrollTop).toBe(0);
    rerender(<View loader={loader} jump={{ id: 2, place: { page: 1, y: 0 } }} />);
    await waitFor(() =>
      expect(Math.abs(section().getBoundingClientRect().top - topline())).toBeLessThan(2),
    );
  });
});

describe('Find’s mark (PRD-36 "Find")', () => {
  it('wraps the hit’s words in a mark', () => {
    render(
      <View
        loader={fakeLoader(documentPages())}
        mark={{ blockId: 'p1-2', start: 4, length: 5, exact: true }}
      />,
    );
    const mark = screen.getByTestId('text-view-mark');
    expect(mark).toHaveTextContent('quick');
    expect(mark).not.toHaveAttribute('data-soft');
  });

  it('marks the whole block, lightly, when the words were not found in it', () => {
    render(
      <View
        loader={fakeLoader(documentPages())}
        mark={{ blockId: 'p1-2', start: 0, length: 0, exact: false }}
      />,
    );
    const mark = screen.getByTestId('text-view-mark');
    expect(mark).toHaveTextContent('The quick brown fox.');
    expect(mark).toHaveAttribute('data-soft');
  });

  it('marks a list item by its index', () => {
    render(
      <View
        loader={fakeLoader(documentPages())}
        mark={{ blockId: 'p1-4', item: 1, start: 0, length: 4, exact: true }}
      />,
    );
    expect(screen.getByTestId('text-view-mark')).toHaveTextContent('Beta');
  });

  it('brings a mark on a page that is not near into view', async () => {
    render(
      <View
        loader={fakeLoader(documentPages())}
        mark={{ blockId: 'p2-12', start: 0, length: 4, exact: true }}
      />,
    );
    const mark = screen.getByTestId('text-view-mark');
    await waitFor(() => {
      const box = mark.getBoundingClientRect();
      expect(box.top).toBeGreaterThanOrEqual(article().getBoundingClientRect().top);
      expect(box.bottom).toBeLessThanOrEqual(article().getBoundingClientRect().bottom);
    });
  });
});

describe('the bar (PRD-36 §2)', () => {
  it('shows n / N and calls Page view, Go to page and Find', async () => {
    const onPageView = vi.fn();
    const onGoto = vi.fn();
    const onFind = vi.fn();
    render(
      <View
        loader={fakeLoader(documentPages())}
        place={{ page: 1, y: 0 }}
        onPageView={onPageView}
        onGoto={onGoto}
        onFind={onFind}
      />,
    );
    const bar = await settled(screen.getByTestId('text-view-bar'));
    await waitFor(() =>
      expect(within(bar).getByTestId('text-view-position')).toHaveTextContent('2 / 3'),
    );
    await userEvent.click(within(bar).getByRole('button', { name: 'Go to page, 2 / 3' }));
    expect(onGoto).toHaveBeenCalled();
    await userEvent.click(within(bar).getByRole('button', { name: 'Find' }));
    expect(onFind).toHaveBeenCalled();
    await userEvent.click(within(bar).getByRole('button', { name: 'Page view' }));
    expect(onPageView).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
  });
});

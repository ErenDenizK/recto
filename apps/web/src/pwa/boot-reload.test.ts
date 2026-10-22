/**
 * A launch chunk that fails is imported again in the page, then the page reloads once, then a
 * static screen offers Reload: never a loop, never a blank page (`boot-reload.ts`, PRD-26). The
 * end-to-end cases are `e2e/boot-reload.spec.ts`.
 */
import { afterEach, describe, expect, it } from 'vitest';

import {
  BOOT_RELOAD_KEY,
  BOOT_RELOAD_WINDOW_MS,
  type BootWindow,
  bustedUrl,
  editionChunk,
  loadOrReload,
  reloadForFailedBoot,
  retryStyles,
  showBootFailure,
} from './boot-reload';

function fakeWindow(stored?: string, throws = false) {
  const items = new Map<string, string>(stored === undefined ? [] : [[BOOT_RELOAD_KEY, stored]]);
  let reloads = 0;
  const replaced: string[] = [];
  const document = { readyState: 'complete' as DocumentReadyState };
  let onLoad: (() => void) | undefined;
  const win: BootWindow = {
    document,
    addEventListener: (_type, listener) => {
      onLoad = listener;
    },
    sessionStorage: {
      getItem: (key) => {
        if (throws) throw new DOMException('blocked', 'SecurityError');
        return items.get(key) ?? null;
      },
      setItem: (key, value) => {
        items.set(key, value);
      },
    },
    location: {
      href: 'https://example.test/recto/?office=1#page=2',
      reload: () => {
        reloads += 1;
      },
      replace: (url) => {
        replaced.push(String(url));
      },
    },
  };
  const load = () => {
    document.readyState = 'complete';
    onLoad?.();
  };
  return { win, items, document, load, replaced, reloads: () => reloads };
}

const CHUNK = 'assets/app-AbCd1234.js';
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  for (const screen of document.querySelectorAll('[data-testid="boot-failure"]')) screen.remove();
});

describe('reloadForFailedBoot', () => {
  it('reloads the first time and notes when', () => {
    const fake = fakeWindow();
    expect(reloadForFailedBoot(fake.win, 1_000_000)).toBe(true);
    expect(fake.reloads()).toBe(1);
    expect(fake.items.get(BOOT_RELOAD_KEY)).toBe('1000000');
  });

  it('does not reload again within the window', () => {
    const fake = fakeWindow('1000000');
    expect(reloadForFailedBoot(fake.win, 1_000_000 + BOOT_RELOAD_WINDOW_MS - 1)).toBe(false);
    expect(fake.reloads()).toBe(0);
  });

  it('reloads again once the window has passed', () => {
    const fake = fakeWindow('1000000');
    expect(reloadForFailedBoot(fake.win, 1_000_000 + BOOT_RELOAD_WINDOW_MS)).toBe(true);
    expect(fake.reloads()).toBe(1);
  });

  it('waits for the document to load before it reloads', () => {
    const fake = fakeWindow();
    fake.document.readyState = 'interactive';
    expect(reloadForFailedBoot(fake.win, 1_000_000)).toBe(true);
    expect(fake.reloads()).toBe(0);
    fake.load();
    expect(fake.reloads()).toBe(1);
  });

  it('never reloads without session storage, which could loop', () => {
    const fake = fakeWindow(undefined, true);
    expect(reloadForFailedBoot(fake.win)).toBe(false);
    expect(fake.reloads()).toBe(0);
  });
});

describe('loadOrReload', () => {
  it('passes a loaded module through', async () => {
    const fake = fakeWindow();
    await expect(
      loadOrReload(() => Promise.resolve('module'), 'full', 'App', fake.win, undefined, CHUNK),
    ).resolves.toBe('module');
    expect(fake.reloads()).toBe(0);
  });

  it('imports the edition chunk again under a fresh URL before it reloads', async () => {
    const fake = fakeWindow();
    const app = { App: 'the app' };
    const asked: string[] = [];
    const loaded = await loadOrReload(
      () => Promise.reject(new TypeError('failed')),
      'full',
      'App',
      fake.win,
      (url) => {
        asked.push(url);
        return Promise.resolve(app);
      },
      CHUNK,
    );
    expect(loaded).toBe(app);
    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatch(/^https:\/\/example\.test\/assets\/app-AbCd1234\.js\?r=\d+$/);
    expect(fake.reloads()).toBe(0);
  });

  it('reloads when the retried chunk fails or lacks the edition, and never settles', async () => {
    for (const retry of [() => Promise.reject(new TypeError('again')), () => Promise.resolve({})]) {
      const fake = fakeWindow();
      let settled = false;
      void loadOrReload(
        () => Promise.reject(new TypeError('x')),
        'full',
        'App',
        fake.win,
        retry,
        CHUNK,
      ).then(
        () => {
          settled = true;
        },
        () => {
          settled = true;
        },
      );
      await tick();
      await tick();
      expect(fake.reloads()).toBe(1);
      expect(settled).toBe(false);
    }
  });

  it('shows the static screen when it already reloaded', async () => {
    const fake = fakeWindow(String(Date.now()));
    void loadOrReload(
      () => Promise.reject(new TypeError('x')),
      'full',
      'App',
      fake.win,
      undefined,
      undefined,
    );
    await tick();
    expect(fake.reloads()).toBe(0);
    expect(document.querySelector('[data-testid="boot-failure"]')).not.toBeNull();
  });
});

describe('the pieces', () => {
  it('reads the edition chunks the build writes, and nothing before the build', () => {
    const raw = JSON.stringify([CHUNK, 'assets/CompactApp-AbCd1234.js']);
    expect(editionChunk('full', raw)).toBe(CHUNK);
    expect(editionChunk('compact', raw)).toBe('assets/CompactApp-AbCd1234.js');
    expect(editionChunk('compact')).toBeUndefined();
  });

  it('busts a URL, keeping its other parameters and its hash', () => {
    expect(bustedUrl('https://example.test/?office=1#p=2', '_r', 42)).toBe(
      'https://example.test/?office=1&_r=42#p=2',
    );
  });

  it('asks again for a stylesheet that failed to load', async () => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    // A port nothing listens on: the load fails, and the retry fails too.
    link.href = 'http://127.0.0.1:9/missing-stylesheet.css';
    await new Promise((resolve) => {
      link.onerror = resolve;
      document.head.append(link);
    });
    expect(await retryStyles(document, 42)).toBe(false);
    const fresh = document.querySelector<HTMLLinkElement>(
      'link[href*="missing-stylesheet.css?r=42"]',
    );
    expect(fresh).not.toBeNull();
    fresh?.remove();
  });

  it('the screen reloads to a cache-busted document URL', () => {
    const fake = fakeWindow();
    const screen = showBootFailure(document, fake.win);
    expect(screen.getAttribute('role')).toBe('alert');
    screen.querySelector('button')?.click();
    expect(fake.replaced[0]).toMatch(/^https:\/\/example\.test\/recto\/\?office=1&_r=\d+#page=2$/);
  });
});

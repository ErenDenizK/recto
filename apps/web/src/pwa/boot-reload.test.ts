/**
 * A launch chunk that fails reloads the page once, never in a loop (`boot-reload.ts`, PRD-26).
 * The end-to-end case is `e2e/boot-reload.spec.ts`.
 */
import { describe, expect, it } from 'vitest';

import {
  BOOT_RELOAD_KEY,
  BOOT_RELOAD_WINDOW_MS,
  type BootWindow,
  loadOrReload,
  moduleWith,
  reloadForFailedBoot,
  retryUrl,
} from './boot-reload';

function fakeWindow(stored?: string, throws = false) {
  const items = new Map<string, string>(stored === undefined ? [] : [[BOOT_RELOAD_KEY, stored]]);
  let reloads = 0;
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
      reload: () => {
        reloads += 1;
      },
    },
  };
  const load = () => {
    document.readyState = 'complete';
    onLoad?.();
  };
  return { win, items, document, load, reloads: () => reloads };
}

/** A loader whose source reads as the build writes it (`main.tsx` after the build). */
function built<T>(load: () => Promise<T>): () => Promise<T> {
  const source = '()=>o(()=>import(`./app-AbCd1234.js`).then(e=>e.t),__vite__mapDeps([1,2]))';
  return Object.assign(load, { toString: () => source });
}

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
    expect(fake.items.get(BOOT_RELOAD_KEY)).toBe('1000000');
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
    await expect(loadOrReload(() => Promise.resolve('module'), 'App', fake.win)).resolves.toBe(
      'module',
    );
    expect(fake.reloads()).toBe(0);
  });

  it('reloads on a failed load and never settles', async () => {
    const fake = fakeWindow();
    let settled = false;
    void loadOrReload(() => Promise.reject(new TypeError('Failed to fetch')), 'App', fake.win).then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fake.reloads()).toBe(1);
    expect(settled).toBe(false);
  });

  it('throws the failure when it already reloaded', async () => {
    const fake = fakeWindow(String(Date.now()));
    const failure = new TypeError('Failed to fetch');
    await expect(loadOrReload(() => Promise.reject(failure), 'App', fake.win)).rejects.toBe(
      failure,
    );
    expect(fake.reloads()).toBe(0);
  });

  it('imports the chunk again under a fresh URL before it reloads', async () => {
    const fake = fakeWindow();
    const app = { App: 'the app' };
    const asked: string[] = [];
    // What the build writes: the emitted chunk, its module re-exported under a short name.
    const load = built(() => Promise.reject(new TypeError('failed')));
    const loaded = await loadOrReload(load, 'App', fake.win, (url) => {
      asked.push(url);
      return Promise.resolve({ t: app });
    });
    expect(loaded).toBe(app);
    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatch(/\/app-AbCd1234\.js\?r=\d+$/);
    expect(fake.reloads()).toBe(0);
  });

  it('reloads when the fresh URL fails too', async () => {
    const fake = fakeWindow();
    const load = built(() => Promise.reject(new TypeError('failed')));
    void loadOrReload(load, 'App', fake.win, () => Promise.reject(new TypeError('again')));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fake.reloads()).toBe(1);
  });
});

describe('retryUrl and moduleWith', () => {
  it('reads the emitted chunk from the loader and adds a fresh query', () => {
    const load = built(() => Promise.resolve({}));
    expect(retryUrl(load, 42, 'https://example.test/assets/main-x.js')).toBe(
      'https://example.test/assets/app-AbCd1234.js?r=42',
    );
    expect(retryUrl(() => Promise.resolve({}), 42)).toBeUndefined();
  });

  it('finds the module in the chunk or in the namespace it is re-exported under', () => {
    const app = { App: 1 };
    expect(moduleWith(app, 'App')).toBe(app);
    expect(moduleWith({ t: app, n: 2 }, 'App')).toBe(app);
    expect(moduleWith({ t: {} }, 'App')).toBeUndefined();
    expect(moduleWith(undefined, 'App')).toBeUndefined();
  });
});

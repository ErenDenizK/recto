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
  reloadForFailedBoot,
} from './boot-reload';

function fakeWindow(stored?: string, throws = false) {
  const items = new Map<string, string>(stored === undefined ? [] : [[BOOT_RELOAD_KEY, stored]]);
  let reloads = 0;
  const win: BootWindow = {
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
  return { win, items, reloads: () => reloads };
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

  it('never reloads without session storage, which could loop', () => {
    const fake = fakeWindow(undefined, true);
    expect(reloadForFailedBoot(fake.win)).toBe(false);
    expect(fake.reloads()).toBe(0);
  });
});

describe('loadOrReload', () => {
  it('passes a loaded module through', async () => {
    const fake = fakeWindow();
    await expect(loadOrReload(() => Promise.resolve('module'), fake.win)).resolves.toBe('module');
    expect(fake.reloads()).toBe(0);
  });

  it('reloads on a failed load and never settles', async () => {
    const fake = fakeWindow();
    let settled = false;
    void loadOrReload(() => Promise.reject(new TypeError('Failed to fetch')), fake.win).then(
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
    await expect(loadOrReload(() => Promise.reject(failure), fake.win)).rejects.toBe(failure);
    expect(fake.reloads()).toBe(0);
  });
});

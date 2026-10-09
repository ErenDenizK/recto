/**
 * The web target's platform adapter (`#platform` in web builds; editions.md §5.1). The browser
 * code it will hold (file pickers, save handles, OPFS, the service worker) moves here with DT-0;
 * until then the facts below are what a web build promises, pinned by `policy.test.ts`.
 */
import type { Platform } from '../port';

export const platform: Platform = {
  target: 'web',
  connectSources: ["'self'"],
  network: 'none',
};

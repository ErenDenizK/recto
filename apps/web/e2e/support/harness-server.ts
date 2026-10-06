/**
 * Where the rendered-pixel harness runs (components/09-primitives.md §28, spec 09.11;
 * docs/specs/redesign.md D3-1): its own Vite dev server on its own port, started by
 * `playwright.config.ts`'s second `webServer` beside the app's preview. The port is the app's
 * plus one unless `E2E_HARNESS_PORT` says otherwise, so parallel checkouts that set `E2E_PORT`
 * do not collide.
 */
export const HARNESS_PORT = Number(
  process.env.E2E_HARNESS_PORT ?? Number(process.env.E2E_PORT ?? 4173) + 1,
);

export const HARNESS_URL = `http://localhost:${HARNESS_PORT}/`;

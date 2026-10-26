/**
 * "Open with" from the OS (PRD-31). A stubbed `window.launchQueue`, set before the app loads,
 * delivers a launch with one file handle; the file opens as a tab like a drop. Where the browser
 * has no `launchQueue` (the other specs) nothing runs.
 */
import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { fixturePath } from './helpers';

test('a launch from the OS opens its file', async ({ page }) => {
  const name = 'annotations.pdf';
  const bytes = [...readFileSync(fixturePath(name))];
  await page.addInitScript(
    ({ name, bytes }) => {
      const handle = {
        kind: 'file',
        name,
        getFile: () =>
          Promise.resolve(new File([new Uint8Array(bytes)], name, { type: 'application/pdf' })),
      };
      // Chromium defines its own `launchQueue`; replace it, whatever its property kind.
      Object.defineProperty(window, 'launchQueue', {
        configurable: true,
        value: {
          setConsumer: (consumer: (p: { files: unknown[] }) => void) =>
            setTimeout(() => consumer({ files: [handle] }), 0),
        },
      });
    },
    { name, bytes },
  );
  await page.goto('./');
  await expect(page.getByRole('tab', { name: 'annotations' })).toBeVisible();
});

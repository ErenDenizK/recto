// Setup for the desktop project (vitest.config.ts): its files are written for a fine pointer
// that can hover, which Playwright's headless Chromium reports from its launch flags. Touch
// emulation turned off leaves `pointer: none` and `hover: none` in the page for every later
// file of the worker, so a file that emulates touch belongs in the `chromium-touch` project.
// This check fails the file that inherits that state, naming the cause, instead of letting a
// layout that differs only by pointer fail somewhere inside it.
import { beforeAll } from 'vitest';

beforeAll(() => {
  const fine = matchMedia('(pointer: fine)').matches;
  const hover = matchMedia('(hover: hover)').matches;
  if (!fine || !hover) {
    throw new Error(
      `This file starts without a fine pointer (pointer: fine ${fine}, hover: hover ${hover}). ` +
        'An earlier file in this worker emulated touch over CDP; list that file in ' +
        'TOUCH_EMULATING in vitest.config.ts so it runs in the chromium-touch project.',
    );
  }
});

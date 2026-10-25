/**
 * Read aloud (R29 BM-2; PRD-34, behind `?read=1`) on the desktop and the tablet: ⇧⌥L opens a
 * player that speaks the page in view through `speechSynthesis` and rings the word each
 * `boundary` event names; Pause holds the word, Next moves to the next sentence, Speed changes the
 * utterance's rate, and the voice list holds on-device voices only. `speechSynthesis` is a fake
 * that emits the boundary events itself, so the spec needs no audio and no installed voice.
 */
import { expect, type Page, test } from '@playwright/test';

const FAKE_SPEECH = `
(() => {
  const spoken = [];
  const voices = [
    { name: 'Net', lang: 'en-US', localService: false, default: false, voiceURI: 'Net' },
    { name: 'Ada', lang: 'en-US', localService: true, default: true, voiceURI: 'Ada' },
    { name: 'Bo', lang: 'en-GB', localService: true, default: false, voiceURI: 'Bo' },
  ];
  class Utterance {
    constructor(text) { this.text = text; this.rate = 1; this.voice = null; this.lang = ''; }
  }
  let timer = 0;
  let paused = false;
  const fake = {
    speaking: false,
    getVoices: () => voices,
    addEventListener() {},
    removeEventListener() {},
    cancel() { clearInterval(timer); fake.speaking = false; },
    pause() { paused = true; },
    resume() { paused = false; },
    speak(u) {
      spoken.push({ text: u.text, rate: u.rate, voice: u.voice && u.voice.name });
      const starts = [...u.text.matchAll(/\\S+/g)].map((m) => m.index);
      let step = -1;
      fake.speaking = true;
      clearInterval(timer);
      timer = setInterval(() => {
        window.__ticks += 1;
        if (paused) return;
        step += 1;
        if (step === 0) u.onstart && u.onstart({});
        if (step < starts.length) {
          u.onboundary && u.onboundary({ name: 'word', charIndex: starts[step] });
        } else {
          clearInterval(timer);
          u.onend && u.onend({});
        }
      }, 250);
    },
  };
  Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
  window.SpeechSynthesisUtterance = Utterance;
  window.__spoken = spoken;
  window.__ticks = 0;
})();
`;

async function openReader(page: Page) {
  await page.addInitScript(FAKE_SPEECH);
  await page.goto('./?sample&read=1');
  await expect(page.locator('main canvas[data-state="rendered"]').first()).toBeVisible({
    timeout: 20_000,
  });
}

const boxOf = (page: Page) =>
  page
    .getByTestId('read-aloud-word')
    .locator('[data-word]')
    .first()
    .evaluate((el) => `${(el as HTMLElement).style.left},${(el as HTMLElement).style.top}`);

test('reads the page and rings the word being spoken', async ({ page, hasTouch }) => {
  await openReader(page);
  await page.keyboard.press('Shift+Alt+L');
  const player = page.getByTestId('read-aloud-player');
  await expect(player).toBeVisible();

  // Q-9: one piece high (40, 48 on touch), no wider than the capsule; focus stays put.
  const size = await player.boundingBox();
  expect(size?.height).toBe(hasTouch ? 48 : 40);
  const capsule = await page.locator('[data-region="toolbar"]').boundingBox();
  expect(size!.width).toBeLessThanOrEqual(capsule!.width);
  // Opened by a key: no ring or tooltip nobody asked for.
  await expect(page.getByTestId('read-aloud-play')).not.toBeFocused();
  await expect(page.getByRole('tooltip')).toHaveCount(0);

  // The ring appears, then moves on to another word as boundary events arrive.
  await expect(page.getByTestId('read-aloud-word')).toBeVisible();
  // The word never sits under the player.
  await expect
    .poll(async () => {
      const word = await page.locator('[data-word]').boundingBox();
      const top = (await player.boundingBox())!.y;
      return word !== null && word.y + word.height <= top;
    })
    .toBe(true);
  const first = await boxOf(page);
  await expect.poll(() => boxOf(page)).not.toBe(first);

  // Pause holds the word; Play lets it go on.
  await page.getByTestId('read-aloud-play').click();
  await expect(page.getByTestId('read-aloud-play')).toHaveAccessibleName('Play');
  const held = await boxOf(page);
  // The fake's clock keeps ticking while paused; two ticks later the word has not moved.
  const ticks = await page.evaluate(() => (window as never as { __ticks: number }).__ticks);
  await expect
    .poll(() => page.evaluate(() => (window as never as { __ticks: number }).__ticks))
    .toBeGreaterThan(ticks + 1);
  expect(await boxOf(page)).toBe(held);
  await page.getByTestId('read-aloud-play').click();
  await expect(page.getByTestId('read-aloud-play')).toHaveAccessibleName('Pause');
  await expect.poll(() => boxOf(page)).not.toBe(held);

  // Next sentence speaks a different sentence.
  const count = await page.evaluate(
    () => (window as never as { __spoken: unknown[] }).__spoken.length,
  );
  await page.getByTestId('read-aloud-next').click();
  await expect
    .poll(() => page.evaluate(() => (window as never as { __spoken: unknown[] }).__spoken.length))
    .toBeGreaterThan(count);
  const texts = await page.evaluate(() =>
    (window as never as { __spoken: { text: string }[] }).__spoken.map((s) => s.text),
  );
  expect(texts[texts.length - 1]).not.toBe(texts[0]);
});

test('speed and voice reach the utterance, and network voices are not listed', async ({ page }) => {
  await openReader(page);
  await page.keyboard.press('Shift+Alt+L');
  await expect(page.getByTestId('read-aloud-player')).toBeVisible();

  await page.getByTestId('read-aloud-speed').click();
  await page.getByRole('option', { name: '1.5×' }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const spoken = (window as never as { __spoken: { rate: number }[] }).__spoken;
        return spoken[spoken.length - 1]?.rate;
      }),
    )
    .toBe(1.5);

  await page.getByTestId('read-aloud-voice').click();
  await expect(page.getByRole('option', { name: 'Bo' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Ada' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Net' })).toHaveCount(0);
  await page.getByRole('option', { name: 'Bo' }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const spoken = (window as never as { __spoken: { voice: string }[] }).__spoken;
        return spoken[spoken.length - 1]?.voice;
      }),
    )
    .toBe('Bo');

  await page.getByTestId('read-aloud-close').click();
  await expect(page.getByTestId('read-aloud-player')).toHaveCount(0);
  await expect(page.getByTestId('read-aloud-word')).toHaveCount(0);
});

test('the command is not there without the flag', async ({ page }) => {
  await page.addInitScript(FAKE_SPEECH);
  await page.goto('./?sample');
  await expect(page.locator('main canvas[data-state="rendered"]').first()).toBeVisible({
    timeout: 20_000,
  });
  await page.keyboard.press('Shift+Alt+L');
  await expect(page.getByTestId('read-aloud-player')).toHaveCount(0);
});

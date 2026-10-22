import { describe, expect, test } from 'vitest';

import { isWebKitUserAgent } from './webkit';

describe('isWebKitUserAgent (PF-22)', () => {
  test('Safari on macOS and the iPad, and every iOS browser, are WebKit', () => {
    expect(
      isWebKitUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      ),
    ).toBe(true);
    expect(
      isWebKitUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe(true);
  });

  test('Chromium and Firefox are not', () => {
    expect(
      isWebKitUserAgent(
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      ),
    ).toBe(false);
    expect(
      isWebKitUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0'),
    ).toBe(false);
  });
});

/** The glass scroll bar's flag (`scroll-glass-flag.ts`): the address, the stored choice, off. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { parseScrollStyle, resetScrollGlassStyle, scrollGlassStyle } from './scroll-glass-flag';

const at = (query: string) => {
  history.replaceState(null, '', `/${query}`);
  resetScrollGlassStyle();
};

beforeEach(() => localStorage.clear());
afterEach(() => at(''));

describe('scrollGlassStyle', () => {
  it('is off by default', () => {
    at('');
    expect(scrollGlassStyle()).toBeNull();
  });

  it('reads both options and takes glass for A', () => {
    at('?scroll=glass-b');
    expect(scrollGlassStyle()).toBe('glass-b');
    at('?scroll=glass-a');
    expect(scrollGlassStyle()).toBe('glass-a');
    at('?scroll=glass');
    expect(scrollGlassStyle()).toBe('glass-a');
  });

  it('keeps the choice until ?scroll=0 clears it', () => {
    at('?scroll=glass-b');
    scrollGlassStyle();
    at('');
    expect(scrollGlassStyle()).toBe('glass-b');
    at('?scroll=0');
    expect(scrollGlassStyle()).toBeNull();
    at('');
    expect(scrollGlassStyle()).toBeNull();
  });

  it('ignores a value it does not know', () => {
    expect(parseScrollStyle('glass-c')).toBeNull();
    expect(parseScrollStyle(null)).toBeNull();
  });
});

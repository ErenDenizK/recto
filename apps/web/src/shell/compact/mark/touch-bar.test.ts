/** DSN-77: the phone's Delete pill keeps off form fields. */
import { describe, expect, it } from 'vitest';

import { clearOfFields } from './TouchBar';

const field = { left: 40, top: 100, width: 200, height: 24 };

describe('clearOfFields', () => {
  it('keeps the first side when no field is under it', () => {
    expect(clearOfFields([300, 500], 140, [field])).toBe(300);
    expect(clearOfFields([300, 500], 140, [])).toBe(300);
  });

  it('flips to the other side when a field is under the first', () => {
    // The pill at y 80..136 covers the field at y 100..124; below it is clear.
    expect(clearOfFields([80, 300], 140, [field])).toBe(300);
  });

  it('takes the side that covers the least when both cover a field', () => {
    const wide = { left: 0, top: 290, width: 400, height: 40 };
    expect(clearOfFields([80, 300], 140, [field, wide])).toBe(80);
  });
});

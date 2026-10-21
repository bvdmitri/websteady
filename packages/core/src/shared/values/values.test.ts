import { describe, expect, it } from 'vitest';

import { byteAt, pixelAt, valueAt } from './values';

describe('valueAt', () => {
  it('reads a value, and 0 outside the values', () => {
    const values = new Float32Array([0.5, 2]);
    expect(valueAt(values, 1)).toBe(2);
    expect(valueAt(values, 2)).toBe(0);
    expect(valueAt([7], -1)).toBe(0);
  });
});

describe('pixelAt', () => {
  it('reads a pixel, and 0 outside the image', () => {
    const data = new Float32Array([0.25, 0.5]);
    expect(pixelAt(data, 0)).toBe(0.25);
    expect(pixelAt(data, 9)).toBe(0);
  });
});

describe('byteAt', () => {
  it('reads a byte, and 0 outside the data', () => {
    const data = new Uint8ClampedArray([200]);
    expect(byteAt(data, 0)).toBe(200);
    expect(byteAt(data, 1)).toBe(0);
  });
});

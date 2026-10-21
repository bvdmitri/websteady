import { describe, expect, it } from 'vitest';

import { grayFromRgba, sample } from './gray';

describe('grayFromRgba', () => {
  it('weighs red, green and blue by their luma and ignores alpha', () => {
    const rgba = new Uint8ClampedArray([
      255, 0, 0, 0, 0, 255, 0, 9, 0, 0, 255, 255, 255, 255, 255, 1,
    ]);
    const gray = grayFromRgba(rgba, { width: 2, height: 2 });
    expect([...gray.data].map((v) => Number(v.toFixed(3)))).toEqual([0.299, 0.587, 0.114, 1]);
  });

  it('refuses bytes that do not match the size', () => {
    expect(() => grayFromRgba(new Uint8ClampedArray(4), { width: 2, height: 1 })).toThrow(
      'expected 8 bytes of RGBA for 2x1, got 4',
    );
  });
});

describe('sample', () => {
  const image = { width: 2, height: 2, data: new Float32Array([0, 1, 2, 3]) };

  it('reads pixels exactly and interpolates between them', () => {
    expect(sample(image, 1, 1)).toBe(3);
    expect(sample(image, 0.5, 0)).toBe(0.5);
    expect(sample(image, 0.5, 0.5)).toBe(1.5);
  });

  it('repeats the edge outside the image', () => {
    expect(sample(image, -3, 0)).toBe(0);
    expect(sample(image, 5, 5)).toBe(3);
  });
});

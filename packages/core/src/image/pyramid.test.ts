import { describe, expect, it } from 'vitest';

import { flat, textured } from '../testing/images';
import { blur, halve, pyramid } from './pyramid';

describe('blur', () => {
  it('keeps a flat image flat and its size', () => {
    const out = blur(flat(9, 5, 0.25));
    expect(out).toMatchObject({ width: 9, height: 5 });
    for (const value of out.data) expect(value).toBeCloseTo(0.25, 6);
  });

  it('spreads a point by the binomial kernel', () => {
    const point = flat(5, 5, 0);
    point.data[12] = 1;
    const out = blur(point);
    expect(out.data[12]).toBeCloseTo((6 / 16) ** 2, 6);
    expect(out.data[10]).toBeCloseTo((1 / 16) * (6 / 16), 6);
  });
});

describe('halve and pyramid', () => {
  it('halves each side, rounding up', () => {
    expect(halve(flat(9, 5))).toMatchObject({ width: 5, height: 3 });
  });

  it('builds levels down to a smallest side, the first being the image itself', () => {
    const image = textured(160, 90);
    const levels = pyramid(image, { levels: 4, smallest: 16 });
    expect(levels.map((l) => [l.width, l.height])).toEqual([
      [160, 90],
      [80, 45],
      [40, 23],
    ]);
    expect(levels[0]).toBe(image);
  });
});

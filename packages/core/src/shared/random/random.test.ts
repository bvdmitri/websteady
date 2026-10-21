import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { seededRandom } from './random';

const take = (seed: number): number[] => {
  const next = seededRandom(seed);
  return [next(), next(), next()];
};

describe('seededRandom', () => {
  it('gives the same numbers for the same seed, and others for another', () => {
    expect(take(7)).toEqual(take(7));
    expect(take(7)).not.toEqual(take(8));
  });

  it('stays in 0..1 and picks indices below a count', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 1, max: 1000 }), (seed, count) => {
        const next = seededRandom(seed);
        for (let draw = 0; draw < 50; draw += 1) {
          const value = next();
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThan(1);
          expect(Math.floor(value * count)).toBeLessThan(count);
        }
      }),
    );
  });
});

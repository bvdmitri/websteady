import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { seededRandom } from '../shared/random/random';
import { arbitrarySimilarity } from '../testing/arbitraries';
import { fitSimilarity, ransacSimilarity, type PointPair } from './fit';
import { apply, parts, similarity, type Similarity } from './similarity';

function pairs(s: Similarity, count: number, seed: number): PointPair[] {
  const next = seededRandom(seed);
  return Array.from({ length: count }, () => {
    const from = { x: next() * 400, y: next() * 300 };
    return { from, to: apply(s, from) };
  });
}

const expectClose = (got: Similarity | undefined, want: Similarity, digits: number): void => {
  expect(got).toBeDefined();
  for (const key of ['a', 'b', 'tx', 'ty'] as const)
    expect(got?.[key]).toBeCloseTo(want[key], digits);
};

describe('fitSimilarity', () => {
  it('recovers the transform exactly from noiseless pairs', () => {
    fc.assert(
      fc.property(arbitrarySimilarity, fc.integer(), (s, seed) => {
        expectClose(fitSimilarity(pairs(s, 12, seed)), s, 6);
      }),
    );
  });

  it('has no answer from fewer than two distinct points', () => {
    expect(fitSimilarity([])).toBeUndefined();
    const p = { x: 1, y: 2 };
    expect(fitSimilarity([{ from: p, to: p }])).toBeUndefined();
    expect(
      fitSimilarity([
        { from: p, to: p },
        { from: p, to: { x: 5, y: 5 } },
      ]),
    ).toBeUndefined();
  });

  it('averages noise out', () => {
    const s = similarity({ angle: 0.1, scale: 1.02, tx: 5, ty: -3 });
    const next = seededRandom(3);
    const noisy = pairs(s, 400, 1).map(({ from, to }) => ({
      from,
      to: { x: to.x + next() - 0.5, y: to.y + next() - 0.5 },
    }));
    const fitted = parts(fitSimilarity(noisy)!);
    expect(fitted.angle).toBeCloseTo(0.1, 3);
    expect(fitted.tx).toBeCloseTo(5, 0);
  });
});

describe('ransacSimilarity', () => {
  it('finds the transform most points agree on despite 30% outliers, for any seed', () => {
    fc.assert(
      fc.property(arbitrarySimilarity, fc.integer(), (s, seed) => {
        const next = seededRandom(seed);
        const good = pairs(s, 70, seed);
        const bad = pairs(s, 30, seed + 1).map(({ from }) => ({
          from,
          to: { x: next() * 400, y: next() * 300 },
        }));
        const found = ransacSimilarity([...good, ...bad], {
          threshold: 1,
          random: seededRandom(seed),
        });
        // An outlier landing within the threshold may join the refit: the turn and scale stay within
        // a thousandth, the move within a twentieth of a pixel.
        const [got, want] = [parts(found!.transform), parts(s)];
        expect(got.angle).toBeCloseTo(want.angle, 3);
        expect(got.scale).toBeCloseTo(want.scale, 3);
        expect(Math.hypot(got.tx - want.tx, got.ty - want.ty)).toBeLessThan(0.05);
        expect(found?.inliers).toBeGreaterThanOrEqual(70);
      }),
      { numRuns: 500 },
    );
  });

  it('has no answer when there are too few pairs', () => {
    const p = { x: 0, y: 0 };
    expect(
      ransacSimilarity([{ from: p, to: p }], { threshold: 1, random: seededRandom(1) }),
    ).toBeUndefined();
  });
});

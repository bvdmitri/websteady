import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  apply,
  IDENTITY,
  invert,
  parts,
  similarity,
  type Similarity,
} from '../geometry/similarity';
import { arbitrarySimilarity } from '../testing/arbitraries';
import { cameraPath, fillUnreliable, fitCrop, smoothSeries } from './path';

const move = (tx: number, ty = 0, angle = 0): Similarity => similarity({ angle, scale: 1, tx, ty });

// The series' summed squared second differences: how much it shakes.
const shake = (series: readonly number[]): number => {
  let sum = 0;
  for (let k = 2; k < series.length; k += 1) {
    sum += ((series[k] ?? 0) - 2 * (series[k - 1] ?? 0) + (series[k - 2] ?? 0)) ** 2;
  }
  return sum;
};

// The running sum of the steps: a random walk.
const walkOf = (steps: readonly number[]): number[] => {
  const walk: number[] = [];
  for (const step of steps) walk.push((walk.at(-1) ?? 0) + step);
  return walk;
};

const shakeSteps = fc.array(fc.double({ min: -1, max: 1, noNaN: true }), {
  minLength: 60,
  maxLength: 120,
});

describe('fillUnreliable', () => {
  it('replaces an unreliable motion by the reliable ones around it, blended by distance', () => {
    const filled = fillUnreliable([
      { motion: move(0.01), reliable: true },
      { motion: move(9), reliable: false },
      { motion: move(9), reliable: false },
      { motion: move(0.04), reliable: true },
    ]);
    expect(filled.map((m) => Number(m.tx.toFixed(6)))).toEqual([0.01, 0.02, 0.03, 0.04]);
  });

  it('holds the nearest reliable motion at the ends, and stands still with none', () => {
    const ends = fillUnreliable([
      { motion: move(5), reliable: false },
      { motion: move(0.02), reliable: true },
      { motion: move(5), reliable: false },
    ]);
    expect(ends.map((m) => m.tx)).toEqual([0.02, 0.02, 0.02]);
    expect(fillUnreliable([{ motion: move(5), reliable: false }])).toEqual([IDENTITY]);
  });
});

describe('cameraPath', () => {
  it('accumulates each frame motion onto the path so far', () => {
    const path = cameraPath([move(0.1), move(0.2), move(0, 0, 0.1)]);
    expect(path[0]).toEqual(IDENTITY);
    expect(path[1]?.tx).toBeCloseTo(0.2, 12);
    expect(parts(path[2]!).angle).toBeCloseTo(0.1, 12);
  });
});

describe('smoothSeries', () => {
  it('leaves a straight line alone, ends included', () => {
    const line = [...Array.from({ length: 40 }).keys()].map((k) => 3 + 0.5 * k);
    const smooth = smoothSeries(line, 6);
    for (const [k, value] of line.entries()) expect(smooth[k]).toBeCloseTo(value, 9);
  });

  it('takes out the shake of a random walk', () => {
    fc.assert(
      fc.property(shakeSteps, (steps) => {
        const walk = walkOf(steps);
        expect(shake(smoothSeries(walk, 5))).toBeLessThanOrEqual(shake(walk) * 0.2 + 1e-9);
      }),
    );
  });

  it('keeps a series too short to smooth', () => {
    expect(smoothSeries([4], 3)).toEqual([4]);
    expect(smoothSeries([], 3)).toEqual([]);
  });
});

describe('fitCrop', () => {
  const aspect = 9 / 16;
  const corners = (crop: number): { x: number; y: number }[] => {
    const [hw, hh] = [(1 - crop) / 2, ((1 - crop) * aspect) / 2];
    return [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh },
    ];
  };
  const isCovered = (correction: Similarity, crop: number): boolean =>
    corners(crop).every((c) => {
      const source = apply(invert(correction), c);
      return Math.abs(source.x) <= 0.5 + 1e-9 && Math.abs(source.y) <= aspect / 2 + 1e-9;
    });
  it('keeps a correction the crop window already fits in', () => {
    const small = move(0.01, 0.005, 0.005);
    expect(fitCrop(small, { aspect: aspect, crop: 0.1 })).toEqual(small);
  });

  it('always leaves the crop window inside the frame', () => {
    fc.assert(
      fc.property(
        arbitrarySimilarity,
        fc.double({ min: 0, max: 0.3, noNaN: true }),
        (raw, crop) => {
          const correction = similarity({ ...parts(raw), tx: raw.tx / 200, ty: raw.ty / 200 });
          expect(isCovered(fitCrop(correction, { aspect: aspect, crop }), crop)).toBe(true);
        },
      ),
    );
  });
});

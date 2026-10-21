import { describe, expect, it } from 'vitest';

import { similarity } from '../geometry/similarity';
import { textured } from '../testing/images';
import { corners } from './corners';
import { pyramid } from './pyramid';
import { trackPoints } from './track';

const LEVELS = { levels: 3, smallest: 16 };
const OPTIONS = { radius: 7, iterations: 20, epsilon: 0.001, maxBackError: 0.5 };
const W = 160;
const H = 120;

describe('trackPoints', () => {
  it('follows a move of several pixels to within a tenth of a pixel', () => {
    const shift = similarity({ angle: 0, scale: 1, tx: 6.3, ty: -4.2 });
    const before = pyramid(textured(W, H), LEVELS);
    const after = pyramid(textured(W, H, shift), LEVELS);
    const points = corners(before[0]!, { cell: 16, quality: 0.05, minimum: 1e-5 }).filter(
      (p) => p.x > 20 && p.x < W - 20 && p.y > 20 && p.y < H - 20,
    );
    const pairs = trackPoints({ before, after }, points, OPTIONS);
    expect(pairs.length).toBeGreaterThan(points.length * 0.8);
    for (const { from, to } of pairs) {
      expect(to.x - from.x).toBeCloseTo(6.3, 1);
      expect(to.y - from.y).toBeCloseTo(-4.2, 1);
    }
  });

  it('follows a small turn and push', () => {
    const turn = similarity({ angle: 0.02, scale: 1.01, tx: 2, ty: 1 });
    const before = pyramid(textured(W, H), LEVELS);
    const after = pyramid(textured(W, H, turn), LEVELS);
    const pairs = trackPoints(
      { before, after },
      [
        { x: 80, y: 60 },
        { x: 40, y: 40 },
      ],
      OPTIONS,
    );
    expect(pairs).toHaveLength(2);
    for (const { from, to } of pairs) {
      const want = {
        x: turn.a * from.x - turn.b * from.y + 2,
        y: turn.b * from.x + turn.a * from.y + 1,
      };
      expect(Math.hypot(to.x - want.x, to.y - want.y)).toBeLessThan(0.15);
    }
  });

  it('drops a point that cannot be followed: flat surroundings or a lost match', () => {
    const before = pyramid(textured(W, H), LEVELS);
    const blank = textured(W, H);
    blank.data.fill(0.5);
    const after = pyramid(blank, LEVELS);
    expect(trackPoints({ before, after }, [{ x: 80, y: 60 }], OPTIONS)).toEqual([]);
    expect(trackPoints({ before: after, after: before }, [{ x: 80, y: 60 }], OPTIONS)).toEqual([]);
  });
});

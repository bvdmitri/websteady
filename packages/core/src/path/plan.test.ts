import { describe, expect, it } from 'vitest';

import { IDENTITY } from '../geometry/similarity';
import { microseconds, seconds } from '../shared/units/units';
import { planStabilization, unwrap, type MotionTrack } from './plan';

const FRAME = 33_333;
const still = (count: number): MotionTrack => ({
  aspect: 9 / 16,
  frames: [...Array.from({ length: count }).keys()].map((k) => ({
    timestamp: microseconds(k * FRAME),
    motion: IDENTITY,
    reliable: true,
  })),
});

describe('unwrap', () => {
  it('undoes jumps of a whole turn', () => {
    const out = unwrap([3.1, -3.1, -3, 3]);
    expect(out[1]).toBeCloseTo(-3.1 + 2 * Math.PI, 9);
    expect(out[3]).toBeCloseTo(3, 9);
  });
});

describe('planStabilization', () => {
  it('leaves a still camera uncorrected, frame by frame', () => {
    const plan = planStabilization(still(5), { smoothing: seconds(0.5), crop: 0.1 });
    expect(plan).toMatchObject({ aspect: 9 / 16, crop: 0.1 });
    expect(plan.frames.map((f) => f.timestamp)).toEqual([0, 33_333, 66_666, 99_999, 133_332]);
    for (const f of plan.frames) {
      expect(f.correction.a).toBeCloseTo(1, 12);
      expect(f.correction.tx).toBeCloseTo(0, 12);
    }
  });

  it('refuses a crop outside 0 to 0.5 and a smoothing that is not positive', () => {
    expect(() => planStabilization(still(2), { smoothing: seconds(1), crop: 0.5 })).toThrow(
      'crop must be from 0 to below 0.5, got 0.5',
    );
    expect(() => planStabilization(still(2), { smoothing: seconds(0), crop: 0.1 })).toThrow(
      'smoothing must be positive, got 0',
    );
  });
});

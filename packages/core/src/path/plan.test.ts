import { describe, expect, it } from 'vitest';

import { analyzePair, ANALYSIS, prepare } from '../motion/analyze';
import { IDENTITY, similarity, type Similarity } from '../geometry/similarity';
import { itf } from '../render/fidelity';
import { frameTransform } from '../render/transform';
import { warpReference } from '../render/warp';
import { seededRandom } from '../shared/random/random';
import { microseconds, seconds } from '../shared/units/units';
import { textured } from '../testing/images';
import { planStabilization, unwrap, type MotionTrack } from './plan';

const FRAME = 33_333;
// The clip is analysed, planned and rendered on the CPU: seconds under mutation testing.
const E2E_TIMEOUT = 60_000;
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

describe('a shaky clip, end to end', () => {
  const width = 192;
  const height = 108;
  const frameCount = 48;

  // A slow pan with a shake of a few pixels and a few hundredths of a radian on every frame.
  function shakyClip(): ReturnType<typeof textured>[] {
    const next = seededRandom(11);
    return [...Array.from({ length: frameCount }).keys()].map((k) => {
      const shake: Similarity = similarity({
        angle: (next() - 0.5) * 0.04,
        scale: 1,
        tx: 0.8 * k + (next() - 0.5) * 8,
        ty: (next() - 0.5) * 6,
      });
      return textured(width, height, shake);
    });
  }

  it(
    'raises the inter-frame fidelity by several decibels',
    () => {
      const clip = shakyClip();
      const prepared = clip.map((image) => prepare(image));
      const frames = prepared.map((frame, k) => {
        const timestamp = microseconds(k * FRAME);
        if (k === 0) return { timestamp, motion: IDENTITY, reliable: true };
        const { motion, reliable } = analyzePair(prepared[k - 1]!, frame, ANALYSIS);
        return { timestamp, motion, reliable };
      });
      expect(frames.every((f) => f.reliable)).toBe(true);
      const plan = planStabilization(
        { aspect: height / width, frames },
        { smoothing: seconds(0.3), crop: 0.1 },
      );
      const steady = clip.map((image, k) =>
        warpReference(
          image,
          frameTransform(plan.frames[k]!.correction, plan.crop, { width, height }),
        ),
      );
      const zoomed = clip.map((image) =>
        warpReference(image, frameTransform(IDENTITY, 0.1, { width, height })),
      );
      // Measured: 20.6 dB cropped only, 32.0 dB stabilized.
      expect(itf(steady)).toBeGreaterThan(itf(zoomed) + 8);
    },
    E2E_TIMEOUT,
  );
});

import { describe, expect, it } from 'vitest';

import { parts, similarity } from '../geometry/similarity';
import { flat, textured } from '../testing/images';
import { analyzePair, ANALYSIS, prepare, toNormalized } from './analyze';

const W = 192;
const H = 108;

describe('toNormalized', () => {
  it('puts the origin at the centre and measures in frame widths', () => {
    expect(toNormalized({ x: 96, y: 54 }, { width: W, height: H })).toEqual({ x: 0, y: 0 });
    expect(toNormalized({ x: 192, y: 0 }, { width: W, height: H })).toEqual({
      x: 0.5,
      y: -54 / 192,
    });
  });
});

describe('analyzePair', () => {
  it('measures the camera motion between two frames in frame widths, about the centre', () => {
    // A move of 9.6 pixels right and a small turn about the centre of the frame.
    const centre = { x: W / 2, y: H / 2 };
    const turn = similarity({ angle: 0.01, scale: 1, tx: 0, ty: 0 });
    const motion = similarity({
      angle: 0.01,
      scale: 1,
      tx: centre.x - (turn.a * centre.x - turn.b * centre.y) + 9.6,
      ty: centre.y - (turn.b * centre.x + turn.a * centre.y),
    });
    const result = analyzePair(prepare(textured(W, H)), prepare(textured(W, H, motion)), ANALYSIS);
    expect(result.reliable).toBe(true);
    const got = parts(result.motion);
    expect(got.angle).toBeCloseTo(0.01, 3);
    expect(got.scale).toBeCloseTo(1, 3);
    expect(got.tx).toBeCloseTo(9.6 / W, 3);
    expect(got.ty).toBeCloseTo(0, 3);
    expect(result.inliers).toBeGreaterThan(20);
  });

  it('is unreliable on frames with nothing to track', () => {
    const result = analyzePair(prepare(flat(W, H)), prepare(flat(W, H)), ANALYSIS);
    expect(result).toMatchObject({ reliable: false, inliers: 0 });
  });
});

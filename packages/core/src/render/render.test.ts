import { describe, expect, it } from 'vitest';

import { apply, IDENTITY, similarity } from '../geometry/similarity';
import { flat, textured } from '../testing/images';
import { itf, psnr } from './fidelity';
import { frameTransform } from './transform';
import { warpReference } from './warp';

describe('frameTransform', () => {
  it('without a correction only zooms in about the centre by the crop', () => {
    const t = frameTransform(IDENTITY, 0.2, { width: 200, height: 100 });
    expect(apply(t, { x: 100, y: 50 })).toEqual({ x: 100, y: 50 });
    const corner = apply(t, { x: 20, y: 10 });
    expect(corner.x).toBeCloseTo(0, 9);
    expect(corner.y).toBeCloseTo(0, 9);
  });

  it('moves the picture by the correction measured in frame widths', () => {
    const t = frameTransform(similarity({ angle: 0, scale: 1, tx: 0.1, ty: 0 }), 0, {
      width: 200,
      height: 100,
    });
    expect(apply(t, { x: 100, y: 50 })).toEqual({ x: 120, y: 50 });
  });
});

describe('warpReference', () => {
  it('draws the picture moved by the transform', () => {
    const image = textured(40, 30);
    const moved = warpReference(image, similarity({ angle: 0, scale: 1, tx: 3, ty: 0 }));
    expect(moved.data[10 * 40 + 13]).toBeCloseTo(image.data[10 * 40 + 10]!, 6);
  });
});

describe('psnr and itf', () => {
  it('rate identical frames at the cap and differing ones lower', () => {
    expect(psnr(flat(4, 4, 0.5), flat(4, 4, 0.5))).toBe(100);
    expect(psnr(flat(4, 4, 0.5), flat(4, 4, 0.6))).toBeCloseTo(20, 4);
    expect(itf([flat(4, 4, 0.5), flat(4, 4, 0.5), flat(4, 4, 0.6)])).toBeCloseTo(60, 4);
    expect(itf([flat(4, 4)])).toBe(0);
  });
});

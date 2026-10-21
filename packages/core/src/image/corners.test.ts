import { describe, expect, it } from 'vitest';

import { seededRandom } from '../shared/random/random';
import { flat, textured } from '../testing/images';
import { corners } from './corners';

const OPTIONS = { cell: 16, quality: 0.05, minimum: 1e-3 };

describe('corners', () => {
  it('finds at most one corner per grid cell on a textured image, away from the border', () => {
    const found = corners(textured(128, 96), OPTIONS);
    expect(found.length).toBeGreaterThan(20);
    expect(found.length).toBeLessThanOrEqual((128 / 16) * (96 / 16));
    const cells = new Set(found.map((p) => `${Math.floor(p.x / 16)},${Math.floor(p.y / 16)}`));
    expect(cells.size).toBe(found.length);
    for (const p of found) {
      expect(p.x).toBeGreaterThanOrEqual(4);
      expect(p.y).toBeLessThan(96 - 4);
    }
  });

  it('finds none on a flat image, and none in its flat part', () => {
    expect(corners(flat(64, 64), OPTIONS)).toEqual([]);
    const half = textured(64, 64);
    half.data.fill(0.5, 0, 32 * 64);
    for (const p of corners(half, OPTIONS)) expect(p.y).toBeGreaterThan(28);
  });

  it('finds none on a flat image dithered by one grey level, as a browser draws sky', () => {
    const next = seededRandom(5);
    const dithered = flat(96, 64);
    for (const index of dithered.data.keys()) {
      dithered.data[index] = (120 + Math.floor(next() * 2)) / 255;
    }
    expect(corners(dithered, OPTIONS)).toEqual([]);
  });
});

// Synthetic grey images for the core's tests: a smooth texture sampled exactly at any transform,
// so a known motion has an exact answer with no resampling error.
import { apply, invert, type Similarity } from '../geometry/similarity';
import type { GrayImage } from '../image/gray';

// The texture's waves: their lengths along x and y, in pixels (over 2 pi), and the area over
// which the product of x and y turns one radian.
const WAVE_X1 = 7;
const WAVE_Y1 = 11;
const WAVE_X2 = 13;
const WAVE_Y2 = 5;
const WAVE_X3 = 3;
const WAVE_AREA = 900;
// The waves sum to within plus or minus 2.5; scaled by this and centred on mid grey, they stay in
// 0..1.
const SPREAD = 6;
const MID_GREY = 0.5;

/** A smooth texture with detail at several scales, in 0..1, defined everywhere. */
export function texture(x: number, y: number): number {
  const value =
    Math.sin(x / WAVE_X1 + y / WAVE_Y1) +
    Math.cos(x / WAVE_X2 - y / WAVE_Y2) +
    Math.sin((x * y) / WAVE_AREA + x / WAVE_X3) / 2;
  return MID_GREY + value / SPREAD;
}

/** An image of `texture` seen through `motion`: the picture moved by it. */
export function textured(width: number, height: number, motion?: Similarity): GrayImage {
  const back = motion === undefined ? undefined : invert(motion);
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = back === undefined ? { x, y } : apply(back, { x, y });
      data[y * width + x] = texture(p.x, p.y);
    }
  }
  return { width, height, data };
}

/** An image of one grey level. */
export function flat(width: number, height: number, level = MID_GREY): GrayImage {
  return { width, height, data: new Float32Array(width * height).fill(level) };
}

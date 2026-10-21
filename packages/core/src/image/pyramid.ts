import type { GrayImage } from './gray';
import { pixelAt, valueAt } from '../shared/values/values';

// The 5-tap binomial kernel, an approximation of a Gaussian of standard deviation 1: the row of
// Pascal's triangle for this order, divided by its sum.
const ORDER = 4;
const RADIUS = ORDER / 2;

// The next row of Pascal's triangle: each entry the sum of the two above it.
const nextRow = (row: readonly number[]): number[] =>
  [...row, 0].map((value, index) => value + valueAt(row, index - 1));

function binomialRow(order: number): readonly number[] {
  let row: readonly number[] = [1];
  for (let k = 0; k < order; k += 1) row = nextRow(row);
  return row;
}

const KERNEL = binomialRow(ORDER).map((value) => value / 2 ** ORDER);

type Read = (image: GrayImage, x: number, y: number) => number;

const clampedAt: Read = (image, x, y) => {
  const cx = Math.min(Math.max(x, 0), image.width - 1);
  const cy = Math.min(Math.max(y, 0), image.height - 1);
  return pixelAt(image.data, cy * image.width + cx);
};

function pass(image: GrayImage, step: { readonly dx: number; readonly dy: number }): GrayImage {
  const data = new Float32Array(image.width * image.height);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      let sum = 0;
      for (const [k, weight] of KERNEL.entries()) {
        sum += weight * clampedAt(image, x + (k - RADIUS) * step.dx, y + (k - RADIUS) * step.dy);
      }
      data[y * image.width + x] = sum;
    }
  }
  return { width: image.width, height: image.height, data };
}

/** The image blurred by the binomial kernel across and down, edges repeated. */
export function blur(image: GrayImage): GrayImage {
  return pass(pass(image, { dx: 1, dy: 0 }), { dx: 0, dy: 1 });
}

/** The image blurred, then every second pixel kept: half the size, each side rounded up. */
export function halve(image: GrayImage): GrayImage {
  const blurred = blur(image);
  const width = Math.ceil(image.width / 2);
  const height = Math.ceil(image.height / 2);
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) data[y * width + x] = clampedAt(blurred, x * 2, y * 2);
  }
  return { width, height, data };
}

/** How deep a pyramid goes: at most `levels`, none with a side below `smallest` pixels. */
export interface PyramidOptions {
  readonly levels: number;
  readonly smallest: number;
}

/**
 * The image and its successive halvings, finest first: the coarse levels see large motions as
 * small ones, so tracking can start there.
 */
export function pyramid(image: GrayImage, options: PyramidOptions): readonly GrayImage[] {
  const levels = [image];
  let current = image;
  while (levels.length < options.levels) {
    const next = halve(current);
    if (Math.min(next.width, next.height) < options.smallest) break;
    levels.push(next);
    current = next;
  }
  return levels;
}

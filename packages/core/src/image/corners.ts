import type { Point } from '../geometry/similarity';
import type { GrayImage } from './gray';
import { pixelAt } from '../shared/values/values';

/**
 * How corners are picked: one per `cell` pixels square at most, scoring at least `quality` times
 * the image's best score and at least `minimum` (so a flat image has none).
 */
export interface CornerOptions {
  readonly cell: number;
  readonly quality: number;
  readonly minimum: number;
}

// The structure tensor sums over a window of (2 * WINDOW + 1) pixels square.
const WINDOW = 2;
// Corners nearer the border than this cannot be tracked with a full window.
const BORDER = WINDOW + 2;

function gradients(image: GrayImage): { readonly gx: Float32Array; readonly gy: Float32Array } {
  const { width, height, data } = image;
  const gx = new Float32Array(width * height);
  const gy = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const at = y * width + x;
      gx[at] = (pixelAt(data, at + 1) - pixelAt(data, at - 1)) / 2;
      gy[at] = (pixelAt(data, at + width) - pixelAt(data, at - width)) / 2;
    }
  }
  return { gx, gy };
}

// The smaller eigenvalue of the structure tensor summed over the window around (x, y).
function minEigen(image: GrayImage, grads: ReturnType<typeof gradients>, p: Point): number {
  let [xx, yy, xy] = [0, 0, 0];
  for (let dy = -WINDOW; dy <= WINDOW; dy += 1) {
    for (let dx = -WINDOW; dx <= WINDOW; dx += 1) {
      const at = (p.y + dy) * image.width + p.x + dx;
      const [ix, iy] = [pixelAt(grads.gx, at), pixelAt(grads.gy, at)];
      xx += ix * ix;
      yy += iy * iy;
      xy += ix * iy;
    }
  }
  return (xx + yy) / 2 - Math.hypot((xx - yy) / 2, xy);
}

interface Scored extends Point {
  readonly score: number;
}

function bestInCell(
  image: GrayImage,
  grads: ReturnType<typeof gradients>,
  cell: Point & { size: number },
): Scored {
  let best: Scored = { x: 0, y: 0, score: 0 };
  const [right, bottom] = [image.width - BORDER, image.height - BORDER];
  for (let y = Math.max(cell.y, BORDER); y < Math.min(cell.y + cell.size, bottom); y += 1) {
    for (let x = Math.max(cell.x, BORDER); x < Math.min(cell.x + cell.size, right); x += 1) {
      const score = minEigen(image, grads, { x, y });
      if (score > best.score) best = { x, y, score };
    }
  }
  return best;
}

/**
 * Points worth tracking: Shi-Tomasi corners, the pixels whose neighbourhood changes in every
 * direction (a large smaller eigenvalue of the structure tensor), at most one per grid cell so
 * they spread over the frame.
 */
export function corners(image: GrayImage, options: CornerOptions): Point[] {
  const grads = gradients(image);
  const candidates: Scored[] = [];
  for (let y = 0; y < image.height; y += options.cell) {
    for (let x = 0; x < image.width; x += options.cell) {
      candidates.push(bestInCell(image, grads, { x, y, size: options.cell }));
    }
  }
  const strongest = Math.max(0, ...candidates.map((c) => c.score));
  const floor = Math.max(options.minimum, options.quality * strongest);
  return candidates.filter((c) => c.score >= floor).map(({ x, y }) => ({ x, y }));
}

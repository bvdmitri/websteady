/** A frame's size in whole pixels. */
import { byteAt, pixelAt } from '../shared/values/values';
export interface Size {
  readonly width: number;
  readonly height: number;
}

/** A grey image: brightness in 0..1, row by row. */
export interface GrayImage extends Size {
  readonly data: Float32Array;
}

const RGBA = 4;
const BYTE_MAX = 255;
// Rec. 601 luma weights, as video brightness is defined.
const RED = 0.299;
const GREEN = 0.587;
const BLUE = 0.114;

/** RGBA bytes of `size` as a grey image of their luma. */
export function grayFromRgba(rgba: Uint8ClampedArray, size: Size): GrayImage {
  const { width, height } = size;
  if (rgba.length !== width * height * RGBA) {
    throw new RangeError(
      `expected ${width * height * RGBA} bytes of RGBA for ${width}x${height}, got ${rgba.length}`,
    );
  }
  const data = new Float32Array(width * height);
  for (let index = 0; index < data.length; index += 1) {
    const at = index * RGBA;
    const luma =
      RED * byteAt(rgba, at) + GREEN * byteAt(rgba, at + 1) + BLUE * byteAt(rgba, at + 2);
    data[index] = luma / BYTE_MAX;
  }
  return { width, height, data };
}

const pixel = (image: GrayImage, x: number, y: number): number => {
  const cx = Math.min(Math.max(x, 0), image.width - 1);
  const cy = Math.min(Math.max(y, 0), image.height - 1);
  return pixelAt(image.data, cy * image.width + cx);
};

/**
 * The image's brightness at `(x, y)`, between pixels by bilinear interpolation, outside the image
 * the nearest edge pixel's.
 */
export function sample(image: GrayImage, x: number, y: number): number {
  const [x0, y0] = [Math.floor(x), Math.floor(y)];
  const [fx, fy] = [x - x0, y - y0];
  const top = pixel(image, x0, y0) * (1 - fx) + pixel(image, x0 + 1, y0) * fx;
  const bottom = pixel(image, x0, y0 + 1) * (1 - fx) + pixel(image, x0 + 1, y0 + 1) * fx;
  return top * (1 - fy) + bottom * fy;
}

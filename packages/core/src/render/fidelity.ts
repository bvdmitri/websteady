import type { GrayImage } from '../image/gray';
import { pixelAt } from '../shared/values/values';

const DECIBELS = 10;
// Identical frames have no error; their PSNR is capped here rather than infinite.
const CAP = 100;

/** Peak signal-to-noise ratio between two grey images of one size, in decibels (peak 1). */
export function psnr(a: GrayImage, b: GrayImage): number {
  let sum = 0;
  for (const [index, value] of a.data.entries()) sum += (value - pixelAt(b.data, index)) ** 2;
  const mse = sum / a.data.length;
  return mse === 0 ? CAP : DECIBELS * Math.log10(1 / mse);
}

/**
 * Inter-frame transformation fidelity: the mean PSNR between consecutive frames. A steadier video
 * changes less from frame to frame, so its ITF is higher; the standard measure of stabilization.
 */
export function itf(frames: readonly GrayImage[]): number {
  let previous: GrayImage | undefined;
  let [sum, pairs] = [0, 0];
  for (const frame of frames) {
    if (previous !== undefined) {
      sum += psnr(previous, frame);
      pairs += 1;
    }
    previous = frame;
  }
  return sum / Math.max(pairs, 1);
}

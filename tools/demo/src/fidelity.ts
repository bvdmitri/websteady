// A running inter-frame fidelity: the mean PSNR between consecutive grey thumbnails, keeping only
// the last one.
import { itf, type GrayImage } from '@bvdmitri/websteady';

/** A running {@link RunningItf}, starting empty. */
/** Adds frames one by one; `value` is the mean PSNR between neighbours so far. */
export interface RunningItf {
  add(image: GrayImage): void;
  value(): number;
}

export function runningItf(): RunningItf {
  let previous: GrayImage | undefined;
  let sum = 0;
  let pairs = 0;
  return {
    add: (image): void => {
      if (previous !== undefined) {
        sum += itf([previous, image]);
        pairs += 1;
      }
      previous = image;
    },
    value: (): number => (pairs === 0 ? 0 : sum / pairs),
  };
}

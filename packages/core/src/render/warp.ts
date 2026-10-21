import { apply, invert, type Similarity } from '../geometry/similarity';
import { sample, type GrayImage } from '../image/gray';

/**
 * The image drawn through `transform` (source pixels to output pixels) at its own size, each
 * output pixel sampled bilinearly from where it comes from.
 *
 * @remarks The reference for what the canvas renderer draws, and how the tests render on the CPU.
 */
export function warpReference(image: GrayImage, transform: Similarity): GrayImage {
  const back = invert(transform);
  const data = new Float32Array(image.width * image.height);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const source = apply(back, { x, y });
      data[y * image.width + x] = sample(image, source.x, source.y);
    }
  }
  return { width: image.width, height: image.height, data };
}

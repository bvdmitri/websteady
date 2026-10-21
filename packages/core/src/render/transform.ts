import { compose, invert, similarity, type Similarity } from '../geometry/similarity';
import type { Size } from '../image/gray';

/**
 * The transform from a frame's pixels to the stabilized frame's pixels, at the frame's own size:
 * into normalized coordinates, through the correction, zoomed so the crop window fills the frame,
 * and back to pixels.
 */
export function frameTransform(correction: Similarity, crop: number, size: Size): Similarity {
  const normalize = similarity({
    angle: 0,
    scale: 1 / size.width,
    tx: -1 / 2,
    ty: -size.height / (2 * size.width),
  });
  const zoom = similarity({ angle: 0, scale: 1 / (1 - crop), tx: 0, ty: 0 });
  return compose(invert(normalize), compose(zoom, compose(correction, normalize)));
}

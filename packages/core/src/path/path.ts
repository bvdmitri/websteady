import {
  apply,
  compose,
  IDENTITY,
  invert,
  parts,
  similarity,
  type Similarity,
  type SimilarityParts,
} from '../geometry/similarity';
import { valueAt } from '../shared/values/values';

/** A frame's measured motion from the frame before it, and whether to trust it. */
export interface FrameMotion {
  readonly motion: Similarity;
  readonly reliable: boolean;
}

function blend(a: SimilarityParts, b: SimilarityParts, weight: number): SimilarityParts {
  const mix = (key: keyof SimilarityParts): number => a[key] + (b[key] - a[key]) * weight;
  return { angle: mix('angle'), scale: mix('scale'), tx: mix('tx'), ty: mix('ty') };
}

function nearestReliable(
  frames: readonly FrameMotion[],
  from: number,
  step: number,
): number | undefined {
  for (let index = from; index >= 0 && index < frames.length; index += step) {
    if (frames[index]?.reliable === true) return index;
  }
  return undefined;
}

const motionAt = (frames: readonly FrameMotion[], at: number): SimilarityParts =>
  parts(frames[at]?.motion ?? IDENTITY);

// Past the last reliable motion on one side: the nearest one held, or standing still with none.
const heldAt = (frames: readonly FrameMotion[], nearest: number | undefined): Similarity =>
  nearest === undefined ? IDENTITY : similarity(motionAt(frames, nearest));

function filledAt(frames: readonly FrameMotion[], index: number): Similarity {
  const before = nearestReliable(frames, index, -1);
  const after = nearestReliable(frames, index, 1);
  if (before === undefined || after === undefined) return heldAt(frames, before ?? after);
  if (before === after) return frames[index]?.motion ?? IDENTITY;
  const weight = (index - before) / (after - before);
  return similarity(blend(motionAt(frames, before), motionAt(frames, after), weight));
}

/**
 * Every frame's motion, an unreliable one replaced by the reliable motions around it blended by
 * distance (the nearest one at the ends, standing still when none is reliable): a camera keeps
 * moving through a stretch of sky the way it moved into it.
 */
export function fillUnreliable(frames: readonly FrameMotion[]): Similarity[] {
  return Array.from(frames.keys(), (index) => filledAt(frames, index));
}

/** Where the picture of the first frame is in each frame: each motion composed onto the last. */
export function cameraPath(motions: readonly Similarity[]): Similarity[] {
  const path: Similarity[] = [];
  let current = IDENTITY;
  for (const [index, motion] of motions.entries()) {
    current = index === 0 ? IDENTITY : compose(motion, current);
    path.push(current);
  }
  return path;
}

function reflected(series: readonly number[], index: number): number {
  const last = series.length - 1;
  if (index < 0) return 2 * valueAt(series, 0) - valueAt(series, Math.min(-index, last));
  return index > last
    ? 2 * valueAt(series, last) - valueAt(series, Math.max(2 * last - index, 0))
    : valueAt(series, index);
}

// How far the Gaussian looks each way, in standard deviations; beyond, its weights are negligible.
const GAUSSIAN_REACH = 3;

/**
 * A series smoothed by a Gaussian of `sigma` samples, looking both ways in time. Beyond the ends
 * the series is mirrored about its end values, so a straight line stays exactly straight.
 */
export function smoothSeries(series: readonly number[], sigma: number): number[] {
  const reach = Math.ceil(GAUSSIAN_REACH * sigma);
  const weights: number[] = [];
  for (let offset = -reach; offset <= reach; offset += 1) {
    weights.push(Math.exp(-(offset ** 2) / (2 * sigma * sigma)));
  }
  const total = weights.reduce((sum, w) => sum + w, 0);
  return Array.from(
    series.keys(),
    (index) =>
      weights.reduce((sum, w, k) => sum + w * reflected(series, index + k - reach), 0) / total,
  );
}

/** The crop: the share of each side cut away, and the frame's height over its width. */
export interface CropWindow {
  readonly aspect: number;
  readonly crop: number;
}

const SEARCH_STEPS = 24;

function isWindowCovered(correction: Similarity, window: CropWindow): boolean {
  const back = invert(correction);
  const [hw, hh] = [(1 - window.crop) / 2, ((1 - window.crop) * window.aspect) / 2];
  const corners = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ];
  return corners.every((corner) => {
    const source = apply(back, corner);
    return Math.abs(source.x) <= 1 / 2 && Math.abs(source.y) <= window.aspect / 2;
  });
}

/**
 * The correction, weakened toward none just enough that the crop window shows only picture: the
 * window's corners, taken back through the correction, stay inside the frame.
 *
 * @remarks Searched by bisection over the share of the correction kept; none at all always fits.
 */
export function fitCrop(correction: Similarity, window: CropWindow): Similarity {
  if (isWindowCovered(correction, window)) return correction;
  const full = parts(correction);
  const none = parts(IDENTITY);
  let [low, high] = [0, 1];
  for (let step = 0; step < SEARCH_STEPS; step += 1) {
    const middle = (low + high) / 2;
    if (isWindowCovered(similarity(blend(none, full, middle)), window)) low = middle;
    else high = middle;
  }
  return similarity(blend(none, full, low));
}

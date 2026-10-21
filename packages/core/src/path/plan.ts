import {
  compose,
  IDENTITY,
  invert,
  parts,
  similarity,
  type Similarity,
} from '../geometry/similarity';
import type { Microseconds, Seconds } from '../shared/units/units';
import { cameraPath, fillUnreliable, fitCrop, smoothSeries, type FrameMotion } from './path';
import { valueAt } from '../shared/values/values';

/** One analysed frame: when it shows, and its motion from the frame before. */
export interface TrackFrame extends FrameMotion {
  readonly timestamp: Microseconds;
}

/**
 * The camera motion of a whole video: each frame's motion from the one before, in normalized
 * coordinates, and the frame's height over its width. The first frame's motion is the identity.
 */
export interface MotionTrack {
  readonly aspect: number;
  readonly frames: readonly TrackFrame[];
}

/**
 * How to stabilize: `smoothing` is how long a shake lasts and still gets smoothed (the Gaussian's
 * standard deviation); `crop` is the share of each side given up to hide the moving edges.
 */
export interface PlanOptions {
  readonly smoothing: Seconds;
  readonly crop: number;
}

/** A frame's correction: how to move its picture onto the smooth path. */
export interface PlanFrame {
  readonly timestamp: Microseconds;
  readonly correction: Similarity;
}

/**
 * Everything rendering needs, as plain data: computed once from the analysis, it can be stored
 * and applied to the same video again at any resolution.
 */
export interface StabilizationPlan {
  readonly aspect: number;
  readonly crop: number;
  readonly frames: readonly PlanFrame[];
}

const MAX_CROP = 0.5;
const MICROSECONDS_PER_SECOND = 1_000_000;

function checked(options: PlanOptions): void {
  if (!(options.crop >= 0 && options.crop < MAX_CROP)) {
    throw new RangeError(`crop must be from 0 to below ${MAX_CROP}, got ${options.crop}`);
  }
  if (!(options.smoothing > 0)) {
    throw new RangeError(`smoothing must be positive, got ${options.smoothing}`);
  }
}

/** The typical time between frames, in seconds: the median, robust to a dropped frame. */
function frameInterval(frames: readonly TrackFrame[]): number {
  const times = frames.map((f) => f.timestamp);
  const gaps = times
    .slice(1)
    .map((time, k) => time - valueAt(times, k))
    .toSorted((a, b) => a - b);
  return (gaps[Math.floor(gaps.length / 2)] ?? MICROSECONDS_PER_SECOND) / MICROSECONDS_PER_SECOND;
}

/** Angles made continuous: each jump of more than half a turn undone by a whole turn. */
export function unwrap(angles: readonly number[]): number[] {
  let offset = 0;
  return angles.map((angle, index) => {
    const step = angle - (angles[index - 1] ?? angle);
    offset -= Math.round(step / (2 * Math.PI)) * 2 * Math.PI;
    return angle + offset;
  });
}

function smoothPath(path: readonly Similarity[], sigma: number): Similarity[] {
  const split = path.map((s) => parts(s));
  const angle = smoothSeries(unwrap(split.map((p) => p.angle)), sigma);
  const scale = smoothSeries(
    split.map((p) => Math.log(p.scale)),
    sigma,
  );
  const tx = smoothSeries(
    split.map((p) => p.tx),
    sigma,
  );
  const ty = smoothSeries(
    split.map((p) => p.ty),
    sigma,
  );
  return Array.from(path.keys(), (k) =>
    similarity({
      angle: valueAt(angle, k),
      scale: Math.exp(valueAt(scale, k)),
      tx: valueAt(tx, k),
      ty: valueAt(ty, k),
    }),
  );
}

/**
 * Plan the stabilization of a video from its motion: the camera path accumulated from the
 * reliable motions, smoothed both ways in time, and each frame's correction onto the smooth path
 * weakened where needed so the crop window shows only picture.
 *
 * @throws RangeError for a crop outside 0..0.5 or a smoothing that is not positive.
 */
export function planStabilization(track: MotionTrack, options: PlanOptions): StabilizationPlan {
  checked(options);
  const path = cameraPath(fillUnreliable(track.frames));
  const sigma = options.smoothing / frameInterval(track.frames);
  const smooth = smoothPath(path, sigma);
  const window = { aspect: track.aspect, crop: options.crop };
  const frames = track.frames.map((frame, k) => {
    const at = path[k] ?? IDENTITY;
    const wanted = compose(smooth[k] ?? at, invert(at));
    return { timestamp: frame.timestamp, correction: fitCrop(wanted, window) };
  });
  return { aspect: track.aspect, crop: options.crop, frames };
}

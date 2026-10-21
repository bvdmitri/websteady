import { ransacSimilarity, type PointPair } from '../geometry/fit';
import { IDENTITY, type Point, type Similarity } from '../geometry/similarity';
import { corners, type CornerOptions } from '../image/corners';
import type { GrayImage, Size } from '../image/gray';
import { pyramid, type PyramidOptions } from '../image/pyramid';
import { trackPoints, type TrackOptions } from '../image/track';
import { seededRandom } from '../shared/random/random';

/** Every setting of the motion analysis; {@link ANALYSIS} holds the measured defaults. */
export interface AnalysisOptions {
  readonly pyramid: PyramidOptions;
  readonly corners: CornerOptions;
  readonly track: TrackOptions;
  /** RANSAC's inlier distance, in pixels of the analysed frame. */
  readonly threshold: number;
  /** The fewest agreeing points, and the smallest share of tracked ones, for a reliable motion. */
  readonly minInliers: number;
  readonly minInlierShare: number;
  readonly seed: number;
}

/** The defaults, for frames analysed at a long side of about 480 pixels. */
export const ANALYSIS: AnalysisOptions = {
  pyramid: { levels: 4, smallest: 24 },
  // A corner needs a contrast of a few grey levels around it: video noise and the dithering a
  // browser adds when drawing a flat frame score below this, so open sky has no corners.
  corners: { cell: 24, quality: 0.02, minimum: 1e-3 },
  track: { radius: 7, iterations: 10, epsilon: 0.03, maxBackError: 0.5 },
  threshold: 1,
  minInliers: 8,
  minInlierShare: 0.3,
  seed: 1,
};

/** A frame ready for analysis: its pyramid, finest first. */
export interface PreparedFrame {
  readonly size: Size;
  readonly levels: readonly GrayImage[];
}

/** The camera motion measured between two frames, and whether to trust it. */
export interface PairMotion {
  /** How the picture moved, in normalized coordinates (see {@link toNormalized}). */
  readonly motion: Similarity;
  readonly inliers: number;
  readonly tracked: number;
  readonly reliable: boolean;
}

/** A frame's pyramid, built once and used for both of its pairs. */
export function prepare(image: GrayImage, options: AnalysisOptions = ANALYSIS): PreparedFrame {
  return {
    size: { width: image.width, height: image.height },
    levels: pyramid(image, options.pyramid),
  };
}

/**
 * A pixel position in normalized coordinates: the origin at the frame's centre, one unit a frame
 * width. Motions kept this way apply to the same video at any resolution.
 */
export function toNormalized(p: Point, size: Size): Point {
  return { x: (p.x - size.width / 2) / size.width, y: (p.y - size.height / 2) / size.width };
}

function normalizedPairs(pairs: readonly PointPair[], size: Size): PointPair[] {
  return pairs.map(({ from, to }) => ({
    from: toNormalized(from, size),
    to: toNormalized(to, size),
  }));
}

/**
 * The camera motion from frame `a` to frame `b`: corners of `a` tracked into `b`, and the
 * similarity most of them agree on. Unreliable when too few points agree, as on sky, a flat wall
 * or a frame filled by moving subjects.
 */
export function analyzePair(
  a: PreparedFrame,
  b: PreparedFrame,
  options: AnalysisOptions,
): PairMotion {
  const finest = a.levels[0];
  const points = finest === undefined ? [] : corners(finest, options.corners);
  const pairs = trackPoints({ before: a.levels, after: b.levels }, points, options.track);
  const threshold = options.threshold / a.size.width;
  const random = seededRandom(options.seed);
  const fit = ransacSimilarity(normalizedPairs(pairs, a.size), { threshold, random });
  const inliers = fit?.inliers ?? 0;
  const isReliable =
    fit !== undefined &&
    inliers >= options.minInliers &&
    inliers >= options.minInlierShare * pairs.length;
  return {
    motion: fit?.transform ?? IDENTITY,
    inliers,
    tracked: pairs.length,
    reliable: isReliable,
  };
}

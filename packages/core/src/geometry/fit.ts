import { apply, type Point, type Similarity } from './similarity';

/** A point in one frame and where it is found in the next. */
export interface PointPair {
  readonly from: Point;
  readonly to: Point;
}

/** A robust fit: the transform, and how many pairs it explains within the threshold. */
export interface RobustFit {
  readonly transform: Similarity;
  readonly inliers: number;
}

/** How hard RANSAC tries: `threshold` in pixels, a seeded `random`, and `iterations` draws. */
export interface RansacOptions {
  readonly threshold: number;
  readonly random: () => number;
  readonly iterations?: number;
}

const DEFAULT_ITERATIONS = 200;

function centroid(points: readonly Point[]): Point {
  let [x, y] = [0, 0];
  for (const p of points) [x, y] = [x + p.x, y + p.y];
  const sum = { x, y };
  return { x: sum.x / points.length, y: sum.y / points.length };
}

/**
 * The similarity that best maps each pair's `from` to its `to`, in the least-squares sense; none
 * when the `from` points do not span any distance (fewer than two distinct points).
 *
 * @remarks Closed form: with both point sets centred, `a` and `b` are the dot and cross sums over
 * the spread of the `from` points, and the move maps one centroid onto the other.
 */
export function fitSimilarity(pairs: readonly PointPair[]): Similarity | undefined {
  if (pairs.length === 0) return undefined;
  const p = centroid(pairs.map((pair) => pair.from));
  const q = centroid(pairs.map((pair) => pair.to));
  let dot = 0;
  let cross = 0;
  let spread = 0;
  for (const { from, to } of pairs) {
    const [px, py, qx, qy] = [from.x - p.x, from.y - p.y, to.x - q.x, to.y - q.y];
    dot += px * qx + py * qy;
    cross += px * qy - py * qx;
    spread += px * px + py * py;
  }
  if (spread === 0) return undefined;
  const turn = { a: dot / spread, b: cross / spread, tx: 0, ty: 0 };
  const moved = apply(turn, p);
  return { ...turn, tx: q.x - moved.x, ty: q.y - moved.y };
}

const residual = (s: Similarity, pair: PointPair): number => {
  const at = apply(s, pair.from);
  return Math.hypot(at.x - pair.to.x, at.y - pair.to.y);
};

const explained = (s: Similarity, pairs: readonly PointPair[], threshold: number): PointPair[] =>
  pairs.filter((pair) => residual(s, pair) <= threshold);

function draw(pairs: readonly PointPair[], random: () => number): Similarity | undefined {
  const first = Math.floor(random() * pairs.length);
  const offset = 1 + Math.floor(random() * (pairs.length - 1));
  const sample = [pairs[first], pairs[(first + offset) % pairs.length]];
  return fitSimilarity(sample.filter((pair) => pair !== undefined));
}

/**
 * The similarity most pairs agree on, ignoring pairs that disagree (points on moving subjects,
 * tracking errors): RANSAC over two-pair samples, then a least-squares refit on the agreeing
 * pairs. None when fewer than two pairs are given or no sample explains any pair.
 *
 * @remarks Seeded through `random`, so the same input gives the same answer.
 */
export function ransacSimilarity(
  pairs: readonly PointPair[],
  options: RansacOptions,
): RobustFit | undefined {
  if (pairs.length < 2) return undefined;
  let best: PointPair[] = [];
  for (let round = 0; round < (options.iterations ?? DEFAULT_ITERATIONS); round += 1) {
    const candidate = draw(pairs, options.random);
    const agreeing = candidate === undefined ? [] : explained(candidate, pairs, options.threshold);
    if (agreeing.length > best.length) best = agreeing;
  }
  const transform = fitSimilarity(best);
  return transform === undefined
    ? undefined
    : { transform, inliers: explained(transform, pairs, options.threshold).length };
}

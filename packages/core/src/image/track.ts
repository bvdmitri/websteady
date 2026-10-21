import type { PointPair } from '../geometry/fit';
import type { Point } from '../geometry/similarity';
import { sample, type GrayImage } from './gray';
import { pixelAt } from '../shared/values/values';

/**
 * How points are tracked: a window of (2 * `radius` + 1) pixels square, at most `iterations`
 * refinements per pyramid level, stopping when a step is below `epsilon` pixels; a point is kept
 * when tracking it back lands within `maxBackError` pixels of where it started.
 */
export interface TrackOptions {
  readonly radius: number;
  readonly iterations: number;
  readonly epsilon: number;
  readonly maxBackError: number;
}

// Below this, the window's gradients do not fix a direction and the step is meaningless.
const MIN_DETERMINANT = 1e-9;

interface Window {
  readonly points: readonly Point[];
  readonly values: Float32Array;
  readonly gradients: readonly (readonly [number, number])[];
  readonly inverse: readonly [number, number, number];
}

function window(image: GrayImage, center: Point, radius: number): Window | undefined {
  const points: Point[] = [];
  const gradients: [number, number][] = [];
  let [xx, yy, xy] = [0, 0, 0];
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const p = { x: center.x + dx, y: center.y + dy };
      const g: [number, number] = [
        (sample(image, p.x + 1, p.y) - sample(image, p.x - 1, p.y)) / 2,
        (sample(image, p.x, p.y + 1) - sample(image, p.x, p.y - 1)) / 2,
      ];
      [xx, yy, xy] = [xx + g[0] * g[0], yy + g[1] * g[1], xy + g[0] * g[1]];
      points.push(p);
      gradients.push(g);
    }
  }
  const det = xx * yy - xy * xy;
  if (det < MIN_DETERMINANT) return undefined;
  const values = Float32Array.from(points, (p) => sample(image, p.x, p.y));
  return { points, values, gradients, inverse: [yy / det, -xy / det, xx / det] };
}

// One Lucas-Kanade step: the displacement that best explains the difference at `flow`.
function step(win: Window, next: GrayImage, flow: Point): Point {
  let [bx, by] = [0, 0];
  for (const [index, p] of win.points.entries()) {
    const diff = pixelAt(win.values, index) - sample(next, p.x + flow.x, p.y + flow.y);
    const [gx, gy] = win.gradients[index] ?? [0, 0];
    bx += diff * gx;
    by += diff * gy;
  }
  const [ixx, ixy, iyy] = win.inverse;
  return { x: ixx * bx + ixy * by, y: ixy * bx + iyy * by };
}

/** A frame and the next one, each as a pyramid (finest first), to track points between. */
export interface PyramidPair {
  readonly before: readonly GrayImage[];
  readonly after: readonly GrayImage[];
}

// Where a point sits at one pyramid level, and the flow guessed for it from the level above.
interface Start {
  readonly at: Point;
  readonly guess: Point;
}

function refine(
  levels: readonly [GrayImage, GrayImage],
  start: Start,
  options: TrackOptions,
): Point | undefined {
  const win = window(levels[0], start.at, options.radius);
  if (win === undefined) return undefined;
  let flow = start.guess;
  for (let round = 0; round < options.iterations; round += 1) {
    const delta = step(win, levels[1], flow);
    flow = { x: flow.x + delta.x, y: flow.y + delta.y };
    if (Math.hypot(delta.x, delta.y) < options.epsilon) break;
  }
  return flow;
}

function trackOne(pyramids: PyramidPair, point: Point, options: TrackOptions): Point | undefined {
  const { before, after } = pyramids;
  let flow: Point | undefined = { x: 0, y: 0 };
  for (let level = before.length - 1; flow !== undefined && level >= 0; level -= 1) {
    const scale = 2 ** level;
    const pair = [before[level], after[level]] as [GrayImage, GrayImage];
    flow = refine(pair, { at: { x: point.x / scale, y: point.y / scale }, guess: flow }, options);
    if (flow !== undefined && level > 0) flow = { x: flow.x * 2, y: flow.y * 2 };
  }
  return flow === undefined ? undefined : { x: point.x + flow.x, y: point.y + flow.y };
}

const isInside = (p: Point, image: GrayImage): boolean =>
  p.x >= 0 && p.y >= 0 && p.x <= image.width - 1 && p.y <= image.height - 1;

/**
 * Where each point of the frame `before` is in the frame `after`, both given as pyramids (finest
 * first): pyramidal Lucas-Kanade from the coarsest level down (Bouguet's method). A point is
 * dropped when its window has no texture, it leaves the frame, or tracking it back misses its
 * start by more than `maxBackError`. Empty pyramids track nothing.
 */
export function trackPoints(
  pyramids: PyramidPair,
  points: readonly Point[],
  options: TrackOptions,
): PointPair[] {
  const finest = pyramids.after[0];
  if (finest === undefined) return [];
  const reversed = { before: pyramids.after, after: pyramids.before };
  const pairs: PointPair[] = [];
  for (const from of points) {
    const to = trackOne(pyramids, from, options);
    if (to === undefined || !isInside(to, finest)) continue;
    const back = trackOne(reversed, to, options);
    if (
      back !== undefined &&
      Math.hypot(back.x - from.x, back.y - from.y) <= options.maxBackError
    ) {
      pairs.push({ from, to });
    }
  }
  return pairs;
}

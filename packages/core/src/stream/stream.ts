import type { Similarity } from '../geometry/similarity';
import type { GrayImage, Size } from '../image/gray';
import {
  analyzePair,
  ANALYSIS,
  prepare,
  type AnalysisOptions,
  type PreparedFrame,
} from '../motion/analyze';
import type { FrameMotion } from '../path/path';
import type { MotionTrack, PlanFrame, StabilizationPlan, TrackFrame } from '../path/plan';
import { IDENTITY } from '../geometry/similarity';
import { frameTransform } from '../render/transform';
import type { Microseconds } from '../shared/units/units';

/** The part of an `AbortSignal` the streams read, so the core needs no DOM types. */
export interface StopSignal {
  readonly aborted: boolean;
  readonly reason: unknown;
}

/** What the analysis needs from a frame: a small grey copy, its time and shape, and release. */
export interface AnalysisPort<F> {
  thumbnail(frame: F): GrayImage | Promise<GrayImage>;
  timestamp(frame: F): Microseconds;
  /** The frame's height over its width, as it is shown. */
  aspect(frame: F): number;
  close(frame: F): void;
}

/** What rendering needs from a frame: its size and time, drawing it through a transform, release. */
export interface RenderPort<F> {
  size(frame: F): Size;
  timestamp(frame: F): Microseconds;
  /** A new frame: `frame` drawn through `transform` (its pixels to the output's) at its size. */
  render(frame: F, transform: Similarity): F | Promise<F>;
  close(frame: F): void;
}

/** Optional analysis settings, a signal that stops the stream, and progress in frames done. */
export interface StreamOptions {
  readonly analysis?: AnalysisOptions;
  readonly signal?: StopSignal;
  readonly onProgress?: (framesDone: number) => void;
}

/** The stream settings for rendering, with the port that draws each frame. */
export interface RenderOptions<F> extends StreamOptions {
  readonly port: RenderPort<F>;
}

function checkSignal(signal: StopSignal | undefined): void {
  if (signal?.aborted === true) throw signal.reason;
}

// The frame's thumbnail; the frame is closed whether or not taking it succeeds.
async function thumbnailOf<F>(port: AnalysisPort<F>, frame: F): Promise<GrayImage> {
  try {
    return await port.thumbnail(frame);
  } finally {
    port.close(frame);
  }
}

// A frame's motion from the one before; the first frame stands still and is trusted.
function motionFrom(
  previous: PreparedFrame | undefined,
  current: PreparedFrame,
  settings: AnalysisOptions,
): FrameMotion {
  if (previous === undefined) return { motion: IDENTITY, reliable: true };
  const { motion, reliable } = analyzePair(previous, current, settings);
  return { motion, reliable };
}

/**
 * The camera motion of a stream of frames: each frame's thumbnail analysed against the one
 * before. Every frame is closed once its thumbnail is taken; only two thumbnails are held.
 */
export async function analyzeStream<F>(
  frames: AsyncIterable<F>,
  port: AnalysisPort<F>,
  options: StreamOptions,
): Promise<MotionTrack> {
  const settings = options.analysis ?? ANALYSIS;
  const track: TrackFrame[] = [];
  let aspect = 1;
  let previous: PreparedFrame | undefined;
  for await (const frame of frames) {
    checkSignal(options.signal);
    const timestamp = port.timestamp(frame);
    if (previous === undefined) aspect = port.aspect(frame);
    const current = prepare(await thumbnailOf(port, frame), settings);
    track.push({ timestamp, ...motionFrom(previous, current, settings) });
    previous = current;
    options.onProgress?.(track.length);
  }
  return { aspect, frames: track };
}

// The index of the first plan frame not before `timestamp` (the last one when all are), by
// binary search.
function firstNotBefore(frames: readonly PlanFrame[], timestamp: number): number {
  let [low, high] = [0, frames.length - 1];
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if ((frames[middle]?.timestamp ?? 0) < timestamp) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** The plan frame nearest in time to `timestamp`. */
function nearest(frames: readonly PlanFrame[], timestamp: number): PlanFrame | undefined {
  const low = firstNotBefore(frames, timestamp);
  const after = frames[low];
  const before = frames[low - 1];
  if (before === undefined || after === undefined) return after ?? before;
  return timestamp - before.timestamp < after.timestamp - timestamp ? before : after;
}

/**
 * The transform that draws the frame shown at `timestamp` steady, for a frame of `size`: from its
 * pixels to the output's pixels (same size), the plan frame nearest in time's correction and the
 * crop's zoom included. Rendering it anywhere (a canvas, a GPU pass) gives what `stabilizeStream`
 * draws.
 */
export function transformAt(
  plan: StabilizationPlan,
  timestamp: Microseconds,
  size: Size,
): Similarity {
  const correction = nearest(plan.frames, timestamp)?.correction ?? IDENTITY;
  return frameTransform(correction, plan.crop, size);
}

/**
 * The frames drawn steady by `plan`: each frame through the correction of the plan frame nearest
 * in time, at its own size. Each source frame is closed once drawn; the caller closes the frames
 * it receives.
 */
export async function* stabilizeStream<F>(
  frames: AsyncIterable<F>,
  plan: StabilizationPlan,
  options: RenderOptions<F>,
): AsyncGenerator<F, void, undefined> {
  const { port } = options;
  if (plan.frames.length === 0) throw new RangeError('the plan has no frames');
  let done = 0;
  for await (const frame of frames) {
    try {
      checkSignal(options.signal);
      yield await port.render(frame, transformAt(plan, port.timestamp(frame), port.size(frame)));
    } finally {
      port.close(frame);
    }
    done += 1;
    options.onProgress?.(done);
  }
}

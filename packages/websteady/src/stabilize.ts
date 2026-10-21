import {
  analyzeStream,
  planStabilization as planFromTrack,
  microseconds,
  seconds,
  stabilizeStream,
  transformAt as transformFromPlan,
  type Similarity,
  type Size,
  type AnalysisPort,
  type MotionTrack,
  type StabilizationPlan,
} from '@websteady/core';

import { browserPlatform, type Platform } from './platform';

/** A signal that stops the work between frames, progress in frames done, and the environment. */
export interface StreamOptions {
  readonly signal?: AbortSignal;
  readonly onProgress?: (framesDone: number) => void;
  readonly platform?: Platform;
}

/**
 * How to stabilize. `smoothing`, in seconds (1 by default), is how long a wobble may last and
 * still be smoothed away: larger is steadier, smaller follows the camera more closely. `crop`
 * (0.1 by default) is the share of each side given up to hide the moving edges.
 */
export interface PlanOptions {
  readonly smoothing?: number;
  readonly crop?: number;
}

/**
 * Three settings for a user to pick from: `gentle` follows the camera closely and crops little,
 * `strong` holds the picture steadiest and crops most. `normal` is the default.
 */
export const PRESETS = {
  gentle: { smoothing: 0.5, crop: 0.05 },
  normal: { smoothing: 1, crop: 0.1 },
  strong: { smoothing: 2, crop: 0.15 },
} as const satisfies Record<string, Required<PlanOptions>>;

const DEFAULT_SMOOTHING = PRESETS.normal.smoothing;
const DEFAULT_CROP = PRESETS.normal.crop;

function streamOptions(options: StreamOptions): {
  signal?: AbortSignal;
  onProgress?: (n: number) => void;
} {
  return {
    ...(options.signal && { signal: options.signal }),
    ...(options.onProgress && { onProgress: options.onProgress }),
  };
}

/**
 * Measure the camera motion of a video from its decoded frames: each frame drawn small and grey,
 * corners tracked into the next, and the motion most of them agree on. Every frame is closed
 * once read.
 *
 * @remarks Frames should be every frame of the video in order, as a decoder gives them.
 */
export async function analyzeMotion(
  frames: AsyncIterable<VideoFrame>,
  options: StreamOptions = {},
): Promise<MotionTrack> {
  const platform = options.platform ?? browserPlatform();
  const port: AnalysisPort<VideoFrame> = {
    thumbnail: (frame) => platform.thumbnail(frame),
    timestamp: (frame) => platform.timestamp(frame),
    aspect: (frame) => platform.size(frame).height / platform.size(frame).width,
    close: (frame) => {
      platform.close(frame);
    },
  };
  return analyzeStream(frames, port, streamOptions(options));
}

/**
 * Plan the stabilization of an analysed video: the camera path smoothed, and each frame's
 * correction kept within the crop. The plan is plain data, to store and apply later.
 *
 * @throws RangeError for a crop outside 0..0.5 or a smoothing that is not positive.
 */
export function planStabilization(
  track: MotionTrack,
  options: PlanOptions = {},
): StabilizationPlan {
  const smoothing = seconds(options.smoothing ?? DEFAULT_SMOOTHING);
  return planFromTrack(track, { smoothing, crop: options.crop ?? DEFAULT_CROP });
}

/**
 * The frames drawn steady by `plan`: each through its frame's correction and the crop, at its own
 * size, with its own timing. Each source frame is closed once drawn; close every frame received.
 */
export function stabilize(
  frames: AsyncIterable<VideoFrame>,
  plan: StabilizationPlan,
  options: StreamOptions = {},
): AsyncGenerator<VideoFrame, void, undefined> {
  const platform = options.platform ?? browserPlatform();
  return stabilizeStream(frames, plan, { ...streamOptions(options), port: platform });
}

/**
 * The transform that draws the frame shown at `timestamp` (microseconds, as `VideoFrame.timestamp`)
 * steady, for a frame of `size`: from the frame's pixels to the output's pixels, at the same size,
 * the crop's zoom included. For drawing in your own pass (a WebGPU shader, say) instead of
 * {@link stabilize}: sample the source at `invert(transform)` of each output pixel.
 */
export function transformAt(plan: StabilizationPlan, timestamp: number, size: Size): Similarity {
  return transformFromPlan(plan, microseconds(timestamp), size);
}

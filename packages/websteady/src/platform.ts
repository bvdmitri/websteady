import {
  drawThumbnail,
  drawTransformed,
  THUMBNAIL_SIDE,
  type CanvasMaker,
} from '@websteady/canvas';
import {
  microseconds,
  type GrayImage,
  type Microseconds,
  type Similarity,
  type Size,
} from '@websteady/core';

import { WebsteadyError } from './errors';

/**
 * What websteady does with a video frame: read its size and time, draw a small grey copy, draw
 * it through a transform into a new frame, and release it.
 *
 * @remarks {@link browserPlatform} binds it to `VideoFrame` and `OffscreenCanvas`; a test
 * supplies its own, which is how the streams run outside a browser.
 */
export interface Platform {
  size(frame: VideoFrame): Size;
  timestamp(frame: VideoFrame): Microseconds;
  thumbnail(frame: VideoFrame): GrayImage | Promise<GrayImage>;
  render(frame: VideoFrame, transform: Similarity): VideoFrame | Promise<VideoFrame>;
  close(frame: VideoFrame): void;
}

/** A frame's size as it is shown. */
function displaySize(frame: VideoFrame): Size {
  return { width: frame.displayWidth, height: frame.displayHeight };
}

function canvasMaker(): CanvasMaker {
  // One canvas per size, reused: a frame made from a canvas copies its pixels.
  const made = new Map<string, ReturnType<CanvasMaker>>();
  return (size) => {
    const key = `${size.width}x${size.height}`;
    const known = made.get(key);
    if (known !== undefined) return known;
    if (typeof OffscreenCanvas === 'undefined') {
      throw new WebsteadyError('canvas-unavailable', 'this browser has no OffscreenCanvas');
    }
    const canvas = new OffscreenCanvas(size.width, size.height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (context === null) throw new WebsteadyError('canvas-unavailable', 'no 2D canvas context');
    const pair = { canvas, context };
    made.set(key, pair);
    return pair;
  };
}

/** The browser as a {@link Platform}: `VideoFrame`s drawn on `OffscreenCanvas`es. */
export function browserPlatform(): Platform {
  const make = canvasMaker();
  return {
    size: displaySize,
    timestamp: (frame) => microseconds(frame.timestamp),
    thumbnail: (frame): GrayImage =>
      drawThumbnail(frame, displaySize(frame), { make, longSide: THUMBNAIL_SIDE }),
    render: (frame, transform): VideoFrame => {
      const canvas = drawTransformed(frame, displaySize(frame), { make, transform });
      const duration = frame.duration === null ? {} : { duration: frame.duration };
      return new VideoFrame(canvas, { timestamp: frame.timestamp, ...duration });
    },
    close: (frame): void => {
      frame.close();
    },
  };
}

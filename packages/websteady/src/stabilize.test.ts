import {
  apply,
  IDENTITY,
  microseconds,
  similarity,
  type GrayImage,
  type Similarity,
} from '@websteady/core';
import { describe, expect, it } from 'vitest';

import type { Platform } from './platform';
import { analyzeMotion, planStabilization, PRESETS, stabilize, transformAt } from './stabilize';

// A stand-in frame: a grey picture and a time, as the platform below reads it.
interface Fake {
  readonly image: GrayImage;
  readonly timestamp: number;
  readonly drawnWith?: Similarity;
  readonly displayWidth: number;
  readonly displayHeight: number;
  closed: boolean;
  close(): void;
}

function makeFake(image: GrayImage, timestamp: number): Fake {
  const frame: Fake = {
    image,
    timestamp,
    displayWidth: image.width,
    displayHeight: image.height,
    closed: false,
    close: () => {
      frame.closed = true;
    },
  };
  return frame;
}

function texture(x: number, y: number): number {
  return 0.5 + (Math.sin(x / 7 + y / 11) + Math.cos(x / 13 - y / 5)) / 5;
}

function picture(shift: number): GrayImage {
  const [width, height] = [160, 90];
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) data[y * width + x] = texture(x - shift, y);
  }
  return { width, height, data };
}

const fake = (frame: VideoFrame): Fake => frame as unknown as Fake;
const platform: Platform = {
  size: (frame) => ({ width: fake(frame).image.width, height: fake(frame).image.height }),
  timestamp: (frame) => microseconds(fake(frame).timestamp),
  thumbnail: (frame) => Promise.resolve(fake(frame).image),
  render: (frame, transform) =>
    Promise.resolve({
      ...fake(frame),
      drawnWith: transform,
      closed: false,
    } as unknown as VideoFrame),
  close: (frame) => {
    fake(frame).closed = true;
  },
};

async function* frames(shifts: readonly number[], made: Fake[] = []): AsyncGenerator<VideoFrame> {
  for (const [k, shift] of shifts.entries()) {
    await Promise.resolve();
    const frame = makeFake(picture(shift), k * 33_333);
    made.push(frame);
    yield frame as unknown as VideoFrame;
  }
}

const shake = [0, 3, -2, 4, -1, 3, 0, -3];

// The same frames five seconds into a video, as a trimmed export reads them.
async function* later(): AsyncGenerator<VideoFrame> {
  for await (const frame of frames(shake)) {
    yield {
      ...fake(frame),
      timestamp: fake(frame).timestamp + 5_000_000,
    } as unknown as VideoFrame;
  }
}

describe('analyzeMotion, planStabilization and stabilize', () => {
  it('measure the shake, plan it away and draw each frame through its correction', async () => {
    const analysed: Fake[] = [];
    const progress: number[] = [];
    const track = await analyzeMotion(frames(shake, analysed), {
      platform,
      onProgress: (n) => {
        progress.push(n);
      },
    });
    expect(track.frames).toHaveLength(shake.length);
    expect(track.frames[1]?.motion.tx).toBeCloseTo(3 / 160, 3);
    expect(analysed.every((f) => f.closed)).toBe(true);
    expect(progress.at(-1)).toBe(shake.length);

    const plan = planStabilization(track, { smoothing: 0.5, crop: 0.2 });
    const drawn: Fake[] = [];
    const steady = stabilize(frames(shake), plan, { platform });
    for await (const frame of steady) drawn.push(fake(frame));
    // A point of the scene lands at nearly the same place in every stabilized frame.
    const landed = drawn.map((f, k) => apply(f.drawnWith!, { x: 80 + shake[k]!, y: 45 }).x);
    const spread = Math.max(...landed) - Math.min(...landed);
    expect(spread).toBeLessThan(2);
  });

  it('plan with a second of smoothing and a tenth cropped by default', () => {
    const still = {
      aspect: 0.5,
      frames: [{ timestamp: microseconds(0), motion: IDENTITY, reliable: true }],
    };
    expect(planStabilization(still).crop).toBe(0.1);
    expect(() => planStabilization(still, { smoothing: -1 })).toThrow(RangeError);
  });

  it('stop when the signal aborts', async () => {
    const controller = new AbortController();
    controller.abort(new Error('cancelled'));
    await expect(
      analyzeMotion(frames([0, 1]), { platform, signal: controller.signal }),
    ).rejects.toThrow('cancelled');
    const plan = {
      aspect: 0.5,
      crop: 0,
      frames: [
        {
          timestamp: microseconds(0),
          correction: similarity({ angle: 0, scale: 1, tx: 0, ty: 0 }),
        },
      ],
    };
    const stream = stabilize(frames([0]), plan, { platform, signal: controller.signal });
    await expect(stream.next()).rejects.toThrow('cancelled');
  });

  it('plan and draw a sub-range whose times do not start at zero', async () => {
    const track = await analyzeMotion(later(), { platform });
    expect(track.frames[0]?.timestamp).toBe(5_000_000);
    const plan = planStabilization(track, PRESETS.strong);
    const drawn: Fake[] = [];
    const steady = stabilize(later(), plan, { platform });
    for await (const frame of steady) drawn.push(fake(frame));
    const landed = drawn.map((f, k) => apply(f.drawnWith!, { x: 80 + shake[k]!, y: 45 }).x);
    expect(Math.max(...landed) - Math.min(...landed)).toBeLessThan(2);
  });

  it('report progress for each pass from its first frame', async () => {
    const passes: number[][] = [[], []];
    const track = await analyzeMotion(frames(shake), {
      platform,
      onProgress: (n) => void passes[0]!.push(n),
    });
    const plan = planStabilization(track);
    const steady = stabilize(frames(shake), plan, {
      platform,
      onProgress: (n) => void passes[1]!.push(n),
    });
    for await (const frame of steady) platform.close(frame);
    const counts = [...shake.keys()].map((k) => k + 1);
    expect(passes).toEqual([counts, counts]);
  });
});

describe('transformAt', () => {
  it('is the transform stabilize draws each frame through', async () => {
    const track = await analyzeMotion(frames(shake), { platform });
    const plan = planStabilization(track);
    const size = { width: 160, height: 90 };
    const steady = stabilize(frames(shake), plan, { platform });
    for await (const frame of steady) {
      expect(fake(frame).drawnWith).toEqual(transformAt(plan, fake(frame).timestamp, size));
    }
  });
});

describe('PRESETS', () => {
  it('go from following the camera to holding it steadiest', () => {
    expect(PRESETS.gentle.smoothing).toBeLessThan(PRESETS.normal.smoothing);
    expect(PRESETS.normal.crop).toBeLessThan(PRESETS.strong.crop);
  });
});

describe('the browser platform by default', () => {
  it('is what the passes draw on when no platform is given', async () => {
    // Node has no OffscreenCanvas, so the browser platform reports it.
    await expect(analyzeMotion(frames([0]))).rejects.toMatchObject({ code: 'canvas-unavailable' });
    const plan = planStabilization({
      aspect: 0.5,
      frames: [{ timestamp: microseconds(0), motion: IDENTITY, reliable: true }],
    });
    await expect(stabilize(frames([0]), plan).next()).rejects.toMatchObject({
      code: 'canvas-unavailable',
    });
  });
});

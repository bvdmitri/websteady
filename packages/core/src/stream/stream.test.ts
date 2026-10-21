import { describe, expect, it } from 'vitest';

import { apply, IDENTITY, similarity, type Similarity } from '../geometry/similarity';
import type { GrayImage } from '../image/gray';
import { ANALYSIS } from '../motion/analyze';
import type { StabilizationPlan } from '../path/plan';
import { microseconds } from '../shared/units/units';
import { flat, textured } from '../testing/images';
import {
  analyzeStream,
  stabilizeStream,
  transformAt,
  type AnalysisPort,
  type RenderPort,
} from './stream';

interface Frame {
  readonly image: GrayImage;
  readonly timestamp: number;
  closed: boolean;
}

// A frame that arrives at 0.9 ms, between the plan's two frames and nearer the second.
async function* late(): AsyncGenerator<Frame> {
  await Promise.resolve();
  yield { image: flat(8, 8), timestamp: 900, closed: false };
}

async function* frames(images: readonly GrayImage[]): AsyncGenerator<Frame> {
  for (const [k, image] of images.entries()) {
    await Promise.resolve();
    yield { image, timestamp: k * 1000, closed: false };
  }
}

const analysisPort: AnalysisPort<Frame> = {
  thumbnail: (f) => Promise.resolve(f.image),
  timestamp: (f) => microseconds(f.timestamp),
  aspect: (f) => f.image.height / f.image.width,
  close: (f) => {
    f.closed = true;
  },
};

describe('analyzeStream', () => {
  it('measures each frame against the one before, closing every frame', async () => {
    const seen: Frame[] = [];
    const shift = similarity({ angle: 0, scale: 1, tx: 4, ty: 0 });
    const images = [textured(160, 90), textured(160, 90, shift), flat(160, 90)];
    const progress: number[] = [];
    const port = {
      ...analysisPort,
      close: (f: Frame): void => {
        seen.push(f);
        analysisPort.close(f);
      },
    };
    const track = await analyzeStream(frames(images), port, {
      analysis: ANALYSIS,
      onProgress: (n) => {
        progress.push(n);
      },
    });
    expect(track.aspect).toBe(90 / 160);
    expect(track.frames.map((f) => [f.timestamp, f.reliable])).toEqual([
      [0, true],
      [1000, true],
      [2000, false],
    ]);
    expect(track.frames[1]?.motion.tx).toBeCloseTo(4 / 160, 3);
    expect(seen.every((f) => f.closed)).toBe(true);
    expect(progress).toEqual([1, 2, 3]);
  });

  it('gives an empty track for no frames, and stops with the signal', async () => {
    expect(await analyzeStream(frames([]), analysisPort, {})).toEqual({ aspect: 1, frames: [] });
    const controller = new AbortController();
    controller.abort(new Error('stopped'));
    const stopped = analyzeStream(frames([flat(8, 8)]), analysisPort, {
      signal: controller.signal,
    });
    await expect(stopped).rejects.toThrow('stopped');
  });
});

describe('stabilizeStream', () => {
  const plan: StabilizationPlan = {
    aspect: 1,
    crop: 0,
    frames: [
      { timestamp: microseconds(0), correction: IDENTITY },
      {
        timestamp: microseconds(1000),
        correction: similarity({ angle: 0, scale: 1, tx: 0.25, ty: 0 }),
      },
    ],
  };
  const rendered: Similarity[] = [];
  const renderPort: RenderPort<Frame> = {
    size: (f) => ({ width: f.image.width, height: f.image.height }),
    timestamp: (f) => microseconds(f.timestamp),
    render: (f, transform) => {
      rendered.push(transform);
      return Promise.resolve({ ...f, closed: false });
    },
    close: (f) => {
      f.closed = true;
    },
  };

  it('draws each frame through its correction at its own size, closing the source', async () => {
    const out: Frame[] = [];
    const sources = [flat(8, 8), flat(8, 8)];
    const progress: number[] = [];
    const options = {
      onProgress: (n: number): void => {
        progress.push(n);
      },
    };
    const stream = stabilizeStream(frames(sources), plan, { ...options, port: renderPort });
    for await (const frame of stream) out.push(frame);
    expect(out).toHaveLength(2);
    expect(progress).toEqual([1, 2]);
    expect(apply(rendered[1]!, { x: 4, y: 4 })).toEqual({ x: 6, y: 4 });
  });

  it('uses the plan frame nearest in time to each frame', async () => {
    rendered.length = 0;
    const stream = stabilizeStream(late(), plan, { port: renderPort });
    for await (const frame of stream) renderPort.close(frame);
    expect(apply(rendered[0]!, { x: 4, y: 4 }).x).toBe(6);
  });

  it('uses the first plan frame before the plan and the last one after it', () => {
    const size = { width: 8, height: 8 };
    const [early, late] = [microseconds(-500), microseconds(9000)];
    const centre = { x: 4, y: 4 };
    expect(apply(transformAt(plan, early, size), centre).x).toBe(4);
    expect(apply(transformAt(plan, late, size), centre).x).toBe(6);
  });

  it('refuses an empty plan', async () => {
    const empty = { ...plan, frames: [] };
    const stream = stabilizeStream(frames([flat(8, 8)]), empty, { port: renderPort });
    await expect(stream.next()).rejects.toThrow('the plan has no frames');
  });
});

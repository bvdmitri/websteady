import { similarity } from '@websteady/core';
import { describe, expect, it } from 'vitest';

import {
  canvasMatrix,
  drawThumbnail,
  drawTransformed,
  thumbnailSize,
  type CanvasMaker,
} from './canvas';

interface Call {
  readonly name: string;
  readonly args: readonly unknown[];
}

function stand(): { make: CanvasMaker; calls: Call[]; sizes: { width: number; height: number }[] } {
  const calls: Call[] = [];
  const sizes: { width: number; height: number }[] = [];
  const record =
    (name: string) =>
    (...values: unknown[]): void => {
      calls.push({ name, args: values });
    };
  const make: CanvasMaker = (size) => {
    sizes.push(size);
    const context = {
      setTransform: record('setTransform'),
      drawImage: record('drawImage'),
      fillRect: record('fillRect'),
      fillStyle: '',
      imageSmoothingQuality: 'low',
      getImageData: (...rect: number[]): { data: Uint8ClampedArray } => ({
        data: new Uint8ClampedArray((rect[2] ?? 0) * (rect[3] ?? 0) * 4).fill(255),
      }),
    };
    return {
      canvas: { width: size.width, height: size.height },
      context,
    } as unknown as ReturnType<CanvasMaker>;
  };
  return { make, calls, sizes };
}

describe('thumbnailSize', () => {
  it('fits the long side to the limit and never enlarges', () => {
    expect(thumbnailSize({ width: 1920, height: 1080 }, 480)).toEqual({ width: 480, height: 270 });
    expect(thumbnailSize({ width: 1080, height: 1920 }, 480)).toEqual({ width: 270, height: 480 });
    expect(thumbnailSize({ width: 320, height: 240 }, 480)).toEqual({ width: 320, height: 240 });
  });
});

describe('canvasMatrix', () => {
  it('orders a similarity as setTransform takes it, column by column', () => {
    const s = similarity({ angle: Math.PI / 2, scale: 1, tx: 5, ty: 6 });
    expect(canvasMatrix(s).map((v) => Math.round(v))).toEqual([0, 1, -1, 0, 5, 6]);
  });
});

describe('drawThumbnail', () => {
  it('draws the frame small and reads it back grey', () => {
    const { make, calls, sizes } = stand();
    const source = { label: 'frame' } as unknown as CanvasImageSource;
    const gray = drawThumbnail(source, { width: 960, height: 540 }, { make, longSide: 480 });
    expect(sizes).toEqual([{ width: 480, height: 270 }]);
    expect(calls).toEqual([{ name: 'drawImage', args: [source, 0, 0, 480, 270] }]);
    expect(gray).toMatchObject({ width: 480, height: 270 });
    expect(gray.data[0]).toBeCloseTo(1, 6);
  });
});

describe('drawTransformed', () => {
  it('clears to black, then draws the frame through the transform at its size', () => {
    const { make, calls } = stand();
    const source = { label: 'frame' } as unknown as CanvasImageSource;
    const transform = similarity({ angle: 0, scale: 2, tx: 3, ty: 4 });
    drawTransformed(source, { width: 64, height: 36 }, { make, transform });
    expect(calls).toEqual([
      { name: 'setTransform', args: [1, 0, 0, 1, 0, 0] },
      { name: 'fillRect', args: [0, 0, 64, 36] },
      { name: 'setTransform', args: [2, 0, -0, 2, 3, 4] },
      { name: 'drawImage', args: [source, 0, 0, 64, 36] },
    ]);
  });
});

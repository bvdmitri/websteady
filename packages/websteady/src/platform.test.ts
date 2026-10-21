import { similarity } from '@websteady/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WebsteadyError } from './errors';
import { browserPlatform } from './platform';

afterEach(() => {
  vi.unstubAllGlobals();
});

class StubFrame {
  public readonly source: unknown;
  public readonly init: unknown;
  public constructor(source: unknown, init: unknown) {
    this.source = source;
    this.init = init;
  }
}

function stubCanvas(context: object | null): { made: { width: number; height: number }[] } {
  const made: { width: number; height: number }[] = [];
  class StubCanvas {
    public constructor(width: number, height: number) {
      made.push({ width, height });
    }

    public getContext(): object | null {
      return context;
    }
  }
  vi.stubGlobal('OffscreenCanvas', StubCanvas);
  vi.stubGlobal('VideoFrame', StubFrame);
  return { made };
}

const context = {
  setTransform: vi.fn(),
  fillRect: vi.fn(),
  drawImage: vi.fn(),
  getImageData: (...rect: number[]): { data: Uint8ClampedArray } => ({
    data: new Uint8ClampedArray((rect[2] ?? 0) * (rect[3] ?? 0) * 4),
  }),
};
const close = vi.fn();
const fields = {
  displayWidth: 960,
  displayHeight: 540,
  timestamp: 40,
  duration: 20,
  close,
};
const frame = fields as unknown as VideoFrame;

describe('browserPlatform', () => {
  it('reads a frame size and time as shown, and closes it', () => {
    const platform = browserPlatform();
    expect(platform.size(frame)).toEqual({ width: 960, height: 540 });
    expect(platform.timestamp(frame)).toBe(40);
    platform.close(frame);
    expect(close).toHaveBeenCalled();
  });

  it('draws thumbnails at 480 pixels and frames at their size, one canvas per size', async () => {
    const { made } = stubCanvas(context);
    const platform = browserPlatform();
    const gray = await platform.thumbnail(frame);
    expect(gray).toMatchObject({ width: 480, height: 270 });
    await platform.thumbnail(frame);
    const out = (await platform.render(
      frame,
      similarity({ angle: 0, scale: 1, tx: 0, ty: 0 }),
    )) as unknown as StubFrame;
    expect(made).toEqual([
      { width: 480, height: 270 },
      { width: 960, height: 540 },
    ]);
    expect(out.init).toEqual({ timestamp: 40, duration: 20 });
  });

  it('keeps no duration a frame does not have', async () => {
    stubCanvas(context);
    const out = (await browserPlatform().render(
      { ...fields, duration: null } as unknown as VideoFrame,
      similarity({ angle: 0, scale: 1, tx: 0, ty: 0 }),
    )) as unknown as StubFrame;
    expect(out.init).toEqual({ timestamp: 40 });
  });

  it('fails with canvas-unavailable without OffscreenCanvas or a 2D context', () => {
    vi.stubGlobal('OffscreenCanvas', undefined);
    expect(() => browserPlatform().thumbnail(frame)).toThrow(WebsteadyError);
    stubCanvas(null);
    expect(() => browserPlatform().thumbnail(frame)).toThrow('no 2D canvas context');
  });
});

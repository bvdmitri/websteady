import { grayFromRgba, type GrayImage, type Similarity, type Size } from '@websteady/core';

/** A 2D canvas and its context: `OffscreenCanvas` in the browser, a stand-in in tests. */
export interface Canvas2D {
  readonly canvas: OffscreenCanvas;
  readonly context: OffscreenCanvasRenderingContext2D;
}

/** Makes a 2D canvas of a size. */
export type CanvasMaker = (size: Size) => Canvas2D;

/** The long side, in pixels, frames are analysed at: enough detail, little work. */
export const THUMBNAIL_SIDE = 480;

/** `size` scaled so its long side is at most `longSide`, never enlarged, whole pixels. */
export function thumbnailSize(size: Size, longSide: number): Size {
  const scale = Math.min(1, longSide / Math.max(size.width, size.height));
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}

/**
 * A similarity as `setTransform(a, b, c, d, e, f)` takes it: the matrix column by column, for
 * `x' = a x + c y + e`, `y' = b x + d y + f`.
 */
export function canvasMatrix(
  s: Similarity,
): readonly [number, number, number, number, number, number] {
  return [s.a, s.b, -s.b, s.a, s.tx, s.ty];
}

/** How to draw a thumbnail: the canvas maker, and the long side to draw at. */
export interface ThumbnailOptions {
  readonly make: CanvasMaker;
  readonly longSide: number;
}

/** `source` of `size` drawn small (long side at most `longSide`) and read back as a grey image. */
export function drawThumbnail(
  source: CanvasImageSource,
  size: Size,
  options: ThumbnailOptions,
): GrayImage {
  const small = thumbnailSize(size, options.longSide);
  const { context } = options.make(small);
  context.drawImage(source, 0, 0, small.width, small.height);
  const pixels = context.getImageData(0, 0, small.width, small.height).data;
  return grayFromRgba(pixels, small);
}

/** How to draw a stabilized frame: the canvas maker, and the transform from source pixels. */
export interface TransformedOptions {
  readonly make: CanvasMaker;
  readonly transform: Similarity;
}

/**
 * A canvas of `size` with `source` drawn through `transform`, over black where the transform
 * leaves the frame (a plan's crop keeps that out of view).
 */
export function drawTransformed(
  source: CanvasImageSource,
  size: Size,
  options: TransformedOptions,
): OffscreenCanvas {
  const { canvas, context } = options.make(size);
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.fillStyle = 'black';
  context.fillRect(0, 0, size.width, size.height);
  context.setTransform(...canvasMatrix(options.transform));
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, size.width, size.height);
  return canvas;
}

/**
 * The number at `index`, or 0 past the end: how the core reads pixels and samples, so an index
 * computed at an image's edge never yields `undefined`.
 */
export function valueAt(values: ArrayLike<number>, index: number): number {
  return values[index] ?? 0;
}

/**
 * The pixel at `index` of an image's data, or 0 past the end. A separate function from
 * {@link valueAt}, so the engine keeps it specialized to `Float32Array` in the per-pixel loops.
 */
export function pixelAt(data: Float32Array, index: number): number {
  return data[index] ?? 0;
}

/** The byte at `index` of RGBA data, or 0 past the end; specialized like {@link pixelAt}. */
export function byteAt(data: Uint8ClampedArray, index: number): number {
  return data[index] ?? 0;
}

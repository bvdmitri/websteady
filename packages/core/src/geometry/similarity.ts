/** A point in pixels: `x` to the right, `y` down, as images and canvases lay them out. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * A similarity transform: a turn and a uniform scale about the origin, then a move. It maps
 * `(x, y)` to `(a x - b y + tx, b x + a y + ty)`, where `a = scale cos(angle)` and
 * `b = scale sin(angle)`.
 *
 * @remarks Four numbers describe the camera's shake between frames well: pan and tilt move the
 * picture, roll turns it, a push in or out scales it. Kept as `a, b, tx, ty` so composing and
 * fitting stay linear.
 */
export interface Similarity {
  readonly a: number;
  readonly b: number;
  readonly tx: number;
  readonly ty: number;
}

/** A similarity's readable parts: `angle` in radians (clockwise on screen), `scale`, the move. */
export interface SimilarityParts {
  readonly angle: number;
  readonly scale: number;
  readonly tx: number;
  readonly ty: number;
}

/** The transform that leaves every point where it is. */
export const IDENTITY: Similarity = { a: 1, b: 0, tx: 0, ty: 0 };

/** The similarity of `parts`; throws a `RangeError` for a scale that is not positive. */
export function similarity(parts: SimilarityParts): Similarity {
  if (!(parts.scale > 0)) throw new RangeError(`scale must be positive, got ${parts.scale}`);
  const { angle, scale, tx, ty } = parts;
  return { a: scale * Math.cos(angle), b: scale * Math.sin(angle), tx, ty };
}

/** The angle, scale and move of `s`. */
export function parts(s: Similarity): SimilarityParts {
  return { angle: Math.atan2(s.b, s.a), scale: Math.hypot(s.a, s.b), tx: s.tx, ty: s.ty };
}

/** Where `s` takes point `p`. */
export function apply(s: Similarity, p: Point): Point {
  return { x: s.a * p.x - s.b * p.y + s.tx, y: s.b * p.x + s.a * p.y + s.ty };
}

/** `outer` after `inner`: the transform that applies `inner` first. */
export function compose(outer: Similarity, inner: Similarity): Similarity {
  const moved = apply(outer, { x: inner.tx, y: inner.ty });
  return {
    a: outer.a * inner.a - outer.b * inner.b,
    b: outer.a * inner.b + outer.b * inner.a,
    tx: moved.x,
    ty: moved.y,
  };
}

/** The transform that undoes `s`. */
export function invert(s: Similarity): Similarity {
  const norm = s.a * s.a + s.b * s.b;
  const turn = { a: s.a / norm, b: -s.b / norm, tx: 0, ty: 0 };
  const back = apply(turn, { x: s.tx, y: s.ty });
  return { ...turn, tx: -back.x, ty: -back.y };
}

/**
 * `s` as the six numbers of a 2x3 matrix, row by row: `[a, -b, tx, b, a, ty]`.
 *
 * @remarks Canvas `setTransform(a, b, c, d, e, f)` takes them column by column; the canvas adapter
 * reorders them.
 */
export function toMatrix(s: Similarity): readonly number[] {
  return [s.a, -s.b, s.tx, s.b, s.a, s.ty];
}

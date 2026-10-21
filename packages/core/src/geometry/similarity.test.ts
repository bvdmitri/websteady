import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { arbitrarySimilarity } from '../testing/arbitraries';
import {
  apply,
  compose,
  IDENTITY,
  invert,
  parts,
  similarity,
  toMatrix,
  type Point,
  type Similarity,
} from './similarity';

const arbitraryPoint = fc.record({
  x: fc.double({ min: -500, max: 500, noNaN: true }),
  y: fc.double({ min: -500, max: 500, noNaN: true }),
});

const close = (a: Point, b: Point): void => {
  expect(a.x).toBeCloseTo(b.x, 6);
  expect(a.y).toBeCloseTo(b.y, 6);
};

describe('similarity', () => {
  it('turns, scales and then moves a point', () => {
    const quarter = similarity({ angle: Math.PI / 2, scale: 2, tx: 10, ty: 0 });
    close(apply(quarter, { x: 1, y: 0 }), { x: 10, y: 2 });
    expect(apply(IDENTITY, { x: 3, y: 4 })).toEqual({ x: 3, y: 4 });
  });

  it('reads back the parts it was made from', () => {
    const made = similarity({ angle: 0.3, scale: 1.1, tx: -4, ty: 7 });
    const back = parts(made);
    expect(back.angle).toBeCloseTo(0.3, 12);
    expect(back.scale).toBeCloseTo(1.1, 12);
    expect([back.tx, back.ty]).toEqual([-4, 7]);
  });

  it('composes so that the inner transform applies first', () => {
    fc.assert(
      fc.property(arbitrarySimilarity, arbitrarySimilarity, arbitraryPoint, (outer, inner, p) => {
        close(apply(compose(outer, inner), p), apply(outer, apply(inner, p)));
      }),
    );
  });

  it('is undone by its inverse', () => {
    fc.assert(
      fc.property(arbitrarySimilarity, arbitraryPoint, (s: Similarity, p) => {
        const back = invert(s);
        close(apply(compose(back, s), p), p);
        close(apply(compose(s, back), p), p);
      }),
    );
  });

  it('is a 2x3 matrix row by row, as a canvas transform takes it', () => {
    const s = similarity({ angle: 0, scale: 2, tx: 3, ty: 4 });
    expect(toMatrix(s)).toEqual([2, -0, 3, 0, 2, 4]);
  });

  it('refuses a scale that is not positive', () => {
    expect(() => similarity({ angle: 0, scale: 0, tx: 0, ty: 0 })).toThrow(
      'scale must be positive, got 0',
    );
  });
});

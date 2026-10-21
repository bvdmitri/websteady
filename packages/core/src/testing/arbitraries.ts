// fast-check generators shared by the core's property tests.
import fc from 'fast-check';

import { similarity, type Similarity } from '../geometry/similarity';

/** A camera shake between two frames: a small turn, a small push, a move of tens of pixels. */
export const arbitrarySimilarity: fc.Arbitrary<Similarity> = fc
  .record({
    angle: fc.double({ min: -0.5, max: 0.5, noNaN: true }),
    scale: fc.double({ min: 0.8, max: 1.25, noNaN: true }),
    tx: fc.double({ min: -50, max: 50, noNaN: true }),
    ty: fc.double({ min: -50, max: 50, noNaN: true }),
  })
  .map((p) => similarity(p));

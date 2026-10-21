const GOLDEN = 0x9e_37_79_b9;
const MIX_A = 0x85_eb_ca_6b;
const MIX_B = 0xc2_b2_ae_35;
const SHIFT_A = 16;
const SHIFT_B = 13;
const TWO_TO_32 = 4_294_967_296;

// The value as a 32-bit signed integer, wrapped as integer arithmetic wraps it.
const int32 = (value: number): number => Math.imul(value, 1);

/**
 * A seeded source of numbers in 0..1, so a robust fit gives the same answer every run.
 *
 * @remarks A 32-bit counter hashed by the murmur3 finaliser: fast, uniform enough for choosing
 * samples, and not for anything cryptographic.
 */
export function seededRandom(seed: number): () => number {
  let state = int32(seed);
  return () => {
    state = int32(state + GOLDEN);
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> SHIFT_A), MIX_A);
    mixed = Math.imul(mixed ^ (mixed >>> SHIFT_B), MIX_B);
    mixed ^= mixed >>> SHIFT_A;
    return (mixed >>> 0) / TWO_TO_32;
  };
}

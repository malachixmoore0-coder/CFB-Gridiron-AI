/**
 * Small deterministic PRNG (mulberry32) plus a Box-Muller normal sampler.
 * Deterministic so the same matchup + injuries + seed always simulates the
 * same 10,000 games; a "re-roll" simply picks a new seed.
 */
export interface Rng {
  next(): number;        // uniform [0,1)
  normal(mean: number, sd: number): number;
  seed: number;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let spare: number | null = null;
  const normal = (mean: number, sd: number) => {
    if (spare !== null) {
      const v = spare;
      spare = null;
      return mean + sd * v;
    }
    let u = 0;
    let v = 0;
    while (u === 0) u = next();
    while (v === 0) v = next();
    const mag = Math.sqrt(-2.0 * Math.log(u));
    const z0 = mag * Math.cos(2 * Math.PI * v);
    spare = mag * Math.sin(2 * Math.PI * v);
    return mean + sd * z0;
  };
  return { next, normal, seed };
}

/** Stable 32-bit hash of a string (FNV-1a) — used to derive seeds from matchup keys. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

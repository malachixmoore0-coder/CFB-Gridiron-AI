export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const sd = (xs: number[]) => {
  if (xs.length < 2) return 1;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1)) || 1;
};
export const num = (s: string | undefined | null): number => {
  if (s === undefined || s === null) return NaN;
  const v = Number(s);
  return s === '' || s === 'NA' || Number.isNaN(v) ? NaN : v;
};
export const bool = (s: string | undefined) => s === 'TRUE' || s === 'true' || s === '1';
export const r1 = (v: number) => Math.round(v * 10) / 10;
export const r2 = (v: number) => Math.round(v * 100) / 100;
export const r3 = (v: number) => Math.round(v * 1000) / 1000;

/**
 * Convert one team's metric into a 1-10 rating relative to the league:
 * 5.5 is average, each standard deviation is worth `spread` points.
 */
export function rateAmong(value: number, league: number[], opts: { invert?: boolean; spread?: number } = {}): number {
  const valid = league.filter((x) => Number.isFinite(x));
  if (!Number.isFinite(value) || valid.length < 4) return 5.5;
  const z = (value - mean(valid)) / sd(valid);
  const signed = opts.invert ? -z : z;
  return clamp(r1(5.5 + signed * (opts.spread ?? 1.6)), 1, 10);
}

/** Percentile (0-100) of a value within a population; 50 when unknown. */
export function percentile(value: number, pop: number[]): number {
  const valid = pop.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!Number.isFinite(value) || valid.length < 3) return 50;
  let below = 0;
  for (const x of valid) { if (x < value) below++; else break; }
  return (below / valid.length) * 100;
}

/** Shrink a noisy per-team estimate toward the league mean by sample size. */
export function shrink(value: number, leagueMean: number, n: number, k: number): number {
  if (!Number.isFinite(value)) return leagueMean;
  const w = n / (n + k);
  return w * value + (1 - w) * leagueMean;
}

/** Loose name key for matching players across feeds ("De'Von Achane Jr." → "devon achane"). */
export const nameKey = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, '').replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();

/** Run async jobs with bounded concurrency, preserving order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

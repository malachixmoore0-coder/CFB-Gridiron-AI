import type { SimulationSummary } from './types';
import { createRng } from './rng';
import { SCORE_SD } from './weights';
import { round } from './math';

export interface SimParams {
  expectedHome: number;
  expectedAway: number;
  varianceMultiplier: number;
  runs: number;
  seed: number;
  /** Home team's edge in win-prob terms used to break OT (positive favours home). */
  modelMargin: number;
}

export interface SimDetail extends SimulationSummary {
  homeLeadsAtHalfPct: number;
  /** Games within one score entering the 4th quarter. */
  clutchPct: number;
  /** Home's win rate when trailing at half. */
  homeComebackPct: number;
  /** Away's win rate when trailing at half. */
  awayComebackPct: number;
}

/** Histogram bins: 5-point buckets from -40 to +40 (home minus away). */
export const BIN_WIDTH = 5;
export const BIN_MAX = 40;

/** Nudge a raw score onto the lattice of scores football actually produces. */
function footballScore(x: number): number {
  const s = Math.max(0, Math.round(x));
  if (s === 1) return 0;
  if (s === 2 || s === 4 || s === 5) return 3;
  if (s === 8) return 7;
  if (s === 11) return 10;
  return s;
}

export function simulate(p: SimParams): SimDetail {
  const rng = createRng(p.seed);
  const sd = SCORE_SD * p.varianceMultiplier;
  const halfSd = sd * 0.72;

  let homeWins = 0;
  let awayWins = 0;
  let overtimes = 0;
  let totalHome = 0;
  let totalAway = 0;
  let oneScore = 0;
  let clutch = 0;
  let homeLeadsHalf = 0;
  let homeTrailHalf = 0;
  let homeComebacks = 0;
  let awayTrailHalf = 0;
  let awayComebacks = 0;
  let homeCovers = 0;
  let overs = 0;
  const margins: number[] = [];
  const scoreCounts = new Map<string, number>();

  const modelTotal = p.expectedHome + p.expectedAway;
  const line = Math.round((p.expectedAway - p.expectedHome) * 2) / 2; // away - home, negative = home favoured
  const totalLine = Math.round(modelTotal * 2) / 2;
  const otHomeProb = 0.5 + Math.tanh(p.modelMargin / 14) * 0.18;

  for (let i = 0; i < p.runs; i++) {
    // Shared pace/environment shock keeps team scores mildly correlated.
    const common = rng.normal(0, 2.6);
    // First half + second half sampled separately so we get a halftime picture.
    const h1 = rng.normal(p.expectedHome / 2, halfSd) + common / 2;
    const a1 = rng.normal(p.expectedAway / 2, halfSd) + common / 2;
    const h2 = rng.normal(p.expectedHome / 2, halfSd) + common / 2;
    const a2 = rng.normal(p.expectedAway / 2, halfSd) + common / 2;

    const hHalf = footballScore(h1);
    const aHalf = footballScore(a1);
    let h = footballScore(hHalf + h2);
    let a = footballScore(aHalf + a2);

    // Approximate the score entering the 4th: 3/4 of the game's points.
    const q3Margin = (hHalf + h2 * 0.5) - (aHalf + a2 * 0.5);
    if (Math.abs(q3Margin) <= 8) clutch++;

    if (h === a) {
      // College overtime always produces a winner: alternating possessions from
      // the 25, two-point tries from the third period on. Model the decisive
      // swing as a field goal (3), a touchdown (7) or a two-point shootout (2).
      overtimes++;
      const u = rng.next();
      const swing = u < 0.5 ? 3 : u < 0.82 ? 7 : 2;
      if (rng.next() < otHomeProb) h += swing; else a += swing;
    }

    totalHome += h;
    totalAway += a;
    const margin = h - a;
    margins.push(margin);
    if (margin > 0) homeWins++; else awayWins++;
    if (Math.abs(margin) <= 8 && margin !== 0) oneScore++;
    if (margin + line > 0) homeCovers++; // home covers when margin beats the spread
    if (h + a > totalLine) overs++;

    if (hHalf > aHalf) homeLeadsHalf++;
    if (hHalf < aHalf) { homeTrailHalf++; if (margin > 0) homeComebacks++; }
    if (aHalf < hHalf) { awayTrailHalf++; if (margin < 0) awayComebacks++; }

    const key = `${h}-${a}`;
    scoreCounts.set(key, (scoreCounts.get(key) ?? 0) + 1);
  }

  const n = p.runs;
  const meanMargin = margins.reduce((s, m) => s + m, 0) / n;
  const variance = margins.reduce((s, m) => s + (m - meanMargin) ** 2, 0) / n;

  // 5-point margin bins from -40 to +40 (the outer bins absorb the tails).
  const bins: SimulationSummary['marginBins'] = [];
  for (let from = -BIN_MAX; from < BIN_MAX; from += BIN_WIDTH) {
    const to = from + BIN_WIDTH;
    const count = margins.filter((m) => (from === -BIN_MAX ? m < to : to === BIN_MAX ? m >= from : m >= from && m < to)).length;
    bins.push({ from, to, pct: round((count / n) * 100, 1) });
  }

  const mostLikelyScores = [...scoreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, c]) => {
      const [hs, as] = k.split('-').map(Number);
      return { home: hs, away: as, pct: round((c / n) * 100, 1) };
    });

  return {
    runs: n,
    homeWinPct: round((homeWins / n) * 100, 1),
    awayWinPct: round((awayWins / n) * 100, 1),
    tiePct: 0,
    projectedHome: round(totalHome / n, 1),
    projectedAway: round(totalAway / n, 1),
    projectedTotal: round((totalHome + totalAway) / n, 1),
    spread: line,
    volatility: round(Math.sqrt(variance), 1),
    oneScoreGamePct: round((oneScore / n) * 100, 1),
    homeCoverPct: round((homeCovers / n) * 100, 1),
    overPct: round((overs / n) * 100, 1),
    overtimePct: round((overtimes / n) * 100, 1),
    marginBins: bins,
    mostLikelyScores,
    homeLeadsAtHalfPct: round((homeLeadsHalf / n) * 100, 1),
    clutchPct: round((clutch / n) * 100, 1),
    homeComebackPct: homeTrailHalf ? round((homeComebacks / homeTrailHalf) * 100, 1) : 0,
    awayComebackPct: awayTrailHalf ? round((awayComebacks / awayTrailHalf) * 100, 1) : 0,
  };
}

import type { NodeWeights, Position } from './types';

export const DEFAULT_WEIGHTS: NodeWeights = {
  scheme: 25,
  personnel: 35,
  environment: 15,
  xfactor: 25,
};

/** Normalise partial/edited weights so they always sum to 100. */
export function normalizeWeights(w?: Partial<NodeWeights>): NodeWeights {
  const merged = { ...DEFAULT_WEIGHTS, ...(w ?? {}) };
  const total = merged.scheme + merged.personnel + merged.environment + merged.xfactor;
  if (total <= 0) return { ...DEFAULT_WEIGHTS };
  const k = 100 / total;
  return {
    scheme: merged.scheme * k,
    personnel: merged.personnel * k,
    environment: merged.environment * k,
    xfactor: merged.xfactor * k,
  };
}

/**
 * Points of margin one full "edge unit" is worth once the four nodes are
 * blended. College spreads run far wider than the NFL's (a 30-point line is
 * routine in September), so an edge unit buys more margin here than in the
 * NFL engine's 2.0.
 */
export const POINTS_PER_EDGE_UNIT = 3.5;

/** FBS-average expected points per team per game. */
export const LEAGUE_AVG_POINTS = 28.5;

/** Standard deviation of a single team's score around its expectation. */
export const SCORE_SD = 12.5;

/** Extra margin variance in conference / rivalry games (multiplier on SD). */
export const RIVALRY_VARIANCE = 1.1;

/** Widest pre-simulation margin the model will project (points). */
export const MAX_MODEL_MARGIN = 45;

/**
 * Mismatch convexity: once the program-strength gap passes this many rating
 * points the blow-out snowballs (depth, tempo, garbage-time scoring), so the
 * margin grows faster than the linear node blend suggests.
 */
export const TALENT_GAP_KNEE = 2.0;
export const TALENT_GAP_POINTS = 1.3;

/** Offensive plays per game that counts as neutral pace in FBS. */
export const NEUTRAL_PACE = 70;

/**
 * Injury degradation metrics — how much a starter's absence costs in the unit
 * they play in. `winEff` is the win-probability (percentage points) swing of
 * losing the starter for a backup at that position; `label` is what the UI
 * shows. College depth drops off faster than the NFL's, so the quarterback
 * and left-tackle hits are a touch larger than the pro version.
 */
export const INJURY_DEGRADATION: Record<Position, { winEff: number; label: string }> = {
  QB:   { winEff: 20, label: '-20% win efficiency (backup QB)' },
  LT:   { winEff: 12, label: '-12% pass protection' },
  OL:   { winEff: 5,  label: '-5% pass protection' },
  WR:   { winEff: 7,  label: '-7% passing efficiency' },
  TE:   { winEff: 4,  label: '-4% red-zone efficiency' },
  RB:   { winEff: 5,  label: '-5% rushing efficiency' },
  EDGE: { winEff: 8,  label: '-8% pass-rush win rate' },
  DT:   { winEff: 5,  label: '-5% run-stop rate' },
  LB:   { winEff: 4,  label: '-4% coverage vs TE/RB' },
  CB:   { winEff: 7,  label: '-7% coverage efficiency' },
  NCB:  { winEff: 5,  label: '-5% slot coverage' },
  S:    { winEff: 4,  label: '-4% deep coverage' },
  K:    { winEff: 2,  label: '-2% expected points on kicks' },
};

/**
 * Roughly how many points of margin one win-probability point is worth near
 * 50/50. Margins are more dispersed in college (σ ≈ 17), so a point of win
 * probability buys more spread than in the NFL.
 */
export const POINTS_PER_WIN_PCT = 0.42;

/**
 * Home-field advantage bounds (win-probability points). College crowds are
 * worth roughly 2.5-3 points of margin, about double the modern NFL figure.
 */
export const HFA_MIN = 4.0;
export const HFA_MAX = 8.0;
export const HFA_DEFAULT = 6.0;

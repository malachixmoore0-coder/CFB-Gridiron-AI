import type { Team } from '../../src/engine/types';
import type { GameRow, RosterRow } from '../sources/cfbfastr';
import type { PbpAgg } from '../sources/sdvpbp';
import type { DepthRow, EspnInjury } from '../sources/espn';

export interface BuildCtx {
  season: number;
  priorSeason: number;
  today: Date;
  games: GameRow[];
  cur: PbpAgg | null;
  prior: PbpAgg | null;
  rosters: RosterRow[];
  /** ESPN depth charts keyed by ESPN team id (empty when the endpoint was unavailable). */
  depth: Map<number, DepthRow[]>;
  espnInjuries: EspnInjury[];
  /** Latest Elo per ESPN team id. */
  elo: Map<number, number>;
  ranks: Map<number, number>;
  /** Curated baseline: colours, stadiums, coverage families, fallbacks. */
  baseline: Team[];
  notes: string[];
}

export const gamesPlayed = (agg: PbpAgg | null, espnId: number) => agg?.teams.get(espnId)?.games.size ?? 0;
/** Weight on the current season vs the prior season for a team. Rosters churn hard in college, so converge faster than the NFL's k = 6. */
export const blendWeight = (gp: number) => gp / (gp + 4);
/** Weight on the Elo-derived program strength vs measured unit metrics (heavier early, when the metrics are last year's roster). */
export const talentWeight = (gp: number) => 0.12 + 0.33 * (1 - blendWeight(gp));

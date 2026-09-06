/** Shapes shared by the data pipeline (writer) and the app (reader). */
import type { Team, Weather } from '@/engine/types';

export interface GameWeather { tempF: number; windMph: number; precipPct: number; snowIn: number; summary: Weather; }

export interface LiveGame {
  id: string;
  season: number;
  week: number;
  /** 'regular' | 'postseason'. */
  gameType: string;
  kickoff: string;
  /** True when the schedule only has a date, not a kickoff time. */
  timeTbd: boolean;
  weekday: string;
  awayId: string;
  homeId: string;
  neutralSite: boolean;
  conferenceGame: boolean;
  stadium: string;
  roof: string;
  /** Home team's line as a sportsbook shows it: -3.5 = home favoured by 3.5. */
  homeSpread: number | null;
  totalLine: number | null;
  awayMoneyline: number | null;
  homeMoneyline: number | null;
  /** Where the line came from, e.g. "ESPN BET". */
  lineSource: string | null;
  primetime: boolean;
  /** TV network when known. */
  broadcast: string | null;
  /** Bowl / event name when the schedule carries one. */
  notes: string | null;
  weather: (GameWeather & { source: 'forecast' | 'observed' }) | null;
  weatherHint: Weather | null;
  awayScore: number | null;
  homeScore: number | null;
  status: 'scheduled' | 'final';
  /** AP ranks at build time, when ranked. */
  awayRank: number | null;
  homeRank: number | null;
}

export type Phase = 'preseason' | 'regular' | 'postseason' | 'offseason';

export interface LiveTeamsFile { generatedAt: string; season: number; week: number; phase: Phase; teams: Team[]; }
export interface LiveScheduleFile { generatedAt: string; season: number; week: number; phase: Phase; games: LiveGame[]; }
export interface LiveMetaFile {
  generatedAt: string;
  season: number;
  priorSeason: number;
  currentWeek: number;
  phase: Phase;
  depthChartsAsOf: string | null;
  /** Name of the poll used for `rank`, when one loaded. */
  poll: string | null;
  blend: { description: string; gamesPlayedMin: number; gamesPlayedMax: number; currentWeightMin: number; currentWeightMax: number };
  proxies: Record<string, string>;
  sources: { name: string; url: string; ok: boolean; fetchedAt: string; note?: string }[];
  notes: string[];
}

/** Grading of a locked prediction once the final score is in. */
export interface PredictionResult {
  homeScore: number;
  awayScore: number;
  winner: 'home' | 'away';
  /** Did the model's favourite win? */
  suCorrect: boolean;
  /** Side the model liked against the market spread (null = no meaningful disagreement or no line). */
  atsPick: 'home' | 'away' | null;
  ats: 'win' | 'loss' | 'push' | null;
  ouPick: 'over' | 'under' | null;
  ou: 'win' | 'loss' | 'push' | null;
  /** Actual margin (home − away) minus the model's projected margin. */
  spreadError: number;
  totalError: number;
  /** Brier score of the home win probability, 0 (perfect) – 1. */
  brier: number;
}

/**
 * One model prediction for a scheduled game. Rewritten on every data refresh
 * until kickoff, then frozen; graded when the final score arrives.
 */
export interface PredictionRecord {
  id: string;
  season: number;
  week: number;
  gameType: string;
  kickoff: string;
  awayId: string;
  homeId: string;
  neutralSite: boolean;
  homeWinPct: number;
  awayWinPct: number;
  projectedHome: number;
  projectedAway: number;
  /** Model line, away − home (negative = home favoured). */
  spread: number;
  total: number;
  /** Market at the time of the (last) prediction. */
  marketHomeSpread: number | null;
  marketTotal: number | null;
  /** ISO time the prediction was last recomputed. */
  predictedAt: string;
  /** How many refreshes produced this record. */
  updates: number;
  status: 'open' | 'locked' | 'final';
  lockedAt: string | null;
  result: PredictionResult | null;
}

export interface LivePredictionsFile {
  generatedAt: string;
  season: number;
  /** Model settings the predictions were made with. */
  model: { weights: { scheme: number; personnel: number; environment: number; xfactor: number }; simulations: number; homeFieldBase: number };
  records: PredictionRecord[];
}

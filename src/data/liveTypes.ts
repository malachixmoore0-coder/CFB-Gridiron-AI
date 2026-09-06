/** Shapes shared by the data pipeline (writer) and the app (reader). */
import type { InjuryStatus, Team, Weather } from '@/engine/types';

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
  status: GameStatus;
  /** Live clock when a game is under way, e.g. "Q3 8:24" or "Halftime". */
  statusDetail: string | null;
  /** AP ranks at build time, when ranked. */
  awayRank: number | null;
  homeRank: number | null;
}

export type Phase = 'preseason' | 'regular' | 'postseason' | 'offseason';
/** A game the feed knows about is either still to come, under way, or done. */
export type GameStatus = 'scheduled' | 'in_progress' | 'final';

export interface LiveTeamsFile { generatedAt: string; season: number; week: number; phase: Phase; teams: Team[]; }
export interface LiveScheduleFile {
  generatedAt: string;
  season: number;
  /** The week the slate opens on. */
  week: number;
  phase: Phase;
  /** Every week the season has games for, in order — drives the Slate's week tabs. */
  weeks?: { week: number; gameType: string; label: string; games: number; final: number; live: number; start: string }[];
  games: LiveGame[];
}
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

/* ------------------------------------------------------------------ */
/* Per-team roster files: data/live/rosters/{teamId}.json               */
/* ------------------------------------------------------------------ */

/**
 * Box-score line for one game (or a season total). Zero counters are omitted
 * from the published file to keep it small — read a missing field as 0 (use
 * `stat()` in src/utils/roster.ts).
 */
export interface StatLine {
  passAtt?: number; passCmp?: number; passYds?: number; passTd?: number; passInt?: number;
  rushAtt?: number; rushYds?: number; rushTd?: number;
  tgt?: number; rec?: number; recYds?: number; recTd?: number;
  sacks?: number; int?: number; pbu?: number; ff?: number; fgm?: number; fga?: number;
  /** Total expected points added on the player's plays. */
  epa?: number;
}

export interface PlayerGameLog {
  gameId: string;
  week: number;
  date: string;
  /** Opponent team id (slug) or display name when the opponent is outside the dataset. */
  oppId: string | null;
  oppName: string;
  home: boolean;
  result: 'W' | 'L' | null;
  teamScore: number | null;
  oppScore: number | null;
  stats: StatLine;
}

export interface PlayerTrait { label: string; value: string; percentile: number; }

export type RosterPositionLabel = 'QB' | 'RB' | 'WR' | 'TE' | 'OL' | 'EDGE' | 'DT' | 'LB' | 'CB' | 'NCB' | 'S' | 'K' | 'P' | 'LS';

export interface RosterPlayer {
  /** Same id the engine depth chart uses: `${teamId}-${athleteId}`. */
  id: string;
  athleteId: string;
  name: string;
  jersey: string | null;
  /** Engine-style position group. */
  pos: RosterPositionLabel;
  /** Position exactly as the roster lists it (OT, NT, DB…). */
  listedPos: string;
  unit: 'offense' | 'defense' | 'special';
  /** Depth within the position group: 1 = first string. */
  string: number;
  /** Rank inside the position pool (1 = top). */
  rank: number;
  /** On the engine depth chart? Which role? */
  role: 'starter' | 'rotational' | 'depth' | 'reserve';
  /** Overall grade 1-100 (null when nothing measurable yet). */
  rating: number | null;
  ratingBasis: 'production' | 'roster';
  headshotUrl: string | null;
  height: string | null;
  weight: number | null;
  /** College: eligibility year 1-5. Pro: seasons of experience. */
  classYear: number | null;
  classLabel: string | null;
  hometown: string | null;
  college?: string | null;
  age?: number | null;
  reported?: InjuryStatus;
  reportNote?: string;
  usage: { snapPct: number; targetShare?: number; tprr?: number; prwr?: number; pbwr?: number };
  strengths: PlayerTrait[];
  weaknesses: PlayerTrait[];
  /** Current-season totals (this team only) and games played. */
  season: StatLine & { games: number };
  /** Prior-season totals (any team) when the player has any. */
  prior: (StatLine & { games: number }) | null;
  games: PlayerGameLog[];
  statLine: string | null;
}

export interface TeamScheduleGame {
  id: string;
  week: number;
  gameType: string;
  date: string;
  oppId: string | null;
  oppName: string;
  home: boolean;
  neutral: boolean;
  status: 'scheduled' | 'final';
  teamScore: number | null;
  oppScore: number | null;
  result: 'W' | 'L' | null;
  notes: string | null;
}

export interface TeamRosterFile {
  teamId: string;
  generatedAt: string;
  season: number;
  record: string;
  schedule: TeamScheduleGame[];
  /** Next unplayed game, if any. */
  nextGameId: string | null;
  roster: RosterPlayer[];
  /** How many players each position keeps on the first string (for the depth-chart sections). */
  stringSizes: Record<RosterPositionLabel, number>;
  /**
   * When set, a player's headshot is `${headshotBase}${athleteId}.png` unless
   * he carries an explicit `headshotUrl`. Keeps the file small; the app shows
   * initials when the image 404s.
   */
  headshotBase?: string | null;
}

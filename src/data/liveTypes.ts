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

/**
 * Schedule, market lines, rankings, records and (best-effort) kickoff weather
 * for the current and next week, from the CFBD schedule file with ESPN's
 * scoreboard layered on top.
 */
import type { Team, Weather } from '../../src/engine/types';
import type { GameRow } from '../sources/cfbfastr';
import type { EspnGame } from '../sources/espn';
import type { GameLine, GameResult } from '../sources/sdvpbp';
import { forecastAt } from '../sources/weather';
import { mapLimit } from '../lib/util';
import type { LiveGame, Phase } from '../../src/data/liveTypes';
export type { LiveGame } from '../../src/data/liveTypes';

const n = (v: number | null | undefined) => (v !== null && v !== undefined && Number.isFinite(v) ? v : null);
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const played = (g: GameRow, now: Date) => Number.isFinite(g.home_points) || (g.completed && Date.parse(g.start_date) < now.getTime());

/** Fill in scores the schedule file does not have yet from the play-by-play feed's completed games. */
export function mergeResults(games: GameRow[], results: Map<string, GameResult> | undefined): GameRow[] {
  if (!results) return games;
  return games.map((g) => {
    if (Number.isFinite(g.home_points)) return g;
    const r = results.get(g.game_id);
    if (!r || !r.completed) return g;
    return { ...g, completed: true, home_points: r.homeId === g.home_id ? r.homeScore : r.awayScore, away_points: r.homeId === g.home_id ? r.awayScore : r.homeScore };
  });
}

export function currentWeek(games: GameRow[], season: number, today: Date): { week: number; phase: Phase } {
  const reg = games.filter((g) => g.season === season && g.season_type === 'regular');
  if (!reg.length) return { week: 1, phase: 'offseason' };
  const playedGames = reg.filter((g) => played(g, today));
  // A week is "current" until its last kickoff is five hours old.
  const unplayed = reg.filter((g) => !played(g, today) && Date.parse(g.start_date) > today.getTime() - 5 * 3_600_000);
  if (!unplayed.length) {
    const post = games.filter((g) => g.season === season && g.season_type !== 'regular' && !played(g, today));
    return post.length ? { week: Math.min(...post.map((g) => g.week)), phase: 'postseason' } : { week: Math.max(...reg.map((g) => g.week)), phase: 'offseason' };
  }
  const week = Math.min(...unplayed.map((g) => g.week));
  const firstKick = Math.min(...reg.map((g) => Date.parse(g.start_date)));
  return { week, phase: playedGames.length === 0 && today.getTime() < firstKick ? 'preseason' : 'regular' };
}

export function records(games: GameRow[], season: number): Map<number, string> {
  const w = new Map<number, { w: number; l: number }>();
  for (const g of games) {
    if (g.season !== season || !Number.isFinite(g.home_points) || !Number.isFinite(g.away_points)) continue;
    const h = w.get(g.home_id) ?? { w: 0, l: 0 };
    const a = w.get(g.away_id) ?? { w: 0, l: 0 };
    if (g.home_points > g.away_points) { h.w++; a.l++; } else if (g.home_points < g.away_points) { a.w++; h.l++; }
    w.set(g.home_id, h); w.set(g.away_id, a);
  }
  return new Map([...w].map(([k, v]) => [k, `${v.w}-${v.l}`]));
}

export interface ScheduleInputs {
  games: GameRow[]; season: number; week: number; phase: Phase; teams: Team[]; withWeather: boolean;
  espn: Map<string, EspnGame>; pbpLines: Map<string, GameLine>; ranks: Map<number, number>; today: Date;
}

export async function buildSchedule(inp: ScheduleInputs): Promise<{ games: LiveGame[]; skippedNonFbs: number }> {
  const byEspn = new Map(inp.teams.map((t) => [t.espnId, t]));
  const inWindow = (g: GameRow) => (inp.phase === 'postseason' ? g.season_type !== 'regular' && g.week === inp.week : g.season_type === 'regular' && (g.week === inp.week || g.week === inp.week + 1));
  const rows = inp.games.filter((g) => g.season === inp.season && inWindow(g)).sort((a, b) => a.start_date.localeCompare(b.start_date));
  let skippedNonFbs = 0;
  const out: LiveGame[] = [];
  const prepared = rows.filter((g) => {
    const h = byEspn.has(g.home_id);
    const a = byEspn.has(g.away_id);
    if (h && a) return true;
    if (h || a) skippedNonFbs++; // FBS team vs an FCS opponent; FCS-vs-FCS rows are ignored silently
    return false;
  });
  const built = await mapLimit(prepared, 4, async (g): Promise<LiveGame> => {
    const home = byEspn.get(g.home_id)!;
    const away = byEspn.get(g.away_id)!;
    const e = inp.espn.get(g.game_id);
    const kickoff = e?.kickoff || g.start_date;
    const final = Number.isFinite(g.home_points) && Number.isFinite(g.away_points);
    const neutral = e?.neutralSite ?? g.neutral_site;
    const outdoor = !home.stadium.dome || neutral;
    let weather: LiveGame['weather'] = null;
    if (!final && outdoor && inp.withWeather && !neutral) {
      const f = await forecastAt(home.stadium.lat, home.stadium.lng, kickoff);
      if (f) weather = { ...f, source: 'forecast' };
    }
    const line = inp.pbpLines.get(g.game_id);
    const homeSpread = e?.homeSpread ?? line?.homeSpread ?? null;
    const totalLine = e?.total ?? line?.total ?? null;
    // Local kickoff hour from longitude (no timezone in the feed): primetime = 7pm local or later.
    const localHour = ((new Date(kickoff).getUTCHours() + home.stadium.lng / 15) % 24 + 24) % 24;
    const weekday = WEEKDAY[new Date(kickoff).getUTCDay()];
    return {
      id: g.game_id, season: g.season, week: g.week, gameType: g.season_type, kickoff, timeTbd: g.start_time_tbd, weekday, awayId: away.id, homeId: home.id,
      neutralSite: neutral, conferenceGame: g.conference_game, stadium: e?.venue || g.venue || home.stadium.name, roof: home.stadium.dome && !neutral ? 'dome' : 'outdoors',
      homeSpread: n(homeSpread), totalLine: n(totalLine), awayMoneyline: n(e?.awayMoneyline), homeMoneyline: n(e?.homeMoneyline), lineSource: homeSpread !== null ? (e?.homeSpread !== null && e?.homeSpread !== undefined ? e.provider ?? 'ESPN' : 'ESPN (game feed)') : null,
      primetime: localHour >= 18.75 || (weekday !== 'Saturday' && localHour >= 18),
      broadcast: e?.broadcast ?? null, notes: g.notes || null,
      weather, weatherHint: !outdoor ? 'dome' : weather?.summary ?? null,
      awayScore: n(g.away_points), homeScore: n(g.home_points), status: final ? 'final' : 'scheduled',
      awayRank: e?.awayRank ?? inp.ranks.get(away.espnId) ?? null, homeRank: e?.homeRank ?? inp.ranks.get(home.espnId) ?? null,
    };
  });
  out.push(...built);
  return { games: out, skippedNonFbs };
}

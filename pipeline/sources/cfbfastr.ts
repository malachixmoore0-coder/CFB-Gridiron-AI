/**
 * CollegeFootballData mirrors published by sportsdataverse/cfbfastR-data —
 * public, keyless CSVs refreshed by their automation (schedules and rosters
 * daily in-season). https://github.com/sportsdataverse/cfbfastR-data
 */
import { download, readCsv } from '../lib/fetch';
import { bool, num } from '../lib/util';

const RAW = 'https://raw.githubusercontent.com/sportsdataverse/cfbfastR-data/main';
export const URLS = {
  schedule: (season: number) => `${RAW}/schedules/csv/cfb_schedules_${season}.csv`,
  rosters: (season: number) => `${RAW}/rosters/csv/cfb_rosters_${season}.csv`,
  teamInfo: (season: number) => `${RAW}/team_info/parquet/cfb_team_info_${season}.parquet`,
};

export interface GameRow {
  game_id: string; season: number; week: number; season_type: string; start_date: string; start_time_tbd: boolean; completed: boolean;
  neutral_site: boolean; conference_game: boolean; venue: string;
  home_id: number; home_team: string; home_division: string; home_conference: string; home_points: number; home_pregame_elo: number; home_postgame_elo: number;
  away_id: number; away_team: string; away_division: string; away_conference: string; away_points: number; away_pregame_elo: number; away_postgame_elo: number;
  notes: string;
}

export async function loadSchedule(season: number, optional = false): Promise<GameRow[]> {
  const file = await download(URLS.schedule(season), `CFBD schedule & results ${season} (cfbfastR-data)`, { ttlMinutes: 30, optional });
  if (!file) return [];
  return (await readCsv(file)).map((r) => ({
    game_id: r.game_id, season: num(r.season), week: num(r.week), season_type: r.season_type, start_date: r.start_date, start_time_tbd: bool(r.start_time_tbd), completed: bool(r.completed),
    neutral_site: bool(r.neutral_site), conference_game: bool(r.conference_game), venue: r.venue === 'NA' ? '' : r.venue,
    home_id: num(r.home_id), home_team: r.home_team, home_division: r.home_division, home_conference: r.home_conference, home_points: num(r.home_points), home_pregame_elo: num(r.home_pregame_elo), home_postgame_elo: num(r.home_postgame_elo),
    away_id: num(r.away_id), away_team: r.away_team, away_division: r.away_division, away_conference: r.away_conference, away_points: num(r.away_points), away_pregame_elo: num(r.away_pregame_elo), away_postgame_elo: num(r.away_postgame_elo),
    notes: !r.notes || r.notes === 'NA' ? '' : r.notes,
  }));
}

export interface RosterRow { athlete_id: string; name: string; team: string; position: string; year: number; weight: number; jersey: string; headshot_url: string; }

export async function loadRosters(season: number): Promise<RosterRow[]> {
  const file = await download(URLS.rosters(season), `CFBD rosters ${season} (cfbfastR-data)`, { ttlMinutes: 120, optional: true });
  if (!file) return [];
  return (await readCsv(file))
    .filter((r) => r.athlete_id && r.athlete_id !== 'NA')
    .map((r) => ({
      athlete_id: r.athlete_id, name: `${r.first_name === 'NA' ? '' : r.first_name} ${r.last_name === 'NA' ? '' : r.last_name}`.trim(), team: r.team, position: r.position === 'NA' ? '' : r.position,
      year: num(r.year), weight: num(r.weight), jersey: r.jersey === 'NA' ? '' : r.jersey, headshot_url: r.headshot_url === 'NA' ? '' : r.headshot_url,
    }));
}

/** Latest Elo per CFBD team id from the schedule rows (postgame of the last completed game, else pregame of the next). */
export function latestElo(games: GameRow[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const g of [...games].sort((a, b) => a.start_date.localeCompare(b.start_date))) {
    for (const side of ['home', 'away'] as const) {
      const id = g[`${side}_id`];
      const post = g[`${side}_postgame_elo`];
      const pre = g[`${side}_pregame_elo`];
      if (Number.isFinite(post)) out.set(id, post);
      else if (Number.isFinite(pre) && !out.has(id)) out.set(id, pre);
    }
  }
  return out;
}

/**
 * ESPN college-football play-by-play as processed by the sportsdataverse
 * automation (cfbfastR's EPA / WPA / success models applied to ESPN's feed)
 * and published as parquet under
 * https://github.com/sportsdataverse/sportsdataverse-data/releases/tag/espn_cfb_pbp
 *
 * One file per season, refreshed in-season within hours of games ending.
 * Team ids are ESPN ids (= CollegeFootballData ids); player ids are ESPN
 * athlete ids, which the roster file also carries, so a transfer's history
 * follows him to his new school.
 */
import type { DefensiveFront } from '../../src/engine/types';
import { download } from '../lib/fetch';
import { forEachParquetRow, openParquet, pbool, pnum, pstr } from '../lib/parquet';

export const pbpUrl = (season: number) => `https://github.com/sportsdataverse/sportsdataverse-data/releases/download/espn_cfb_pbp/play_by_play_${season}.parquet`;

export interface HalfSplit { h1: number; h2: number; n1: number; n2: number; }
export interface TeamAcc {
  games: Set<string>;
  // offense
  plays: number; epa: number; success: number; passPlays: number; passEpa: number; rushPlays: number; rushEpa: number; explosive: number;
  earlyDowns: number; earlyPass: number; thirdAtt: number; thirdConv: number; fourthOpp: number; fourthGo: number;
  rzTrips: Set<string>; rzTd: number; dropbacks: number; pressuresAllowed: number; sacksAllowed: number; noHuddle: number;
  shortTgtN: number; shortTgtEpa: number; airYards: number; airN: number; qbRushes: number; offHalf: Map<string, HalfSplit>;
  // defense (what this team allowed / generated)
  dPlays: number; dEpa: number; dPassPlays: number; dPassEpa: number; dRushPlays: number; dRushEpa: number; dExplosive: number;
  dThirdAtt: number; dThirdConv: number; dDropbacks: number; pressures: number; sacks: number; takeaways: number; havoc: number;
  dTeRbTgtN: number; dTeRbTgtEpa: number; dShortWrTgtN: number; dShortWrTgtEpa: number; dRzTrips: Set<string>; dRzTd: number;
  defHalf: Map<string, HalfSplit>;
  // offense EPA split by the opponent's base front
  vsFront: Record<DefensiveFront, { n: number; epa: number }>;
}
/** Box-score style line for one player in one game (all counts, plus total EPA generated). */
export interface GameStat {
  passAtt: number; passCmp: number; passYds: number; passTd: number; passInt: number;
  rushAtt: number; rushYds: number; rushTd: number;
  tgt: number; rec: number; recYds: number; recTd: number;
  sacks: number; int: number; pbu: number; ff: number; fgm: number; fga: number; epa: number;
}
export const emptyGameStat = (): GameStat => ({ passAtt: 0, passCmp: 0, passYds: 0, passTd: 0, passInt: 0, rushAtt: 0, rushYds: 0, rushTd: 0, tgt: 0, rec: 0, recYds: 0, recTd: 0, sacks: 0, int: 0, pbu: 0, ff: 0, fgm: 0, fga: 0, epa: 0 });
export interface PlayerAcc {
  name: string; team: number; games: Set<string>;
  targets: number; rec: number; recYds: number; recEpa: number; rushAtt: number; rushYds: number; rushEpa: number;
  dropbacks: number; passEpa: number; cpoe: number; cpoeN: number; passTd: number; passInt: number;
  sacks: number; ints: number; pbus: number; ffs: number; fgAtt: number; fgMade: number;
  /** Per-game lines keyed by game id (the team the player was on for that game is in `log`). */
  log: Map<string, GameStat & { team: number }>;
}
export interface GameLine { homeSpread: number | null; total: number | null; }
export interface GameResult { homeId: number; awayId: number; homeScore: number; awayScore: number; completed: boolean; week: number; seasonType: number; date: string; }
export interface PbpAgg {
  season: number;
  teams: Map<number, TeamAcc>;
  players: Map<string, PlayerAcc>;
  /** Market line ESPN carried for each game, keyed by game id. */
  lines: Map<string, GameLine>;
  /** Final (or latest) score per game from the last play row — the schedule file can lag by a day. */
  results: Map<string, GameResult>;
  plays: number;
  games: number;
}

const FRONTS: DefensiveFront[] = ['4-2-5', '4-3', '3-3-5', '3-4', 'Multiple'];
const newTeam = (): TeamAcc => ({
  games: new Set(), plays: 0, epa: 0, success: 0, passPlays: 0, passEpa: 0, rushPlays: 0, rushEpa: 0, explosive: 0,
  earlyDowns: 0, earlyPass: 0, thirdAtt: 0, thirdConv: 0, fourthOpp: 0, fourthGo: 0, rzTrips: new Set(), rzTd: 0, dropbacks: 0, pressuresAllowed: 0, sacksAllowed: 0, noHuddle: 0,
  shortTgtN: 0, shortTgtEpa: 0, airYards: 0, airN: 0, qbRushes: 0, offHalf: new Map(),
  dPlays: 0, dEpa: 0, dPassPlays: 0, dPassEpa: 0, dRushPlays: 0, dRushEpa: 0, dExplosive: 0, dThirdAtt: 0, dThirdConv: 0, dDropbacks: 0, pressures: 0, sacks: 0, takeaways: 0, havoc: 0,
  dTeRbTgtN: 0, dTeRbTgtEpa: 0, dShortWrTgtN: 0, dShortWrTgtEpa: 0, dRzTrips: new Set(), dRzTd: 0, defHalf: new Map(),
  vsFront: Object.fromEntries(FRONTS.map((f) => [f, { n: 0, epa: 0 }])) as TeamAcc['vsFront'],
});
const newPlayer = (name: string, team: number): PlayerAcc => ({
  name, team, games: new Set(), targets: 0, rec: 0, recYds: 0, recEpa: 0, rushAtt: 0, rushYds: 0, rushEpa: 0, dropbacks: 0, passEpa: 0, cpoe: 0, cpoeN: 0, passTd: 0, passInt: 0,
  sacks: 0, ints: 0, pbus: 0, ffs: 0, fgAtt: 0, fgMade: 0, log: new Map(),
});

const COLUMNS = [
  'game_id', 'week', 'seasonType', 'pos_team_id', 'def_pos_team_id', 'half', 'period', 'down', 'distance', 'start.yardsToEndzone', 'EPA',
  'rush', 'pass', 'completion', 'pass_attempt', 'target', 'sack', 'int', 'fumble_lost', 'statYardage', 'yds_rushed', 'yds_receiving', 'qb_hurry', 'havoc', 'TFL',
  'air_yards', 'cpoe', 'early_down', 'early_down_pass', 'rz_play', 'touchdown', 'punt', 'fg_attempt', 'fg_made', 'scrimmage_play', 'play', 'kneel_down', 'penalty_no_play',
  'EPA_success', 'EPA_explosive', 'passer_player_id', 'passer_player_name', 'rusher_player_id', 'rusher_player_name', 'receiver_player_id', 'receiver_player_name',
  'sack_player_id', 'sack_player_id2', 'sack_player_name', 'sack_player_name2', 'interception_player_id', 'interception_player_name', 'pass_breakup_player_id', 'pass_breakup_player_name',
  'fumble_forced_player_id', 'fumble_forced_player_name', 'fg_kicker_player_id', 'fg_kicker_player_name', 'homeTeamId', 'awayTeamId', 'gameSpread', 'homeTeamSpread', 'overUnder', 'homeFavorite',
  'pos_score_diff_start', 'start.TimeSecsRem', 'drive.id', 'drive.result', 'status_type_completed', 'type.text', 'wallclock', 'homeScore', 'awayScore',
];

/**
 * Stream one season of play-by-play into team + player accumulators.
 * Returns null if the file doesn't exist yet (e.g. before the first game).
 */
export async function aggregatePbp(season: number, posOf: (athleteId: string) => string, frontOf: (teamId: number) => DefensiveFront): Promise<PbpAgg | null> {
  const file = await download(pbpUrl(season), `sportsdataverse ESPN CFB play-by-play ${season}`, { ttlMinutes: 120, optional: true, timeoutMs: 600_000 });
  if (!file) return null;
  const handle = await openParquet(file);
  const agg: PbpAgg = { season, teams: new Map(), players: new Map(), lines: new Map(), results: new Map(), plays: 0, games: 0 };
  const team = (id: number) => { if (!agg.teams.has(id)) agg.teams.set(id, newTeam()); return agg.teams.get(id)!; };
  const player = (id: string, name: string, tm: number) => { if (!agg.players.has(id)) agg.players.set(id, newPlayer(name, tm)); return agg.players.get(id)!; };
  const line = (p: PlayerAcc, gameId: string, tm: number) => { let l = p.log.get(gameId); if (!l) { l = { ...emptyGameStat(), team: tm }; p.log.set(gameId, l); } p.games.add(gameId); return l; };
  const half = (m: Map<string, HalfSplit>, game: string) => { if (!m.has(game)) m.set(game, { h1: 0, h2: 0, n1: 0, n2: 0 }); return m.get(game)!; };
  const games = new Set<string>();

  const missing = await forEachParquetRow(handle, COLUMNS, (r) => {
    const st = pnum(r.seasonType);
    if (st !== 2 && st !== 3) return; // regular + postseason
    const pos = pnum(r.pos_team_id);
    const def = pnum(r.def_pos_team_id);
    if (!Number.isFinite(pos) || !Number.isFinite(def) || pos === def) return;
    const gameId = pstr(r.game_id);
    if (!games.has(gameId)) {
      games.add(gameId);
      const homeSpread = pnum(r.homeTeamSpread);
      const total = pnum(r.overUnder);
      if (Number.isFinite(homeSpread) || Number.isFinite(total)) {
        // ESPN stores the favourite's line as a positive number; convert to the home team's sportsbook line.
        const homeFav = pbool(r.homeFavorite);
        agg.lines.set(gameId, { homeSpread: Number.isFinite(homeSpread) ? (homeFav ? -Math.abs(homeSpread) : Math.abs(homeSpread)) : null, total: Number.isFinite(total) ? total : null });
      }
    }
    const hs = pnum(r.homeScore);
    const as = pnum(r.awayScore);
    const homeId = pnum(r.homeTeamId);
    const awayId = pnum(r.awayTeamId);
    if (Number.isFinite(hs) && Number.isFinite(as) && Number.isFinite(homeId) && Number.isFinite(awayId)) {
      const prev = agg.results.get(gameId);
      // Rows are in play order; keep the highest running score seen (scores never decrease).
      if (!prev || hs + as >= prev.homeScore + prev.awayScore) agg.results.set(gameId, { homeId, awayId, homeScore: hs, awayScore: as, completed: pbool(r.status_type_completed), week: pnum(r.week), seasonType: st, date: prev?.date || pstr(r.wallclock) });
    }
    const o = team(pos);
    const d = team(def);
    o.games.add(gameId);
    d.games.add(gameId);

    const isPass = pbool(r.pass);
    const isRush = pbool(r.rush);
    const down = pnum(r.down);
    const dist = pnum(r.distance);
    const ytg = pnum(r['start.yardsToEndzone']);
    const period = pnum(r.period);
    const diff = pnum(r.pos_score_diff_start);
    const secs = pnum(r['start.TimeSecsRem']);
    const typeText = pstr(r['type.text']);

    // Fourth-down decision making (4th & ≤2 between the opponent's 40 and their 3, not garbage time).
    if (down === 4 && dist <= 2 && ytg <= 60 && ytg >= 3 && secs > 120 && !(period >= 4 && Math.abs(diff) > 16)) {
      if (isPass || isRush) { o.fourthOpp++; o.fourthGo++; }
      else if (pbool(r.punt) || pbool(r.fg_attempt)) o.fourthOpp++;
    }

    // Kicker credit (before the scrimmage filter).
    const kicker = pstr(r.fg_kicker_player_id);
    if (kicker && pbool(r.fg_attempt)) { const k = player(kicker, pstr(r.fg_kicker_player_name), pos); k.fgAtt++; const l = line(k, gameId, pos); l.fga++; if (pbool(r.fg_made)) { k.fgMade++; l.fgm++; } }

    if (!(isPass || isRush)) return;
    if (!pbool(r.scrimmage_play) || pbool(r.kneel_down) || pbool(r.penalty_no_play)) return;
    const epa = pnum(r.EPA);
    if (!Number.isFinite(epa)) return;
    agg.plays++;

    const yards = Number.isFinite(pnum(r.statYardage)) ? pnum(r.statYardage) : 0;
    const success = pbool(r.EPA_success) ? 1 : 0;
    const explosive = (isPass && yards >= 20) || (isRush && yards >= 12) ? 1 : 0;
    o.plays++; o.epa += epa; o.success += success; o.explosive += explosive;
    d.dPlays++; d.dEpa += epa; d.dExplosive += explosive;
    if (isPass) { o.passPlays++; o.passEpa += epa; d.dPassPlays++; d.dPassEpa += epa; }
    else { o.rushPlays++; o.rushEpa += epa; d.dRushPlays++; d.dRushEpa += epa; }
    const front = frontOf(def);
    o.vsFront[front].n++; o.vsFront[front].epa += epa;
    if (pbool(r.havoc)) d.havoc++;

    // Neutral early-down pass rate (Q1-Q3, within 16).
    if ((down === 1 || down === 2) && period <= 3 && Math.abs(diff) <= 16) { o.earlyDowns++; if (isPass) o.earlyPass++; }
    if (down === 3) {
      const conv = yards >= dist || pbool(r.touchdown);
      o.thirdAtt++; d.dThirdAtt++;
      if (conv) { o.thirdConv++; d.dThirdConv++; }
    }
    // Red zone: trips keyed by drive, TDs by drive result.
    if (ytg <= 20) {
      const key = `${gameId}|${pstr(r['drive.id'])}`;
      if (!o.rzTrips.has(key)) { o.rzTrips.add(key); d.dRzTrips.add(key); if (pstr(r['drive.result']).toUpperCase().includes('TD')) { o.rzTd++; d.dRzTd++; } }
    }
    // Halves for adjustment proxies.
    const h = pnum(r.half);
    if (h === 1 || h === 2) {
      const ho = half(o.offHalf, gameId); const hd = half(d.defHalf, gameId);
      if (h === 1) { ho.h1 += epa; ho.n1++; hd.h1 += epa; hd.n1++; } else { ho.h2 += epa; ho.n2++; hd.h2 += epa; hd.n2++; }
    }
    // Pressure proxies + passer stats. A dropback = pass attempt or sack.
    const sack = pbool(r.sack);
    if (isPass || sack) {
      o.dropbacks++; d.dDropbacks++;
      const hurry = pbool(r.qb_hurry);
      if (hurry || sack) { o.pressuresAllowed++; d.pressures++; }
      if (sack) { o.sacksAllowed++; d.sacks++; }
      const pid = pstr(r.passer_player_id);
      if (pid) {
        const p = player(pid, pstr(r.passer_player_name), pos);
        p.dropbacks++; p.passEpa += epa;
        const l = line(p, gameId, pos);
        l.epa += epa;
        if (!sack) { l.passAtt++; if (pbool(r.completion)) { l.passCmp++; l.passYds += Number.isFinite(pnum(r.yds_receiving)) ? pnum(r.yds_receiving) : yards; } }
        const cpoe = pnum(r.cpoe);
        if (Number.isFinite(cpoe)) { p.cpoe += cpoe; p.cpoeN++; }
        if (pbool(r.touchdown) && isPass && !sack) { p.passTd++; l.passTd++; }
        if (pbool(r.int)) { p.passInt++; l.passInt++; }
      }
      const air = pnum(r.air_yards);
      if (Number.isFinite(air)) { o.airYards += air; o.airN++; }
    }
    // Takeaways.
    if (pbool(r.int) || pbool(r.fumble_lost)) d.takeaways++;
    // Targets.
    const rid = pstr(r.receiver_player_id);
    if (isPass && rid && !sack) {
      const p = player(rid, pstr(r.receiver_player_name), pos);
      p.targets++; p.recEpa += epa;
      const l = line(p, gameId, pos);
      l.tgt++; l.epa += epa;
      if (pbool(r.completion)) { const y = Number.isFinite(pnum(r.yds_receiving)) ? pnum(r.yds_receiving) : yards; p.rec++; p.recYds += y; l.rec++; l.recYds += y; if (pbool(r.touchdown)) l.recTd++; }
      const air = pnum(r.air_yards);
      const rpos = posOf(rid);
      if (Number.isFinite(air) && air <= 10) { o.shortTgtN++; o.shortTgtEpa += epa; }
      if (rpos === 'TE' || rpos === 'RB') { d.dTeRbTgtN++; d.dTeRbTgtEpa += epa; }
      else if (rpos === 'WR' && Number.isFinite(air) && air <= 10) { d.dShortWrTgtN++; d.dShortWrTgtEpa += epa; }
    }
    const rusher = pstr(r.rusher_player_id);
    if (isRush && rusher) {
      const p = player(rusher, pstr(r.rusher_player_name), pos);
      const y = Number.isFinite(pnum(r.yds_rushed)) ? pnum(r.yds_rushed) : yards;
      p.rushAtt++; p.rushYds += y; p.rushEpa += epa;
      const l = line(p, gameId, pos);
      l.rushAtt++; l.rushYds += y; l.epa += epa; if (pbool(r.touchdown)) l.rushTd++;
      if (posOf(rusher) === 'QB') o.qbRushes++;
    }
    // Defender credit.
    for (const [idCol, nameCol, share] of [['sack_player_id', 'sack_player_name', 1], ['sack_player_id2', 'sack_player_name2', 0.5]] as const) {
      const id = pstr(r[idCol]);
      if (id) { const p = player(id, pstr(r[nameCol]), def); p.sacks += share; line(p, gameId, def).sacks += share; }
    }
    const intId = pstr(r.interception_player_id);
    if (intId) { const p = player(intId, pstr(r.interception_player_name), def); p.ints++; line(p, gameId, def).int++; }
    const pbuId = pstr(r.pass_breakup_player_id);
    if (pbuId) { const p = player(pbuId, pstr(r.pass_breakup_player_name), def); p.pbus++; line(p, gameId, def).pbu++; }
    const ffId = pstr(r.fumble_forced_player_id);
    if (ffId) { const p = player(ffId, pstr(r.fumble_forced_player_name), def); p.ffs++; line(p, gameId, def).ff++; }
  });
  if (missing.length) console.warn(`  pbp ${season}: columns not in file — ${missing.join(', ')}`);
  agg.games = games.size;
  return agg;
}

/**
 * Full rosters → per-team roster files (data/live/rosters/{teamId}.json):
 * every listed player ranked into strings within his position group, graded
 * where there is production to grade, with strengths / weaknesses, usage,
 * current-season game logs and the team's season schedule with results.
 *
 * The engine depth chart (players.ts) is cut from these same rankings, so the
 * grade a player shows on his profile is the grade the engine uses.
 */
import type { InjuryStatus, Player, PlayerRole, Position, Team } from '../../src/engine/types';
import type { PlayerGameLog, PlayerTrait, RosterPlayer, RosterPositionLabel, StatLine, TeamRosterFile, TeamScheduleGame } from '../../src/data/liveTypes';
import type { GameRow, RosterRow } from '../sources/cfbfastr';
import type { GameStat, PlayerAcc, TeamAcc } from '../sources/sdvpbp';
import { blendWeight, gamesPlayed, type BuildCtx } from './context';
import { clamp, nameKey, percentile, r2, r3 } from '../lib/util';

export const STRING_SIZES: Record<RosterPositionLabel, number> = { QB: 1, RB: 1, WR: 3, TE: 1, OL: 5, EDGE: 2, DT: 2, LB: 2, CB: 2, NCB: 1, S: 2, K: 1, P: 1, LS: 1 };
export const POS_ORDER: RosterPositionLabel[] = ['QB', 'RB', 'WR', 'TE', 'OL', 'EDGE', 'DT', 'LB', 'CB', 'NCB', 'S', 'K', 'P', 'LS'];
const UNIT: Record<RosterPositionLabel, RosterPlayer['unit']> = { QB: 'offense', RB: 'offense', WR: 'offense', TE: 'offense', OL: 'offense', EDGE: 'defense', DT: 'defense', LB: 'defense', CB: 'defense', NCB: 'defense', S: 'defense', K: 'special', P: 'special', LS: 'special' };
const CLASS: Record<number, string> = { 1: 'Fr', 2: 'So', 3: 'Jr', 4: 'Sr', 5: 'Gr' };
/** Every CFBD headshot is this prefix + the ESPN athlete id, so the URL is derived, not stored. */
export const HEADSHOT_BASE = 'https://a.espncdn.com/i/headshots/college-football/players/full/';

/** Roster position → position group. CFBD lists generic "DL" / "DB" / "OL"; weight splits the line. */
export function rosterGroup(r: RosterRow): RosterPositionLabel | null {
  const p = r.position.toUpperCase();
  switch (p) {
    case 'QB': return 'QB';
    case 'RB': case 'FB': case 'HB': case 'TB': return 'RB';
    case 'WR': return 'WR';
    case 'TE': return 'TE';
    case 'OL': case 'OT': case 'G': case 'OG': case 'C': case 'T': return 'OL';
    case 'DE': case 'EDGE': case 'OLB': return 'EDGE';
    case 'DT': case 'NT': case 'NG': return 'DT';
    case 'DL': return Number(r.weight) >= 280 ? 'DT' : 'EDGE';
    case 'LB': case 'ILB': case 'MLB': return 'LB';
    case 'CB': case 'DB': return 'CB';
    case 'S': case 'FS': case 'SS': return 'S';
    case 'PK': case 'K': return 'K';
    case 'P': return 'P';
    case 'LS': return 'LS';
    default: return null;
  }
}

/** Season totals. Every counter is required here; the published file drops zeros. */
export type FullStats = Required<StatLine>;
export interface Sums extends FullStats { games: number; dropbacks: number; recEpa: number; rushEpa: number; passEpa: number; cpoe: number; cpoeN: number; }
const zeroSums = (): Sums => ({ games: 0, dropbacks: 0, recEpa: 0, rushEpa: 0, passEpa: 0, cpoe: 0, cpoeN: 0, passAtt: 0, passCmp: 0, passYds: 0, passTd: 0, passInt: 0, rushAtt: 0, rushYds: 0, rushTd: 0, tgt: 0, rec: 0, recYds: 0, recTd: 0, sacks: 0, int: 0, pbu: 0, ff: 0, fgm: 0, fga: 0, epa: 0 });
const addLine = (t: Sums, l: GameStat) => { for (const k of Object.keys(t) as (keyof Sums)[]) if (k in l) (t as any)[k] += (l as any)[k]; };
/** Season totals from a PlayerAcc, optionally restricted to games with a given team. */
export function sumsOf(acc: PlayerAcc | undefined, teamId?: number): Sums {
  const t = zeroSums();
  if (!acc) return t;
  for (const [, l] of acc.log) { if (teamId !== undefined && l.team !== teamId) continue; addLine(t, l); t.games++; }
  // Efficiency inputs are season-wide (not per game) on the accumulator.
  t.dropbacks = acc.dropbacks; t.recEpa = acc.recEpa; t.rushEpa = acc.rushEpa; t.passEpa = acc.passEpa; t.cpoe = acc.cpoe; t.cpoeN = acc.cpoeN;
  return t;
}
const merge = (a: Sums, b: Sums): Sums => { const o = zeroSums(); for (const k of Object.keys(o) as (keyof Sums)[]) o[k] = a[k] + b[k]; return o; };

export interface RankedPlayer {
  teamId: string;
  espnTeamId: number;
  athleteId: string;
  roster: RosterRow;
  pos: RosterPositionLabel;
  rank: number;
  string: number;
  /** Combined current + prior production. */
  s: Sums;
  cur: Sums;
  prior: Sums;
  composite: number | null;
  statLine: string | null;
  usage: RosterPlayer['usage'];
  rating: number;
  ratingBasis: RosterPlayer['ratingBasis'];
  role: RosterPlayer['role'];
  facets: Record<string, number>;
}

/** Usage score used to order a roster into strings. Current-season usage on this team dominates. */
function usageScore(pos: RosterPositionLabel, cur: Sums, prior: Sums): number {
  const u = (x: Sums) => {
    switch (pos) {
      case 'QB': return x.passAtt + x.sacks + x.rushAtt * 0.5;
      case 'RB': return x.rushAtt + x.tgt;
      case 'WR': case 'TE': return x.tgt * 2 + x.rushAtt * 0.3;
      case 'EDGE': case 'DT': return x.sacks * 6 + x.ff * 3 + x.games;
      case 'LB': return x.sacks * 4 + x.pbu * 2 + x.int * 4 + x.ff * 3 + x.games;
      case 'CB': case 'NCB': case 'S': return x.pbu * 3 + x.int * 5 + x.ff * 2 + x.games;
      case 'K': return x.fga * 3;
      default: return x.games;
    }
  };
  return u(cur) * 3 + u(prior) * 0.6;
}

const per = (v: number, n: number) => (n > 0 ? v / n : 0);

/**
 * Roster files are rewritten on every refresh and committed, so they are kept
 * small: zero counters are dropped and the app reads a missing counter as 0.
 */
const compact = <T extends Record<string, number>>(line: T): T => Object.fromEntries(Object.entries(line).filter(([, v]) => v !== 0)) as T;

/** Position-specific production composite (null when the sample is too small) and the facets used for strengths / weaknesses. */
function production(pos: RosterPositionLabel, s: Sums, seasons: number): { composite: number | null; statLine: string | null; facets: Record<string, number> } {
  const perSeason = (v: number) => (seasons ? v / seasons : v);
  const f: Record<string, number> = {};
  switch (pos) {
    case 'QB': {
      if (s.dropbacks < 40) return { composite: null, statLine: null, facets: f };
      const epaDb = s.passEpa / s.dropbacks;
      const cpoe = s.cpoeN ? s.cpoe / s.cpoeN : 0;
      f.efficiency = epaDb; f.accuracy = cpoe; f.ballSecurity = -per(s.passInt, s.passAtt); f.bigPlay = per(s.passYds, s.passCmp); f.rushing = per(s.rushYds, s.games); f.scoring = per(s.passTd, s.games);
      return { composite: epaDb + cpoe / 40, statLine: `${r2(epaDb)} EPA/dropback · ${cpoe.toFixed(1)} CPOE · ${s.dropbacks} dropbacks`, facets: f };
    }
    case 'RB': {
      if (s.rushAtt + s.tgt < 30) return { composite: null, statLine: null, facets: f };
      const ypc = per(s.rushYds, s.rushAtt);
      f.ypc = ypc; f.explosive = per(s.rushEpa, s.rushAtt); f.receiving = per(s.tgt, s.games); f.workload = per(s.rushAtt, s.games); f.finishing = per(s.rushTd + s.recTd, s.games);
      return { composite: perSeason(s.rushEpa + s.recEpa) + (ypc - 4.8) * 3, statLine: `${ypc.toFixed(1)} YPC · ${r2(perSeason(s.rushEpa + s.recEpa))} EPA/season`, facets: f };
    }
    case 'WR': case 'TE': {
      if (s.tgt < 12) return { composite: null, statLine: null, facets: f };
      const effShrunk = (s.recEpa + 40 * 0.15) / (s.tgt + 40);
      f.efficiency = s.recEpa / s.tgt; f.ypr = per(s.recYds, s.rec); f.hands = per(s.rec, s.tgt); f.scoring = per(s.recTd, s.games); f.volume = per(s.tgt, s.games);
      return { composite: perSeason(s.recEpa) * 0.6 + effShrunk * 60 * 0.4 + perSeason(s.tgt) * 0.03, statLine: `${r2(s.recEpa / s.tgt)} EPA/target on ${Math.round(perSeason(s.tgt))} tgt/season`, facets: f };
    }
    case 'EDGE': case 'DT': {
      if (s.games < 3 || s.sacks + s.ff === 0) return { composite: null, statLine: null, facets: f };
      f.passRush = per(s.sacks, s.games); f.disruption = per(s.ff, s.games); f.availability = s.games;
      return { composite: per(s.sacks, s.games) * 10 + per(s.ff, s.games) * 4, statLine: `${per(s.sacks, s.games).toFixed(2)} sacks/g · ${s.ff} FF in ${s.games} g`, facets: f };
    }
    case 'LB': {
      if (s.games < 3 || s.sacks + s.pbu + s.int + s.ff === 0) return { composite: null, statLine: null, facets: f };
      f.passRush = per(s.sacks, s.games); f.coverage = per(s.pbu + s.int, s.games); f.disruption = per(s.ff, s.games); f.availability = s.games;
      return { composite: per(s.sacks * 1.2 + s.pbu * 0.8 + s.int * 1.5 + s.ff, s.games) * 10, statLine: `${s.sacks} sacks · ${s.pbu} PBU · ${s.int} INT in ${s.games} g`, facets: f };
    }
    case 'CB': case 'NCB': case 'S': {
      if (s.games < 3 || s.pbu + s.int + s.ff < 2) return { composite: null, statLine: null, facets: f };
      f.ballSkills = per(s.int, s.games); f.breakups = per(s.pbu, s.games); f.turnovers = per(s.int + s.ff, s.games); f.availability = s.games;
      return { composite: per(s.pbu + s.int * 2 + s.ff * 0.5, s.games) * 10, statLine: `${s.pbu} PBU · ${s.int} INT in ${s.games} g`, facets: f };
    }
    case 'K': {
      if (s.fga < 5) return { composite: null, statLine: null, facets: f };
      f.accuracy = s.fgm / s.fga; f.volume = per(s.fga, s.games);
      return { composite: s.fgm / s.fga, statLine: `${s.fgm}/${s.fga} FG`, facets: f };
    }
    default: return { composite: null, statLine: null, facets: f };
  }
}

const FACET_LABEL: Record<string, string> = {
  efficiency: 'Efficiency', accuracy: 'Accuracy', ballSecurity: 'Ball security', bigPlay: 'Yards per completion', rushing: 'Rushing threat', scoring: 'Scoring',
  ypc: 'Yards per carry', explosive: 'Explosive runs', receiving: 'Receiving usage', workload: 'Workload', finishing: 'Finishing',
  ypr: 'Yards per catch', hands: 'Catch rate', volume: 'Target volume',
  passRush: 'Pass rush', disruption: 'Forced fumbles', availability: 'Availability', coverage: 'Coverage plays',
  ballSkills: 'Interceptions', breakups: 'Pass breakups', turnovers: 'Turnover creation',
};
const FACET_FMT: Record<string, (v: number) => string> = {
  efficiency: (v) => `${r2(v)} EPA`, accuracy: (v) => `${v.toFixed(1)} CPOE`, ballSecurity: (v) => `${(-v * 100).toFixed(1)}% INT rate`, bigPlay: (v) => `${v.toFixed(1)} yds/cmp`, rushing: (v) => `${v.toFixed(0)} rush yds/g`, scoring: (v) => `${v.toFixed(2)} TD/g`,
  ypc: (v) => `${v.toFixed(1)} YPC`, explosive: (v) => `${r2(v)} EPA/carry`, receiving: (v) => `${v.toFixed(1)} tgt/g`, workload: (v) => `${v.toFixed(1)} carries/g`, finishing: (v) => `${v.toFixed(2)} TD/g`,
  ypr: (v) => `${v.toFixed(1)} yds/rec`, hands: (v) => `${Math.round(v * 100)}% caught`, volume: (v) => `${v.toFixed(1)} tgt/g`,
  passRush: (v) => `${v.toFixed(2)} sacks/g`, disruption: (v) => `${v.toFixed(2)} FF/g`, availability: (v) => `${v} games`, coverage: (v) => `${v.toFixed(2)} PBU+INT/g`,
  ballSkills: (v) => `${v.toFixed(2)} INT/g`, breakups: (v) => `${v.toFixed(2)} PBU/g`, turnovers: (v) => `${v.toFixed(2)} takeaways/g`,
};

export interface RosterBuild {
  byTeam: Map<string, RankedPlayer[]>;
  files: Map<string, TeamRosterFile>;
}

/**
 * Rank every listed player, grade everyone with production against the whole
 * FBS population at his position, derive traits, and assemble the roster files.
 */
export function buildRosters(ctx: BuildCtx, teams: Team[], games: GameRow[], teamPbwr: (id: string) => number): RosterBuild {
  const rosterByTeam = new Map<string, RosterRow[]>();
  for (const r of ctx.rosters) (rosterByTeam.get(r.team) ?? rosterByTeam.set(r.team, []).get(r.team)!).push(r);
  const byEspn = new Map(teams.map((t) => [t.espnId, t]));
  const injByTeam = new Map<number, Map<string, { status: string; detail: string }>>();
  for (const e of ctx.espnInjuries) (injByTeam.get(e.teamId) ?? injByTeam.set(e.teamId, new Map()).get(e.teamId)!).set(nameKey(e.name), { status: e.status, detail: e.detail });

  // 1. Rank within position pools.
  const byTeam = new Map<string, RankedPlayer[]>();
  for (const t of teams) {
    const roster = rosterByTeam.get(t.school) ?? [];
    const pools = new Map<RosterPositionLabel, RankedPlayer[]>();
    const seen = new Set<string>();
    for (const r of roster) {
      const pos = rosterGroup(r);
      if (!pos || seen.has(r.athlete_id)) continue;
      seen.add(r.athlete_id);
      const curAcc = ctx.cur?.players.get(r.athlete_id);
      const priorAcc = ctx.prior?.players.get(r.athlete_id);
      const cur = sumsOf(curAcc, t.espnId);
      const prior = sumsOf(priorAcc);
      const seasons = (cur.games ? 1 : 0) + (prior.games ? 1 : 0);
      const s = merge(cur, prior);
      const prod = production(pos, s, seasons);
      (pools.get(pos) ?? pools.set(pos, []).get(pos)!).push({
        teamId: t.id, espnTeamId: t.espnId, athleteId: r.athlete_id, roster: r, pos, rank: 0, string: 0, s, cur, prior,
        composite: prod.composite, statLine: prod.statLine, usage: { snapPct: 0 }, rating: 0, ratingBasis: 'roster', role: 'reserve', facets: prod.facets,
      });
    }
    // Third-ranked corner is the nickel unless a roster lists one outright.
    const cbs = pools.get('CB');
    if (cbs && cbs.length >= 3 && !pools.has('NCB')) {
      const sorted = [...cbs].sort((a, b) => usageScore('CB', b.cur, b.prior) - usageScore('CB', a.cur, a.prior) || (Number(b.roster.year) || 0) - (Number(a.roster.year) || 0));
      const ncb = sorted[2];
      pools.set('CB', cbs.filter((p) => p !== ncb));
      pools.set('NCB', [{ ...ncb, pos: 'NCB' }]);
    }
    const all: RankedPlayer[] = [];
    for (const [pos, list] of pools) {
      list.sort((a, b) => usageScore(pos, b.cur, b.prior) - usageScore(pos, a.cur, a.prior) || (Number(b.roster.year) || 0) - (Number(a.roster.year) || 0) || a.roster.name.localeCompare(b.roster.name));
      list.forEach((p, i) => { p.rank = i + 1; p.string = Math.ceil((i + 1) / STRING_SIZES[pos]); });
      all.push(...list);
    }
    byTeam.set(t.id, all);
  }

  // 2. Grades against the FBS population, per position.
  const pops = new Map<RosterPositionLabel, number[]>();
  const facetPops = new Map<string, number[]>();
  for (const list of byTeam.values()) for (const p of list) {
    if (p.composite !== null) (pops.get(p.pos) ?? pops.set(p.pos, []).get(p.pos)!).push(p.composite);
    for (const [k, v] of Object.entries(p.facets)) { const key = `${p.pos}|${k}`; (facetPops.get(key) ?? facetPops.set(key, []).get(key)!).push(v); }
  }
  const teamById = new Map(teams.map((t) => [t.id, t]));
  for (const [teamId, list] of byTeam) {
    const t = teamById.get(teamId)!;
    const talent = t.talent ?? 5.5;
    const gp = gamesPlayed(ctx.cur, t.espnId);
    const teamCur = ctx.cur?.teams.get(t.espnId);
    const teamPrior = ctx.prior?.teams.get(t.espnId);
    for (const p of list) {
      const starterish = p.string === 1;
      if (p.pos === 'OL') { p.rating = Math.round(clamp(55 + ((teamPbwr(teamId) - 0.45) / 0.3) * 35, 50, 92) - (starterish ? 0 : 8) - Math.max(0, p.string - 2) * 4); p.ratingBasis = 'roster'; }
      else if (p.composite !== null) { p.rating = Math.round(clamp(42 + percentile(p.composite, pops.get(p.pos) ?? []) * 0.55, 40, 97)); p.ratingBasis = 'production'; }
      else { const yr = Number(p.roster.year) || 1; p.rating = Math.round(clamp(50 + yr * 2 + (talent - 5.5) * 4 + (starterish ? 3 : 0) - Math.max(0, p.string - 2) * 3, 40, 80)); p.ratingBasis = 'roster'; }
      // Usage metrics.
      const snap = starterish ? (p.pos === 'QB' ? 1 : p.pos === 'WR' ? [0.85, 0.75, 0.62][p.rank - 1] ?? 0.6 : p.pos === 'RB' ? 0.6 : p.pos === 'TE' ? 0.7 : p.pos === 'EDGE' ? [0.7, 0.6][p.rank - 1] ?? 0.5 : p.pos === 'DT' ? 0.65 : p.pos === 'LB' ? 0.85 : p.pos === 'CB' ? 0.9 : p.pos === 'NCB' ? 0.75 : p.pos === 'S' ? 0.9 : 0.95)
        : p.string === 2 ? (p.pos === 'QB' ? 0.08 : p.pos === 'RB' ? 0.35 : p.pos === 'WR' ? 0.42 : p.pos === 'TE' ? 0.4 : p.pos === 'EDGE' ? 0.42 : p.pos === 'DT' ? 0.5 : p.pos === 'LB' ? 0.6 : p.pos === 'CB' || p.pos === 'S' ? 0.3 : 0.2)
        : 0.08;
      p.usage = { snapPct: r2(snap) };
      if (p.pos === 'WR' || p.pos === 'TE' || p.pos === 'RB') {
        const useCur = gp >= 3 && p.cur.tgt > 0;
        const acc = useCur ? p.cur : p.prior;
        const team = useCur ? teamCur : teamPrior;
        const tp = team?.passPlays ?? 0;
        const db = team?.dropbacks ?? 0;
        if (acc.games && tp > 40) { p.usage.targetShare = r3(clamp(acc.tgt / tp, 0, 0.4)); p.usage.tprr = r3(clamp(acc.tgt / Math.max(1, db * snap), 0.04, 0.4)); }
        else { p.usage.targetShare = starterish ? (p.pos === 'WR' ? 0.16 : 0.1) : 0.06; p.usage.tprr = starterish ? 0.18 : 0.14; }
      }
      if ((p.pos === 'EDGE' || p.pos === 'DT') && p.composite !== null) p.usage.prwr = r3(clamp(0.07 + per(p.s.sacks, p.s.games) * 0.16 + per(p.s.ff, p.s.games) * 0.05, 0.05, 0.32));
      if (p.pos === 'OL') p.usage.pbwr = r3(clamp(teamPbwr(teamId) + 0.25 - Math.max(0, p.string - 1) * 0.05, 0.6, 0.97));
    }
  }

  // 3. Roster files.
  const files = new Map<string, TeamRosterFile>();
  const gameMeta = ctx.cur?.results ?? new Map();
  for (const t of teams) {
    const list = byTeam.get(t.id) ?? [];
    const inj = injByTeam.get(t.espnId);
    const sched: TeamScheduleGame[] = games
      .filter((g) => g.season === ctx.season && (g.home_id === t.espnId || g.away_id === t.espnId))
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .map((g) => {
        const home = g.home_id === t.espnId;
        const oppEspn = home ? g.away_id : g.home_id;
        const opp = byEspn.get(oppEspn);
        const ts = home ? g.home_points : g.away_points;
        const os = home ? g.away_points : g.home_points;
        const final = Number.isFinite(ts) && Number.isFinite(os);
        return { id: g.game_id, week: g.week, gameType: g.season_type, date: g.start_date, oppId: opp?.id ?? null, oppName: opp?.school ?? (home ? g.away_team : g.home_team), home: home && !g.neutral_site, neutral: g.neutral_site, status: final ? 'final' : 'scheduled', teamScore: final ? ts : null, oppScore: final ? os : null, result: final ? (ts > os ? 'W' : 'L') : null, notes: g.notes || null };
      });
    const wins = sched.filter((g) => g.result === 'W').length;
    const losses = sched.filter((g) => g.result === 'L').length;
    const nextGame = sched.find((g) => g.status === 'scheduled') ?? null;
    const roster: RosterPlayer[] = list.map((p) => {
      const acc = ctx.cur?.players.get(p.athleteId);
      const logs: PlayerGameLog[] = [];
      if (acc) for (const [gid, l] of acc.log) {
        if (l.team !== t.espnId) continue;
        const m = gameMeta.get(gid);
        const home = m ? m.homeId === t.espnId : true;
        const oppEspn = m ? (home ? m.awayId : m.homeId) : NaN;
        const opp = byEspn.get(oppEspn);
        const sg = sched.find((x) => x.id === gid);
        const ts = m ? (home ? m.homeScore : m.awayScore) : null;
        const os = m ? (home ? m.awayScore : m.homeScore) : null;
        const { team: _team, ...stats } = l;
        logs.push({ gameId: gid, week: m?.week ?? sg?.week ?? 0, date: m?.date || sg?.date || '', oppId: opp?.id ?? sg?.oppId ?? null, oppName: opp?.school ?? sg?.oppName ?? 'Opponent', home, result: m?.completed && ts !== null && os !== null ? (ts > os ? 'W' : 'L') : null, teamScore: ts, oppScore: os, stats: compact({ ...stats, epa: r2(stats.epa) }) });
      }
      logs.sort((a, b) => a.week - b.week || a.date.localeCompare(b.date));
      const traits = { strengths: [] as PlayerTrait[], weaknesses: [] as PlayerTrait[] };
      for (const [k, v] of Object.entries(p.facets)) {
        const pop = facetPops.get(`${p.pos}|${k}`) ?? [];
        if (pop.length < 12) continue;
        const pct = Math.round(percentile(v, pop));
        const trait: PlayerTrait = { label: FACET_LABEL[k] ?? k, value: (FACET_FMT[k] ?? ((x: number) => String(r2(x))))(v), percentile: pct };
        if (pct >= 70) traits.strengths.push(trait); else if (pct <= 30) traits.weaknesses.push(trait);
      }
      traits.strengths.sort((a, b) => b.percentile - a.percentile); traits.weaknesses.sort((a, b) => a.percentile - b.percentile);
      const e = inj?.get(nameKey(p.roster.name));
      let reported: InjuryStatus | undefined; let reportNote: string | undefined;
      if (e) {
        const st = e.status.toLowerCase();
        if (st.includes('out') || st.includes('injured') || st.includes('doubtful') || st.includes('season')) { reported = 'out'; reportNote = `${e.detail || 'Injury'} · ${e.status}`; }
        else if (st.includes('questionable') || st.includes('day-to-day') || st.includes('probable')) { reported = 'questionable'; reportNote = `${e.detail || 'Injury'} · ${e.status}`; }
      }
      const yr = Number(p.roster.year);
      const h = Number(p.roster.height);
      const { games: cg, dropbacks: _d, recEpa: _r, rushEpa: _ru, passEpa: _pe, cpoe: _c, cpoeN: _cn, ...curLine } = p.cur;
      const { games: pg, dropbacks: _d2, recEpa: _r2, rushEpa: _ru2, passEpa: _pe2, cpoe: _c2, cpoeN: _cn2, ...priorLine } = p.prior;
      return {
        id: `${t.id}-${p.athleteId}`, athleteId: p.athleteId, name: p.roster.name, jersey: p.roster.jersey || null, pos: p.pos, listedPos: p.roster.position || p.pos, unit: UNIT[p.pos],
        string: p.string, rank: p.rank, role: p.role, rating: p.rating, ratingBasis: p.ratingBasis,
        headshotUrl: p.roster.headshot_url && !p.roster.headshot_url.startsWith(HEADSHOT_BASE) ? p.roster.headshot_url : null, height: Number.isFinite(h) && h > 0 ? `${Math.floor(h / 12)}'${h % 12}"` : null, weight: Number.isFinite(Number(p.roster.weight)) && Number(p.roster.weight) > 0 ? Number(p.roster.weight) : null,
        classYear: Number.isFinite(yr) && yr > 0 ? yr : null, classLabel: Number.isFinite(yr) && yr > 0 ? CLASS[Math.min(5, yr)] ?? null : null, hometown: p.roster.hometown || null,
        ...(reported ? { reported, reportNote } : {}),
        usage: p.usage, strengths: traits.strengths.slice(0, 4), weaknesses: traits.weaknesses.slice(0, 4),
        season: { ...compact({ ...curLine, epa: r2(curLine.epa) }), games: cg }, prior: pg ? { ...compact({ ...priorLine, epa: r2(priorLine.epa) }), games: pg } : null, games: logs, statLine: p.statLine,
      };
    });
    roster.sort((a, b) => POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos) || a.rank - b.rank);
    files.set(t.id, { teamId: t.id, generatedAt: ctx.today.toISOString(), season: ctx.season, record: `${wins}-${losses}`, schedule: sched, nextGameId: nextGame?.id ?? null, roster, stringSizes: STRING_SIZES, headshotBase: HEADSHOT_BASE });
  }
  return { byTeam, files };
}

/** Engine depth chart cut from the ranked roster: KEEP ranks per engine position. */
const KEEP: Record<Position, PlayerRole[]> = {
  QB: ['starter', 'depth'], RB: ['starter', 'rotational'], WR: ['starter', 'starter', 'starter', 'rotational'], TE: ['starter', 'rotational'], LT: ['starter'], OL: ['starter', 'starter'],
  EDGE: ['starter', 'starter', 'rotational'], DT: ['starter', 'rotational'], LB: ['starter', 'starter'], CB: ['starter', 'starter'], NCB: ['starter'], S: ['starter', 'starter'], K: ['starter'],
};
const ENGINE_ORDER: Position[] = ['QB', 'RB', 'WR', 'TE', 'LT', 'OL', 'EDGE', 'DT', 'LB', 'CB', 'NCB', 'S', 'K'];

export function depthChartFrom(ranked: RankedPlayer[], teamId: string, files: Map<string, TeamRosterFile>): { players: Player[]; qbComposite: number | null; teComposite: number | null } {
  const players: Player[] = [];
  const file = files.get(teamId);
  const rp = new Map(file?.roster.map((r) => [r.athleteId, r]) ?? []);
  let qbComposite: number | null = null;
  let teComposite: number | null = null;
  for (const pos of ENGINE_ORDER) {
    if (pos === 'LT') continue; // no line data in college feeds — every lineman is 'OL'
    const list = ranked.filter((p) => p.pos === pos);
    KEEP[pos].forEach((role, i) => {
      const p = list[i];
      if (!p) return;
      p.role = role;
      const r = rp.get(p.athleteId);
      if (r) r.role = role;
      if (pos === 'QB' && i === 0) qbComposite = p.composite;
      if (pos === 'TE' && i === 0) teComposite = p.composite;
      players.push({
        id: `${teamId}-${p.athleteId}`, name: p.roster.name, pos, role, rating: p.rating, snapPct: p.usage.snapPct,
        ...(p.usage.targetShare !== undefined ? { targetShare: p.usage.targetShare, tprr: p.usage.tprr } : {}),
        ...(p.usage.prwr !== undefined ? { prwr: p.usage.prwr } : {}),
        ...(p.usage.pbwr !== undefined ? { pbwr: p.usage.pbwr } : {}),
        ...(p.statLine ? { note: p.statLine } : { note: pos === 'OL' ? 'roster listing · line usage not tracked' : 'no production yet · roster order by class' }),
        ...(r?.reported ? { reported: r.reported, reportNote: r.reportNote } : {}),
        ...(p.roster.headshot_url ? { headshotUrl: p.roster.headshot_url } : {}),
        ...(Number(p.roster.year) > 0 ? { classYear: Number(p.roster.year) } : {}),
        ...(p.roster.jersey ? { jersey: p.roster.jersey } : {}),
      });
    });
  }
  return { players, qbComposite, teComposite };
}

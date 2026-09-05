/**
 * Rosters (+ ESPN depth charts when reachable, otherwise play-by-play usage)
 * → engine Player rows with production-based grades, usage metrics (target
 * share, TPRR proxy, PRWR proxy, snap-share estimate) and the latest reported
 * availability status.
 *
 * Player ids are ESPN athlete ids in every feed, so a transfer's production
 * history follows him to his new school.
 */
import type { InjuryStatus, Player, Position, PlayerRole, Team } from '../../src/engine/types';
import type { RosterRow } from '../sources/cfbfastr';
import type { PlayerAcc, TeamAcc } from '../sources/sdvpbp';
import type { DepthRow } from '../sources/espn';
import { blendWeight, gamesPlayed, type BuildCtx } from './context';
import { clamp, nameKey, percentile, r2, r3 } from '../lib/util';

interface Candidate {
  team: Team;
  pos: Position;
  role: PlayerRole;
  athleteId: string;
  name: string;
  roster?: RosterRow;
  composite: number | null; // null = no production data
  usage: Partial<Pick<Player, 'targetShare' | 'tprr' | 'prwr' | 'pbwr'>>;
  snapPct: number;
  statLine?: string;
  fromDepthChart: boolean;
}

/** Roster position → engine position. CFBD lists generic "DL"/"DB"/"OL"; weight splits the line. */
export function rosterPosition(r: RosterRow): Position | null {
  const p = r.position.toUpperCase();
  switch (p) {
    case 'QB': return 'QB';
    case 'RB': case 'FB': case 'HB': case 'TB': return 'RB';
    case 'WR': return 'WR';
    case 'TE': return 'TE';
    case 'OL': case 'OT': case 'G': case 'OG': case 'C': case 'T': return 'OL';
    case 'DE': case 'EDGE': case 'OLB': return 'EDGE';
    case 'DT': case 'NT': case 'NG': return 'DT';
    case 'DL': return 'DT';
    case 'LB': case 'ILB': case 'MLB': return 'LB';
    case 'CB': case 'DB': return 'CB';
    case 'S': case 'FS': case 'SS': return 'S';
    case 'PK': case 'K': return 'K';
    default: return null;
  }
}

/** Map an ESPN depth-chart slot to an engine position. */
function slotToPosition(abb: string): Position | null {
  switch (abb) {
    case 'QB': return 'QB';
    case 'RB': case 'FB': case 'HB': case 'TB': return 'RB';
    case 'WR': case 'X': case 'Z': case 'H': case 'SLOT': return 'WR';
    case 'TE': return 'TE';
    case 'LT': return 'LT';
    case 'LG': case 'C': case 'RG': case 'RT': case 'OL': case 'OT': case 'OG': return 'OL';
    case 'LCB': case 'RCB': case 'CB': return 'CB';
    case 'NB': case 'NCB': case 'NICKEL': case 'STAR': return 'NCB';
    case 'FS': case 'SS': case 'S': return 'S';
    case 'PK': case 'K': return 'K';
    case 'LDE': case 'RDE': case 'DE': case 'EDGE': case 'JACK': case 'RUSH': case 'OLB': case 'WDE': case 'SDE': return 'EDGE';
    case 'LDT': case 'RDT': case 'DT': case 'NT': case 'NG': case 'DL': return 'DT';
    case 'WLB': case 'SLB': case 'MLB': case 'LB': case 'ILB': case 'RILB': case 'LILB': case 'MIKE': case 'WILL': case 'SAM': return 'LB';
    default: return null;
  }
}

/** Depth ranks to keep per engine position (role per rank) and the cap after merging slots. */
const KEEP: Record<Position, PlayerRole[]> = {
  QB: ['starter', 'depth'], RB: ['starter', 'rotational'], WR: ['starter', 'starter', 'starter', 'rotational'], TE: ['starter', 'rotational'], LT: ['starter'], OL: ['starter', 'starter'],
  EDGE: ['starter', 'starter', 'rotational'], DT: ['starter', 'rotational'], LB: ['starter', 'starter'], CB: ['starter', 'starter'], NCB: ['starter'], S: ['starter', 'starter'], K: ['starter'],
};
const CAP: Record<Position, number> = { QB: 2, RB: 2, WR: 4, TE: 2, LT: 1, OL: 2, EDGE: 3, DT: 2, LB: 2, CB: 2, NCB: 1, S: 2, K: 1 };
const SNAP: Record<Position, number[]> = {
  QB: [1, 0.08], RB: [0.6, 0.35], WR: [0.85, 0.75, 0.62, 0.42], TE: [0.7, 0.4], LT: [0.95], OL: [0.95, 0.95],
  EDGE: [0.7, 0.6, 0.42], DT: [0.65, 0.5], LB: [0.85, 0.6], CB: [0.9, 0.85], NCB: [0.75], S: [0.9, 0.85], K: [1],
};
const POS_ORDER: Position[] = ['QB', 'RB', 'WR', 'TE', 'LT', 'OL', 'EDGE', 'DT', 'LB', 'CB', 'NCB', 'S', 'K'];

const sum = (a: PlayerAcc | undefined, b: PlayerAcc | undefined) => {
  const pick = (k: keyof PlayerAcc) => Number(a?.[k] ?? 0) + Number(b?.[k] ?? 0);
  return {
    targets: pick('targets'), rec: pick('rec'), recYds: pick('recYds'), recEpa: pick('recEpa'), rushAtt: pick('rushAtt'), rushYds: pick('rushYds'), rushEpa: pick('rushEpa'),
    dropbacks: pick('dropbacks'), passEpa: pick('passEpa'), cpoe: pick('cpoe'), cpoeN: pick('cpoeN'), sacks: pick('sacks'), ints: pick('ints'), pbus: pick('pbus'), ffs: pick('ffs'),
    fgAtt: pick('fgAtt'), fgMade: pick('fgMade'), games: (a?.games.size ?? 0) + (b?.games.size ?? 0),
  };
};
type Sum = ReturnType<typeof sum>;

/** Usage score used to order a roster into a depth chart when ESPN's chart is unavailable. Current-season usage on this team dominates. */
function usageScore(pos: Position, cur: PlayerAcc | undefined, prior: PlayerAcc | undefined, teamId: number, w: number): number {
  const c = cur && cur.team === teamId ? cur : undefined;
  const p = prior;
  const u = (x: PlayerAcc | undefined) => {
    if (!x) return 0;
    switch (pos) {
      case 'QB': return x.dropbacks + x.rushAtt * 0.5;
      case 'RB': return x.rushAtt + x.targets;
      case 'WR': case 'TE': return x.targets * 2 + x.rushAtt * 0.3;
      case 'EDGE': case 'DT': return x.sacks * 6 + x.ffs * 3 + x.games.size;
      case 'LB': return x.sacks * 4 + x.pbus * 2 + x.ints * 4 + x.ffs * 3 + x.games.size;
      case 'CB': case 'NCB': case 'S': return x.pbus * 3 + x.ints * 5 + x.ffs * 2 + x.games.size;
      case 'K': return x.fgAtt * 3;
      default: return x.games.size;
    }
  };
  // A player with any current-season usage on this team outranks pure prior-season usage; the blend weight scales the prior.
  return u(c) * 3 + u(p) * (1 - w) + u(p) * 0.35;
}

export interface PlayerBuild { byTeam: Map<string, Player[]>; qbRating: Map<string, number>; teSpeed: Map<string, number>; depthChartTeams: number; }

export function buildPlayers(ctx: BuildCtx, teams: Team[]): PlayerBuild {
  const rosterByTeam = new Map<string, RosterRow[]>();
  for (const r of ctx.rosters) (rosterByTeam.get(r.team) ?? rosterByTeam.set(r.team, []).get(r.team)!).push(r);
  const rosterById = new Map(ctx.rosters.map((r) => [r.athlete_id, r]));
  const injByTeam = new Map<number, Map<string, { status: string; detail: string }>>();
  for (const e of ctx.espnInjuries) (injByTeam.get(e.teamId) ?? injByTeam.set(e.teamId, new Map()).get(e.teamId)!).set(nameKey(e.name), { status: e.status, detail: e.detail });

  const candidates: Candidate[] = [];
  let depthChartTeams = 0;
  for (const t of teams) {
    const gp = gamesPlayed(ctx.cur, t.espnId);
    const w = blendWeight(gp);
    const roster = rosterByTeam.get(t.school) ?? [];
    const teamCur = ctx.cur?.teams.get(t.espnId);
    const teamPrior = ctx.prior?.teams.get(t.espnId);
    const depth = ctx.depth.get(t.espnId);

    // Ordered pool per engine position: from ESPN's depth chart when we have it, otherwise the roster ranked by usage.
    const pools = new Map<Position, { athleteId: string; name: string; rank: number }[]>();
    if (depth?.length) {
      depthChartTeams++;
      for (const r of depth) {
        const pos = slotToPosition(r.pos_abb);
        if (!pos) continue;
        (pools.get(pos) ?? pools.set(pos, []).get(pos)!).push({ athleteId: r.athlete_id, name: r.name, rank: r.pos_rank });
      }
      for (const [, list] of pools) list.sort((a, b) => a.rank - b.rank);
    } else {
      const byPos = new Map<Position, RosterRow[]>();
      for (const r of roster) {
        let pos = rosterPosition(r);
        if (!pos) continue;
        if (pos === 'DT' && r.position.toUpperCase() === 'DL') pos = Number(r.weight) >= 280 ? 'DT' : 'EDGE';
        (byPos.get(pos) ?? byPos.set(pos, []).get(pos)!).push(r);
      }
      for (const [pos, list] of byPos) {
        const ranked = list
          .map((r) => ({ r, s: usageScore(pos, ctx.cur?.players.get(r.athlete_id), ctx.prior?.players.get(r.athlete_id), t.espnId, w) }))
          .sort((a, b) => b.s - a.s || (Number(b.r.year) || 0) - (Number(a.r.year) || 0) || a.r.name.localeCompare(b.r.name));
        pools.set(pos, ranked.map((x, i) => ({ athleteId: x.r.athlete_id, name: x.r.name, rank: i + 1 })));
      }
      // Third corner plays the nickel when no chart says otherwise.
      const cbs = pools.get('CB') ?? [];
      if (cbs.length >= 3 && !pools.has('NCB')) pools.set('NCB', [{ ...cbs[2], rank: 1 }]);
    }

    const seen = new Set<string>();
    for (const pos of POS_ORDER) {
      const list = pools.get(pos);
      if (!list) continue;
      let kept = 0;
      for (const entry of list) {
        if (kept >= CAP[pos]) break;
        if (seen.has(entry.athleteId)) continue;
        const role = KEEP[pos][kept] ?? 'depth';
        seen.add(entry.athleteId);
        const rr = rosterById.get(entry.athleteId);
        const cur = ctx.cur?.players.get(entry.athleteId);
        const prior = ctx.prior?.players.get(entry.athleteId);
        const s = sum(cur, prior);
        const seasons = (cur ? 1 : 0) + (prior ? 1 : 0);
        const perSeason = (v: number) => (seasons ? v / seasons : v);
        const perGame = (v: number) => (s.games ? v / s.games : 0);
        let composite: number | null = null;
        let statLine: string | undefined;
        const usage: Candidate['usage'] = {};
        if (pos === 'QB') {
          if (s.dropbacks >= 40) {
            composite = s.passEpa / s.dropbacks + (s.cpoeN ? s.cpoe / s.cpoeN : 0) / 40;
            statLine = `${r2(s.passEpa / s.dropbacks)} EPA/dropback · ${s.cpoeN ? (s.cpoe / s.cpoeN).toFixed(1) : '—'} CPOE · ${s.dropbacks} dropbacks`;
          }
        } else if (pos === 'RB') {
          if (s.rushAtt + s.targets >= 30) {
            composite = perSeason(s.rushEpa + s.recEpa) + (s.rushAtt ? (s.rushYds / s.rushAtt - 4.8) * 3 : 0);
            statLine = `${s.rushAtt ? (s.rushYds / s.rushAtt).toFixed(1) : '—'} YPC · ${r2(perSeason(s.rushEpa + s.recEpa))} EPA/season`;
          }
        } else if (pos === 'WR' || pos === 'TE') {
          if (s.targets >= 12) {
            const effShrunk = (s.recEpa + 40 * 0.15) / (s.targets + 40);
            composite = perSeason(s.recEpa) * 0.6 + effShrunk * 60 * 0.4 + perSeason(s.targets) * 0.03;
            statLine = `${r2(s.recEpa / s.targets)} EPA/target on ${Math.round(perSeason(s.targets))} tgt/season`;
          }
        } else if (pos === 'EDGE' || pos === 'DT') {
          if (s.sacks + s.ffs > 0 && s.games >= 3) {
            composite = perGame(s.sacks) * 10 + perGame(s.ffs) * 4;
            usage.prwr = r3(clamp(0.07 + perGame(s.sacks) * 0.16 + perGame(s.ffs) * 0.05, 0.05, 0.32));
            statLine = `${perGame(s.sacks).toFixed(2)} sacks/g · ${s.ffs} FF in ${s.games} g`;
          }
        } else if (pos === 'LB') {
          if (s.games >= 3 && s.sacks + s.pbus + s.ints + s.ffs > 0) {
            composite = perGame(s.sacks * 1.2 + s.pbus * 0.8 + s.ints * 1.5 + s.ffs) * 10;
            statLine = `${s.sacks} sacks · ${s.pbus} PBU · ${s.ints} INT in ${s.games} g`;
          }
        } else if (pos === 'CB' || pos === 'NCB' || pos === 'S') {
          if (s.games >= 3 && s.pbus + s.ints + s.ffs >= 2) {
            composite = perGame(s.pbus + s.ints * 2 + s.ffs * 0.5) * 10;
            statLine = `${s.pbus} PBU · ${s.ints} INT in ${s.games} g`;
          }
        } else if (pos === 'K') {
          if (s.fgAtt >= 5) { composite = s.fgMade / s.fgAtt; statLine = `${s.fgMade}/${s.fgAtt} FG`; }
        }
        const snapPct = SNAP[pos][kept] ?? 0.3;
        // Usage metrics for receivers (share of the team's passes; TPRR ≈ targets / routes, routes ≈ dropbacks × snap share).
        if (pos === 'WR' || pos === 'TE' || pos === 'RB') {
          const useCur = gp >= 3 && cur && cur.team === t.espnId;
          const acc = useCur ? cur : prior;
          const tp = (x?: TeamAcc) => x?.passPlays ?? 0;
          const db = (x?: TeamAcc) => x?.dropbacks ?? 0;
          const teamAcc = useCur ? teamCur : acc ? (acc.team === t.espnId ? teamPrior : ctx.prior?.teams.get(acc.team)) : undefined;
          if (acc && tp(teamAcc) > 40) {
            usage.targetShare = r3(clamp(acc.targets / tp(teamAcc), 0, 0.4));
            usage.tprr = r3(clamp(acc.targets / Math.max(1, db(teamAcc) * snapPct), 0.04, 0.4));
          } else {
            usage.targetShare = role === 'starter' ? (pos === 'WR' ? 0.16 : 0.1) : 0.06;
            usage.tprr = role === 'starter' ? 0.18 : 0.14;
          }
        }
        candidates.push({ team: t, pos, role, athleteId: entry.athleteId, name: entry.name || rr?.name || 'Unknown', roster: rr, composite, usage, snapPct: r2(snapPct), statLine, fromDepthChart: !!depth?.length });
        kept++;
      }
    }
  }

  // Percentile grades within each position across FBS.
  const pops = new Map<Position, number[]>();
  for (const c of candidates) if (c.composite !== null) (pops.get(c.pos) ?? pops.set(c.pos, []).get(c.pos)!).push(c.composite);
  const gradeOf = (c: Candidate): number => {
    const talent = c.team.talent ?? 5.5;
    if (c.pos === 'LT' || c.pos === 'OL') return Math.round(clamp(55 + ((c.team.offense.pbwr - 0.45) / 0.3) * 35, 50, 92) - (c.role === 'starter' ? 0 : 8));
    if (c.composite !== null) {
      const p = percentile(c.composite, pops.get(c.pos) ?? []);
      return Math.round(clamp(42 + p * 0.55, 40, 97));
    }
    const yr = Number(c.roster?.year) || 1;
    return Math.round(clamp(50 + yr * 2 + (talent - 5.5) * 4 + (c.role === 'starter' ? 3 : 0), 42, 80));
  };
  const statusOf = (c: Candidate): { reported?: InjuryStatus; reportNote?: string } => {
    const e = injByTeam.get(c.team.espnId)?.get(nameKey(c.name));
    if (!e) return {};
    const st = e.status.toLowerCase();
    if (st.includes('out') || st.includes('injured') || st.includes('doubtful') || st.includes('season')) return { reported: 'out', reportNote: `${e.detail || 'Injury'} · ${e.status}` };
    if (st.includes('questionable') || st.includes('day-to-day') || st.includes('probable')) return { reported: 'questionable', reportNote: `${e.detail || 'Injury'} · ${e.status}` };
    return {};
  };

  const byTeam = new Map<string, Player[]>();
  const qbRating = new Map<string, number>();
  const teSpeed = new Map<string, number>();
  const qbPop = pops.get('QB') ?? [];
  const tePop = pops.get('TE') ?? [];
  for (const c of candidates) {
    const player: Player = {
      id: `${c.team.id}-${c.athleteId}`,
      name: c.name,
      pos: c.pos,
      role: c.role,
      rating: gradeOf(c),
      snapPct: c.snapPct,
      ...c.usage,
      ...(c.pos === 'LT' || c.pos === 'OL' ? { pbwr: r3(clamp(c.team.offense.pbwr + 0.25, 0.7, 0.97)) } : {}),
      ...(c.statLine ? { note: c.statLine } : c.fromDepthChart ? {} : { note: c.pos === 'OL' ? 'roster listing · line usage not tracked' : 'no production yet · roster order by class' }),
      ...statusOf(c),
      ...(c.roster?.headshot_url ? { headshotUrl: c.roster.headshot_url } : {}),
      ...(Number.isFinite(Number(c.roster?.year)) && Number(c.roster?.year) > 0 ? { classYear: Number(c.roster!.year) } : {}),
    };
    (byTeam.get(c.team.id) ?? byTeam.set(c.team.id, []).get(c.team.id)!).push(player);
    if (c.pos === 'QB' && c.role === 'starter' && c.composite !== null) qbRating.set(c.team.id, r2(clamp(2.5 + (percentile(c.composite, qbPop) / 100) * 7.5, 1, 10)));
    if (c.pos === 'TE' && c.role === 'starter' && c.composite !== null) teSpeed.set(c.team.id, r2(clamp(3 + (percentile(c.composite, tePop) / 100) * 6.5, 1, 10)));
  }
  for (const [, list] of byTeam) list.sort((a, b) => POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos) || (a.role === b.role ? b.rating - a.rating : a.role === 'starter' ? -1 : b.role === 'starter' ? 1 : a.role === 'rotational' ? -1 : 1));
  return { byTeam, qbRating, teSpeed, depthChartTeams };
}

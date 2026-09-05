/**
 * Turn play-by-play aggregates, Elo and schedule metadata into the engine's
 * Team profiles. Measurable things are measured; the few things no free
 * source exposes (coverage family, base front, play-action rate) come from
 * the curated baseline and are flagged in meta notes.
 */
import type { Team, OffensiveScheme, DefensiveFront } from '../../src/engine/types';
import { deriveSchemeMatrices, FRONTS, talentFromElo } from '../../src/data/teams';
import type { TeamAcc, HalfSplit } from '../sources/sdvpbp';
import { blendWeight, gamesPlayed, talentWeight, type BuildCtx } from './context';
import { clamp, mean, percentile, r1, r2, r3, rateAmong, sd, shrink } from '../lib/util';

export interface Metrics {
  epaPlay: number; passEpa: number; rushEpa: number; success: number; explosive: number; earlyPass: number; thirdConv: number; fourthGo: number; fourthOpp: number;
  rzTd: number; pace: number; pressureAllowed: number; adot: number; shortTgtEpa: number; qbRunShare: number; offAdjust: number;
  dEpa: number; dPassEpa: number; dRushEpa: number; dExplosive: number; dThirdStop: number; pressure: number; havoc: number; takeaways: number; dTeRbEpa: number; dShortWrEpa: number; defAdjust: number;
  vs425: number; vs43: number; vs335: number; vs34: number; vsMultiple: number;
}

const halfAdjust = (m: Map<string, HalfSplit>, sign: 1 | -1) => {
  const diffs: number[] = [];
  for (const h of m.values()) if (h.n1 >= 10 && h.n2 >= 10) diffs.push(sign * (h.h2 / h.n2 - h.h1 / h.n1));
  return diffs.length ? mean(diffs) : NaN;
};

export function metrics(a: TeamAcc | undefined): Metrics | null {
  if (!a || a.plays < 60) return null;
  const g = a.games.size || 1;
  const div = (n: number, d: number) => (d > 0 ? n / d : NaN);
  return {
    epaPlay: div(a.epa, a.plays), passEpa: div(a.passEpa, a.passPlays), rushEpa: div(a.rushEpa, a.rushPlays), success: div(a.success, a.plays), explosive: div(a.explosive, a.plays),
    earlyPass: div(a.earlyPass, a.earlyDowns), thirdConv: div(a.thirdConv, a.thirdAtt), fourthGo: div(a.fourthGo, a.fourthOpp), fourthOpp: a.fourthOpp,
    rzTd: div(a.rzTd, a.rzTrips.size), pace: a.plays / g, pressureAllowed: div(a.pressuresAllowed, a.dropbacks), adot: div(a.airYards, a.airN),
    shortTgtEpa: div(a.shortTgtEpa, a.shortTgtN), qbRunShare: div(a.qbRushes, a.rushPlays), offAdjust: halfAdjust(a.offHalf, 1),
    dEpa: div(a.dEpa, a.dPlays), dPassEpa: div(a.dPassEpa, a.dPassPlays), dRushEpa: div(a.dRushEpa, a.dRushPlays), dExplosive: div(a.dExplosive, a.dPlays),
    dThirdStop: 1 - div(a.dThirdConv, a.dThirdAtt), pressure: div(a.pressures, a.dDropbacks), havoc: div(a.havoc, a.dPlays), takeaways: a.takeaways / g,
    dTeRbEpa: div(a.dTeRbTgtEpa, a.dTeRbTgtN), dShortWrEpa: div(a.dShortWrTgtEpa, a.dShortWrTgtN), defAdjust: halfAdjust(a.defHalf, -1),
    vs425: div(a.vsFront['4-2-5'].epa, a.vsFront['4-2-5'].n), vs43: div(a.vsFront['4-3'].epa, a.vsFront['4-3'].n), vs335: div(a.vsFront['3-3-5'].epa, a.vsFront['3-3-5'].n),
    vs34: div(a.vsFront['3-4'].epa, a.vsFront['3-4'].n), vsMultiple: div(a.vsFront.Multiple.epa, a.vsFront.Multiple.n),
  };
}

/** Blend current and prior season metrics with a games-played weight. */
export function blend(cur: Metrics | null, prior: Metrics | null, w: number): Metrics | null {
  if (!cur && !prior) return null;
  if (!cur) return prior;
  if (!prior) return cur;
  const out = {} as Metrics;
  for (const k of Object.keys(cur) as (keyof Metrics)[]) {
    const c = cur[k];
    const p = prior[k];
    out[k] = !Number.isFinite(c) ? p : !Number.isFinite(p) ? c : w * c + (1 - w) * p;
  }
  return out;
}

/** League-relative scheme label from measured tendencies (percentile ranks keep labels balanced whatever the baseline). */
export function classifyScheme(m: Metrics, pct: (k: keyof Metrics, v: number) => number, fallback: OffensiveScheme): OffensiveScheme {
  if (!Number.isFinite(m.earlyPass)) return fallback;
  const pass = pct('earlyPass', m.earlyPass);
  const adot = Number.isFinite(m.adot) ? pct('adot', m.adot) : 50;
  const qbRun = Number.isFinite(m.qbRunShare) ? pct('qbRunShare', m.qbRunShare) : 50;
  const pace = Number.isFinite(m.pace) ? pct('pace', m.pace) : 50;
  if (pass <= 12 && qbRun >= 60 && (fallback === 'Triple Option' || m.qbRunShare >= 0.3)) return 'Triple Option';
  if (pass >= 78 && adot >= 65) return 'Vertical';
  if (pass >= 78) return 'Air Raid';
  if (pass <= 22) return 'Power Run';
  if (qbRun >= 72 && pass >= 30) return 'RPO Spread';
  if (pace >= 78) return 'Tempo Spread';
  if (pass <= 40 && adot >= 55) return 'Wide Zone';
  if (pass <= 45) return 'Pro Style';
  return 'Spread';
}

/** Base front from an ESPN depth chart group name when present ("Base 3-4 D", "4-2-5 Defense"…). */
export function detectFront(depthRows: { group: string; pos_abb: string }[] | undefined, fallback: DefensiveFront): DefensiveFront {
  if (!depthRows?.length) return fallback;
  const names = [...new Set(depthRows.map((r) => r.group))].join(' ');
  if (/4-2-5/.test(names)) return '4-2-5';
  if (/3-3-5/.test(names)) return '3-3-5';
  if (/3-4/.test(names)) return '3-4';
  if (/4-3/.test(names)) return '4-3';
  // Infer from the defensive slots: two DTs + two DEs + two LBs ⇒ 4-2-5; one NT + three LBs ⇒ 3-3-5.
  const abbs = depthRows.map((r) => r.pos_abb);
  const n = (re: RegExp) => new Set(abbs.filter((a) => re.test(a))).size;
  const dl = n(/^(LDE|RDE|DE|LDT|RDT|DT|NT|EDGE)$/);
  const lb = n(/^(WLB|MLB|SLB|LILB|RILB|LB|ILB|OLB|MIKE|WILL|SAM|JACK)$/);
  if (dl >= 4 && lb <= 2) return '4-2-5';
  if (dl >= 4) return '4-3';
  if (dl === 3 && lb >= 3 && abbs.some((a) => a === 'NB' || a === 'NICKEL')) return '3-3-5';
  if (dl === 3) return '3-4';
  return fallback;
}

export interface TeamBuild { team: Team; metrics: Metrics | null; gp: number; }

export function buildTeams(ctx: BuildCtx, qbRating: (id: string) => number | undefined, teSpeed: (id: string) => number | undefined): TeamBuild[] {
  const league: Record<string, number[]> = {};
  const perTeam = ctx.baseline.map((b) => {
    const gp = gamesPlayed(ctx.cur, b.espnId);
    const m = blend(metrics(ctx.cur?.teams.get(b.espnId)), metrics(ctx.prior?.teams.get(b.espnId)), blendWeight(gp));
    if (m) for (const k of Object.keys(m) as (keyof Metrics)[]) (league[k] ??= []).push(m[k]);
    return { b, gp, m };
  });
  const L = (k: keyof Metrics) => league[k] ?? [];
  const lm = (k: keyof Metrics) => mean(L(k).filter(Number.isFinite));
  const pct = (k: keyof Metrics, v: number) => percentile(v, L(k));
  const elos = ctx.baseline.map((b) => ctx.elo.get(b.espnId)).filter((e): e is number => Number.isFinite(e as number));
  const eloMean = mean(elos);
  const eloSd = sd(elos);

  return perTeam.map(({ b, gp, m }) => {
    const elo = ctx.elo.get(b.espnId) ?? b.elo;
    const talent = talentFromElo(elo, eloMean, eloSd);
    const rank = ctx.ranks.get(b.espnId);
    const base: Team = { ...b, talent, elo: elo ?? undefined, rank, stadium: { ...b.stadium } };
    if (!m) {
      ctx.notes.push(`${b.abbr}: no play-by-play available — Elo-seeded baseline ratings.`);
      return { team: base, metrics: null, gp };
    }
    // Every unit rating is a blend of the measured metric and the program's Elo-derived talent level;
    // the talent share shrinks as the current season accumulates games.
    const tw = talentWeight(gp);
    const T = (metric: number) => r1(clamp(metric * (1 - tw) + talent * tw, 1, 10));
    const qb = qbRating(b.id);
    const passEff = T(rateAmong(m.passEpa, L('passEpa')));
    const rushEff = T(rateAmong(m.rushEpa, L('rushEpa')));
    const qbFinal = r2(clamp((qb ?? talent) * (1 - tw * 0.6) + talent * tw * 0.6, 1, 10));
    const offScheme = classifyScheme(m, pct, b.coaching.offScheme);
    const defFront = detectFront(ctx.depth.get(b.espnId), b.coaching.defFront);
    const vsFrontMeasured: Partial<Record<DefensiveFront, number>> = {};
    const frontKey: Record<DefensiveFront, keyof Metrics> = { '4-2-5': 'vs425', '4-3': 'vs43', '3-3-5': 'vs335', '3-4': 'vs34', Multiple: 'vsMultiple' };
    for (const f of FRONTS) if (Number.isFinite(m[frontKey[f]]) && L(frontKey[f]).filter(Number.isFinite).length >= 8) vsFrontMeasured[f] = T(rateAmong(m[frontKey[f]], L(frontKey[f])));
    const { vsFront, vsCoverage } = deriveSchemeMatrices(offScheme, passEff, rushEff, qbFinal, { vsFront: vsFrontMeasured });

    const fourthGo = shrink(m.fourthGo, lm('fourthGo'), m.fourthOpp, 8);
    const adjust = rateAmong((Number.isFinite(m.offAdjust) ? m.offAdjust : 0) + (Number.isFinite(m.defAdjust) ? m.defAdjust : 0), L('offAdjust').map((v, i) => (Number.isFinite(v) ? v : 0) + (Number.isFinite(L('defAdjust')[i]) ? L('defAdjust')[i] : 0)), { spread: 1.2 });
    const shrinkN = gp + 13 * (1 - blendWeight(gp));

    const team: Team = {
      ...base,
      coaching: {
        ...b.coaching,
        offScheme,
        defFront,
        thirdDownOff: r3(Number.isFinite(m.thirdConv) ? m.thirdConv : b.coaching.thirdDownOff),
        thirdDownDef: r3(Number.isFinite(m.dThirdStop) ? m.dThirdStop : b.coaching.thirdDownDef),
        fourthDownGoRate: r3(clamp(fourthGo, 0.05, 0.95)),
        redZoneTd: r3(Number.isFinite(m.rzTd) ? m.rzTd : b.coaching.redZoneTd),
        redZoneAggression: r1(clamp(rateAmong(fourthGo, L('fourthGo')) * 0.6 + rateAmong(m.rzTd, L('rzTd')) * 0.4, 1, 10)),
        halftimeAdjust: r1(shrink(adjust, 5.5, shrinkN, 10)),
        passRate: r3(Number.isFinite(m.earlyPass) ? m.earlyPass : b.coaching.passRate),
        pace: r1(Number.isFinite(m.pace) ? m.pace : b.coaching.pace),
        qbRunShare: r3(Number.isFinite(m.qbRunShare) ? m.qbRunShare : b.coaching.qbRunShare ?? 0.12),
      },
      offense: {
        passEfficiency: passEff,
        rushEfficiency: rushEff,
        explosiveness: T(rateAmong(m.explosive, L('explosive'))),
        qb: qbFinal,
        pbwr: r3(clamp(0.82 - (Number.isFinite(m.pressureAllowed) ? m.pressureAllowed : 0.14) * 1.6 + (talent - 5.5) * 0.01, 0.45, 0.75)),
        slotEfficiency: T(rateAmong(m.shortTgtEpa, L('shortTgtEpa'))),
        teSpeed: r1(clamp((teSpeed(b.id) ?? 5.0) * 0.8 + talent * 0.2, 1, 10)),
        vsFront,
        vsCoverage,
      },
      defense: {
        passDefense: T(rateAmong(m.dPassEpa, L('dPassEpa'), { invert: true })),
        rushDefense: T(rateAmong(m.dRushEpa, L('dRushEpa'), { invert: true })),
        prwr: r3(clamp(0.26 + (Number.isFinite(m.pressure) ? m.pressure : 0.14) * 1.3 + (talent - 5.5) * 0.01, 0.3, 0.6)),
        nickelCorner: T(rateAmong(m.dShortWrEpa, L('dShortWrEpa'), { invert: true })),
        lbCoverage: T(rateAmong(m.dTeRbEpa, L('dTeRbEpa'), { invert: true })),
        secondaryAdjust: r1(shrink(rateAmong(m.defAdjust, L('defAdjust'), { spread: 1.2 }), 5.5, shrinkN, 10)),
        // Blitz rate is not charted for college; the havoc rate is the closest public tell of an attacking defence.
        blitzRate: r3(clamp(0.18 + (Number.isFinite(m.havoc) ? m.havoc : 0.15) * 0.9, 0.15, 0.45)),
        takeaways: T(rateAmong(m.takeaways, L('takeaways'))),
      },
      players: [], // filled by players.ts
    };
    return { team, metrics: m, gp };
  });
}

export const roundMetrics = (m: Metrics | null) => (m ? Object.fromEntries(Object.entries(m).map(([k, v]) => [k, Number.isFinite(v) ? r3(v) : null])) : null);

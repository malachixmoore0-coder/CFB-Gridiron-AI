/**
 * Baseline FBS dataset for CFB GRIDIRON-AI.
 *
 * Team identities, conferences, stadiums, capacities and coordinates come from
 * the generated ./fbs.ts (CollegeFootballData). Scheme labels, fronts,
 * coverage families, crowd-noise bumps and rivalries are curated estimates in
 * ./curated.ts. Unit ratings here are seeded from each program's latest Elo
 * so the fallback is not flat; the live pipeline replaces them with measured
 * play-by-play numbers and fills in the depth charts.
 */
import type { BaseCoverage, Conference, DefensiveFront, OffensiveScheme, Team } from '../engine/types';
import { FBS_TEAMS, type FbsTeamIdentity } from './fbs';
import { CURATED, rivalsOf } from './curated';

export const CONFERENCE_ORDER: Conference[] = [
  'SEC', 'Big Ten', 'Big 12', 'ACC', 'FBS Independents',
  'American Athletic', 'Mountain West', 'Pac-12', 'Sun Belt', 'Mid-American', 'Conference USA',
];

export const CONFERENCE_SHORT: Record<Conference, string> = {
  SEC: 'SEC', 'Big Ten': 'B1G', 'Big 12': 'Big 12', ACC: 'ACC', 'FBS Independents': 'Ind',
  'American Athletic': 'AAC', 'Mountain West': 'MWC', 'Pac-12': 'Pac-12', 'Sun Belt': 'SBC', 'Mid-American': 'MAC', 'Conference USA': 'CUSA',
};

export const asConference = (c: string): Conference => (CONFERENCE_ORDER.includes(c as Conference) ? (c as Conference) : 'FBS Independents');

/** How each offensive scheme family tends to fare against fronts and coverages (rating deltas). */
const SCHEME_BIAS: Record<OffensiveScheme, { front: Record<DefensiveFront, number>; cov: Record<BaseCoverage, number> }> = {
  'Air Raid':      { front: { '4-2-5': 0.1, '4-3': 0.2, '3-3-5': -0.2, '3-4': 0.3, Multiple: -0.3 }, cov: { 'Cover-1': 0.3, 'Cover-2': -0.4, 'Cover-3': 0.3, Quarters: -0.3, 'Cover-2 Man': -0.2 } },
  'Spread':        { front: { '4-2-5': 0.0, '4-3': 0.2, '3-3-5': -0.1, '3-4': 0.2, Multiple: -0.2 }, cov: { 'Cover-1': 0.2, 'Cover-2': -0.3, 'Cover-3': 0.2, Quarters: -0.1, 'Cover-2 Man': -0.2 } },
  'RPO Spread':    { front: { '4-2-5': 0.2, '4-3': 0.2, '3-3-5': -0.2, '3-4': 0.0, Multiple: -0.3 }, cov: { 'Cover-1': 0.1, 'Cover-2': 0.2, 'Cover-3': 0.3, Quarters: -0.3, 'Cover-2 Man': -0.1 } },
  'Tempo Spread':  { front: { '4-2-5': 0.1, '4-3': 0.1, '3-3-5': 0.0, '3-4': 0.3, Multiple: -0.4 }, cov: { 'Cover-1': 0.2, 'Cover-2': -0.1, 'Cover-3': 0.3, Quarters: -0.2, 'Cover-2 Man': -0.2 } },
  'Pro Style':     { front: { '4-2-5': 0.2, '4-3': 0.0, '3-3-5': 0.3, '3-4': 0.0, Multiple: -0.1 }, cov: { 'Cover-1': -0.1, 'Cover-2': 0.3, 'Cover-3': 0.2, Quarters: 0.1, 'Cover-2 Man': -0.2 } },
  'Wide Zone':     { front: { '4-2-5': 0.3, '4-3': 0.4, '3-3-5': 0.2, '3-4': -0.2, Multiple: 0.0 }, cov: { 'Cover-1': 0.2, 'Cover-2': -0.2, 'Cover-3': 0.3, Quarters: -0.3, 'Cover-2 Man': 0.0 } },
  'Power Run':     { front: { '4-2-5': 0.4, '4-3': 0.2, '3-3-5': 0.5, '3-4': -0.3, Multiple: 0.0 }, cov: { 'Cover-1': -0.1, 'Cover-2': 0.4, 'Cover-3': 0.0, Quarters: 0.3, 'Cover-2 Man': 0.2 } },
  'Triple Option': { front: { '4-2-5': 0.5, '4-3': 0.3, '3-3-5': 0.4, '3-4': -0.2, Multiple: -0.3 }, cov: { 'Cover-1': 0.2, 'Cover-2': 0.3, 'Cover-3': 0.1, Quarters: 0.4, 'Cover-2 Man': 0.4 } },
  'Vertical':      { front: { '4-2-5': 0.0, '4-3': 0.0, '3-3-5': -0.1, '3-4': 0.1, Multiple: -0.1 }, cov: { 'Cover-1': 0.4, 'Cover-2': -0.4, 'Cover-3': 0.3, Quarters: -0.4, 'Cover-2 Man': -0.1 } },
};

export const FRONTS: DefensiveFront[] = ['4-2-5', '4-3', '3-3-5', '3-4', 'Multiple'];
export const COVERAGES: BaseCoverage[] = ['Cover-1', 'Cover-2', 'Cover-3', 'Quarters', 'Cover-2 Man'];

const c10 = (v: number) => Math.min(10, Math.max(1, Math.round(v * 10) / 10));

/**
 * Derive the offense-vs-front and offense-vs-coverage matrices from a scheme
 * label and headline ratings. Shared with the live-data pipeline, which can
 * measure production vs fronts directly but not vs coverage families.
 */
export function deriveSchemeMatrices(
  offScheme: OffensiveScheme,
  pass: number,
  rush: number,
  qb: number,
  overrides?: { vsFront?: Partial<Record<DefensiveFront, number>>; vsCoverage?: Partial<Record<BaseCoverage, number>> },
): { vsFront: Record<DefensiveFront, number>; vsCoverage: Record<BaseCoverage, number> } {
  const bias = SCHEME_BIAS[offScheme];
  const base = pass * 0.55 + rush * 0.45;
  const qbLift = (qb - 5.5) * 0.3;
  const vsFront = Object.fromEntries(FRONTS.map((f) => [f, c10(overrides?.vsFront?.[f] ?? base + bias.front[f])])) as Record<DefensiveFront, number>;
  const vsCoverage = Object.fromEntries(COVERAGES.map((k) => [k, c10(overrides?.vsCoverage?.[k] ?? base + bias.cov[k] + qbLift)])) as Record<BaseCoverage, number>;
  return { vsFront, vsCoverage };
}

/** Crowd noise 1-10 from capacity plus the curated reputation bump. */
export function noiseFor(capacity: number, bump = 0): number {
  return c10(2.5 + capacity / 16000 + bump);
}

/** League default play-action rate — college play-by-play is not charted for it. */
export const DEFAULT_PLAY_ACTION = 0.24;

const elos = FBS_TEAMS.map((t) => t.elo).filter((e): e is number => e !== null);
const eloMean = elos.reduce((a, b) => a + b, 0) / Math.max(1, elos.length);
const eloSd = Math.sqrt(elos.reduce((s, e) => s + (e - eloMean) ** 2, 0) / Math.max(1, elos.length - 1)) || 1;
/** Program-strength rating 1-10 from an Elo figure (5.5 = FBS average, 1.6 points per SD). */
export const talentFromElo = (elo: number | null | undefined, mean = eloMean, sd = eloSd) =>
  elo === null || elo === undefined || !Number.isFinite(elo) ? 5.5 : c10(5.5 + ((elo - mean) / sd) * 1.6);

export function baselineTeam(t: FbsTeamIdentity): Team {
  const cur = CURATED[t.id] ?? {};
  const talent = talentFromElo(t.elo);
  const offScheme = cur.scheme ?? 'Spread';
  // Seed every unit near the program's talent level so the fallback is not flat.
  const r = (k: number) => c10(5.5 + (talent - 5.5) * k);
  const { vsFront, vsCoverage } = deriveSchemeMatrices(offScheme, r(0.9), r(0.8), r(1), {});
  return {
    id: t.id,
    espnId: t.espnId,
    abbr: t.abbr,
    school: t.school,
    mascot: t.mascot,
    conference: asConference(t.conference),
    colors: { primary: t.colors[0], secondary: t.colors[1] },
    stadium: { name: t.stadium.name, city: t.stadium.city, dome: t.stadium.dome, noise: noiseFor(t.stadium.capacity, cur.noiseBump), altitudeFt: t.stadium.altitudeFt, capacity: t.stadium.capacity, lat: t.stadium.lat, lng: t.stadium.lng },
    coaching: {
      offScheme,
      defFront: cur.front ?? '4-2-5',
      baseCoverage: cur.coverage ?? 'Quarters',
      thirdDownOff: Math.round((0.32 + (talent - 1) * 0.02) * 1000) / 1000,
      thirdDownDef: Math.round((0.54 + (talent - 1) * 0.018) * 1000) / 1000,
      fourthDownGoRate: 0.5,
      redZoneTd: Math.round((0.5 + (talent - 5.5) * 0.02) * 1000) / 1000,
      redZoneAggression: 5.5,
      halftimeAdjust: 5.5,
      playActionRate: cur.playAction ?? DEFAULT_PLAY_ACTION,
      passRate: offScheme === 'Triple Option' ? 0.2 : offScheme === 'Air Raid' ? 0.62 : offScheme === 'Power Run' ? 0.4 : 0.5,
      pace: 70,
      qbRunShare: offScheme === 'Triple Option' ? 0.35 : 0.12,
    },
    offense: { passEfficiency: r(0.9), rushEfficiency: r(0.8), explosiveness: r(0.8), qb: r(1), pbwr: Math.round((0.6 + (talent - 5.5) * 0.02) * 1000) / 1000, slotEfficiency: r(0.7), teSpeed: r(0.5), vsFront, vsCoverage },
    defense: { passDefense: r(0.85), rushDefense: r(0.85), prwr: Math.round((0.45 + (talent - 5.5) * 0.02) * 1000) / 1000, nickelCorner: r(0.7), lbCoverage: r(0.7), secondaryAdjust: 5.5, blitzRate: 0.3, takeaways: r(0.5) },
    players: [],
    rivals: rivalsOf(t.id),
    logoUrl: t.logoUrl,
    elo: t.elo ?? undefined,
    talent,
  };
}

export const TEAMS: Team[] = FBS_TEAMS.map(baselineTeam);

export const TEAM_BY_ID: Record<string, Team> = Object.fromEntries(TEAMS.map((t) => [t.id, t]));
export const getTeam = (id: string): Team => {
  const t = TEAM_BY_ID[id];
  if (!t) throw new Error(`Unknown team id: ${id}`);
  return t;
};

export interface ConferenceGroup { conference: Conference; teams: Team[]; }
export const groupByConference = (teams: Team[]): ConferenceGroup[] =>
  CONFERENCE_ORDER.map((conference) => ({ conference, teams: teams.filter((t) => t.conference === conference).sort((a, b) => a.school.localeCompare(b.school)) })).filter((g) => g.teams.length > 0);

export const CONFERENCES: ConferenceGroup[] = groupByConference(TEAMS);

/**
 * Hand-curated judgement calls for FBS programs — the things no free feed
 * exposes. Everything here is an ESTIMATE written to be plausible for the
 * 2026 season, not a measured fact: coverage families and base fronts are
 * scouting shorthand, noise bumps reflect reputation more than decibels, and
 * rivalries are the trophy / in-state games that carry extra variance.
 *
 * Teams not listed fall back to the most common college defaults (4-2-5
 * front, Quarters coverage, Spread offense) and a capacity-derived noise
 * figure. Anything measured by the pipeline (pass rate, pace, efficiency,
 * scheme classification) overrides the scheme label below once games exist.
 */
import type { BaseCoverage, DefensiveFront, OffensiveScheme } from '../engine/types';

export interface CuratedTeam {
  scheme?: OffensiveScheme;
  front?: DefensiveFront;
  coverage?: BaseCoverage;
  /** Added to the capacity-derived crowd-noise figure (1-10 scale). */
  noiseBump?: number;
  /** Curated play-action rate when known to be unusual (league default 0.24). */
  playAction?: number;
}

export const CURATED: Record<string, CuratedTeam> = {
  // ── SEC ──────────────────────────────────────────────────────────────
  alabama: { scheme: 'Pro Style', front: '3-4', coverage: 'Cover-1', noiseBump: 0.6 },
  arkansas: { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.5 },
  auburn: { scheme: 'Spread', front: '4-2-5', coverage: 'Quarters', noiseBump: 0.7 },
  florida: { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.6 },
  georgia: { scheme: 'Pro Style', front: '3-4', coverage: 'Quarters', noiseBump: 0.6 },
  kentucky: { scheme: 'Pro Style', front: '3-4', coverage: 'Quarters', noiseBump: 0.4 },
  lsu: { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-1', noiseBump: 1.2 },
  'mississippi-state': { scheme: 'Air Raid', front: '4-2-5', coverage: 'Cover-3', noiseBump: 1.2 },
  missouri: { scheme: 'Spread', front: '4-2-5', coverage: 'Quarters', noiseBump: 0.4 },
  oklahoma: { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.5 },
  'ole-miss': { scheme: 'Tempo Spread', front: '4-2-5', coverage: 'Cover-1', noiseBump: 0.5 },
  'south-carolina': { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: 1.0 },
  tennessee: { scheme: 'Tempo Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.7 },
  texas: { scheme: 'Pro Style', front: '4-2-5', coverage: 'Quarters', noiseBump: 0.5 },
  'texas-am': { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: 1.2 },
  vanderbilt: { scheme: 'RPO Spread', front: '3-3-5', coverage: 'Cover-3', noiseBump: 0.2 },
  // ── Big Ten ──────────────────────────────────────────────────────────
  illinois: { scheme: 'Pro Style', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.2 },
  indiana: { scheme: 'Spread', front: '4-2-5', coverage: 'Quarters', noiseBump: 0.4 },
  iowa: { scheme: 'Pro Style', front: '4-3', coverage: 'Cover-2', noiseBump: 1.0 },
  maryland: { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3' },
  michigan: { scheme: 'Pro Style', front: '4-2-5', coverage: 'Cover-1', noiseBump: 0.2 },
  'michigan-state': { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3' },
  minnesota: { scheme: 'Pro Style', front: '4-2-5', coverage: 'Quarters', noiseBump: 0.2 },
  nebraska: { scheme: 'Spread', front: '3-3-5', coverage: 'Quarters', noiseBump: 0.6 },
  northwestern: { scheme: 'Pro Style', front: '4-3', coverage: 'Quarters', noiseBump: 0.3 },
  'ohio-state': { scheme: 'Pro Style', front: '4-2-5', coverage: 'Cover-1', noiseBump: 0.6 },
  oregon: { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: 2.0 },
  'penn-state': { scheme: 'Pro Style', front: '4-3', coverage: 'Cover-3', noiseBump: 1.0 },
  purdue: { scheme: 'Spread', front: '4-2-5', coverage: 'Quarters' },
  rutgers: { scheme: 'Pro Style', front: '4-2-5', coverage: 'Cover-3' },
  ucla: { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: -1.0 },
  usc: { scheme: 'Air Raid', front: '4-2-5', coverage: 'Quarters', noiseBump: 0.2 },
  washington: { scheme: 'Spread', front: '4-2-5', coverage: 'Quarters', noiseBump: 1.0 },
  wisconsin: { scheme: 'Pro Style', front: '3-4', coverage: 'Quarters', noiseBump: 0.6 },
  // ── Big 12 ───────────────────────────────────────────────────────────
  arizona: { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3' },
  'arizona-state': { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.2 },
  baylor: { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3' },
  byu: { scheme: 'Pro Style', front: '4-2-5', coverage: 'Cover-3', noiseBump: 1.0 },
  cincinnati: { scheme: 'Spread', front: '4-2-5', coverage: 'Quarters', noiseBump: 0.4 },
  colorado: { scheme: 'Air Raid', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.5 },
  houston: { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3' },
  'iowa-state': { scheme: 'Pro Style', front: '3-3-5', coverage: 'Cover-3', noiseBump: 1.0 },
  kansas: { scheme: 'RPO Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.3 },
  'kansas-state': { scheme: 'RPO Spread', front: '4-2-5', coverage: 'Quarters', noiseBump: 0.6 },
  'oklahoma-state': { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.4 },
  tcu: { scheme: 'Spread', front: '3-3-5', coverage: 'Quarters', noiseBump: 0.2 },
  'texas-tech': { scheme: 'Air Raid', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.6 },
  ucf: { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.3 },
  utah: { scheme: 'Pro Style', front: '4-2-5', coverage: 'Cover-1', noiseBump: 1.5 },
  'west-virginia': { scheme: 'RPO Spread', front: '3-3-5', coverage: 'Cover-3', noiseBump: 0.5 },
  // ── ACC ──────────────────────────────────────────────────────────────
  'boston-college': { scheme: 'Pro Style', front: '4-2-5', coverage: 'Cover-3' },
  california: { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3' },
  clemson: { scheme: 'Spread', front: '4-3', coverage: 'Cover-1', noiseBump: 1.0 },
  duke: { scheme: 'Spread', front: '4-2-5', coverage: 'Quarters' },
  'florida-state': { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.5 },
  'georgia-tech': { scheme: 'Spread', front: '4-2-5', coverage: 'Quarters', noiseBump: 0.2 },
  louisville: { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.3 },
  miami: { scheme: 'Pro Style', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.2 },
  'nc-state': { scheme: 'Spread', front: '3-3-5', coverage: 'Cover-3', noiseBump: 0.4 },
  'north-carolina': { scheme: 'Pro Style', front: '4-2-5', coverage: 'Cover-3' },
  pittsburgh: { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-1', noiseBump: -0.4 },
  smu: { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.4 },
  stanford: { scheme: 'Pro Style', front: '4-2-5', coverage: 'Quarters', noiseBump: -0.5 },
  syracuse: { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.6 },
  virginia: { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3' },
  'virginia-tech': { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: 1.5 },
  'wake-forest': { scheme: 'RPO Spread', front: '4-2-5', coverage: 'Cover-3' },
  // ── Notre Dame / UConn ───────────────────────────────────────────────
  'notre-dame': { scheme: 'Pro Style', front: '4-2-5', coverage: 'Cover-1', noiseBump: 0.6 },
  uconn: { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3' },
  // ── Group of Five programs with a distinctive identity ───────────────
  army: { scheme: 'Triple Option', front: '3-4', coverage: 'Cover-3', noiseBump: 0.5, playAction: 0.35 },
  navy: { scheme: 'Triple Option', front: '3-4', coverage: 'Cover-3', noiseBump: 0.3, playAction: 0.35 },
  'air-force': { scheme: 'Triple Option', front: '3-4', coverage: 'Cover-3', noiseBump: 0.5, playAction: 0.35 },
  memphis: { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.5 },
  tulane: { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.5 },
  'south-florida': { scheme: 'Tempo Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: -0.5 },
  'north-texas': { scheme: 'Air Raid', front: '4-2-5', coverage: 'Cover-3' },
  'boise-state': { scheme: 'Pro Style', front: '4-2-5', coverage: 'Quarters', noiseBump: 1.6 },
  'fresno-state': { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.8 },
  'san-diego-state': { scheme: 'Pro Style', front: '3-3-5', coverage: 'Cover-3' },
  unlv: { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: -0.8 },
  'washington-state': { scheme: 'Air Raid', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.5 },
  'oregon-state': { scheme: 'Pro Style', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.3 },
  'colorado-state': { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.3 },
  'utah-state': { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.5 },
  'texas-state': { scheme: 'Tempo Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.3 },
  wyoming: { scheme: 'Pro Style', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.4 },
  'app-state': { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: 1.5 },
  'james-madison': { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: 1.2 },
  liberty: { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.4 },
  marshall: { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.3 },
  'coastal-carolina': { scheme: 'RPO Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.3 },
  troy: { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.3 },
  'georgia-southern': { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.4 },
  louisiana: { scheme: 'Pro Style', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.3 },
  toledo: { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.5 },
  'miami-oh': { scheme: 'Pro Style', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.2 },
  ohio: { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.2 },
  'western-michigan': { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3' },
  'north-dakota-state': { scheme: 'Pro Style', front: '4-2-5', coverage: 'Quarters', noiseBump: 1.5 },
  hawaii: { scheme: 'Air Raid', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.4 },
  'new-mexico': { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3' },
  utep: { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3' },
  'jacksonville-state': { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3', noiseBump: 0.3 },
  'sam-houston': { scheme: 'Spread', front: '4-2-5', coverage: 'Cover-3' },
  'western-kentucky': { scheme: 'Air Raid', front: '4-2-5', coverage: 'Cover-3' },
};

/**
 * Rivalry pairs — trophy games, in-state and conference grudge matches. Each
 * pair is symmetric; the engine raises variance and compresses the spread a
 * little when two rivals meet.
 */
export const RIVALRY_PAIRS: [string, string][] = [
  ['alabama', 'auburn'], ['alabama', 'tennessee'], ['alabama', 'lsu'], ['auburn', 'georgia'], ['georgia', 'florida'], ['georgia', 'georgia-tech'],
  ['florida', 'florida-state'], ['florida', 'tennessee'], ['florida-state', 'miami'], ['clemson', 'south-carolina'], ['clemson', 'florida-state'],
  ['ole-miss', 'mississippi-state'], ['lsu', 'ole-miss'], ['lsu', 'arkansas'], ['lsu', 'texas-am'], ['arkansas', 'missouri'], ['arkansas', 'texas'],
  ['texas', 'oklahoma'], ['texas', 'texas-am'], ['texas', 'texas-tech'], ['oklahoma', 'oklahoma-state'], ['kentucky', 'louisville'], ['kentucky', 'tennessee'],
  ['tennessee', 'vanderbilt'], ['missouri', 'kansas'], ['south-carolina', 'north-carolina'],
  ['ohio-state', 'michigan'], ['ohio-state', 'penn-state'], ['michigan', 'michigan-state'], ['michigan-state', 'penn-state'], ['iowa', 'iowa-state'],
  ['iowa', 'minnesota'], ['iowa', 'nebraska'], ['iowa', 'wisconsin'], ['minnesota', 'wisconsin'], ['illinois', 'northwestern'], ['indiana', 'purdue'],
  ['illinois', 'purdue'], ['maryland', 'rutgers'], ['usc', 'ucla'], ['usc', 'notre-dame'], ['oregon', 'washington'], ['oregon', 'oregon-state'],
  ['washington', 'washington-state'], ['stanford', 'california'], ['notre-dame', 'michigan'], ['notre-dame', 'stanford'], ['notre-dame', 'navy'],
  ['kansas', 'kansas-state'], ['utah', 'byu'], ['utah', 'colorado'], ['utah', 'utah-state'], ['byu', 'utah-state'], ['arizona', 'arizona-state'],
  ['tcu', 'baylor'], ['tcu', 'smu'], ['tcu', 'texas-tech'], ['baylor', 'texas-tech'], ['houston', 'rice'], ['cincinnati', 'louisville'], ['cincinnati', 'miami-oh'],
  ['west-virginia', 'pittsburgh'], ['west-virginia', 'marshall'], ['colorado', 'colorado-state'], ['colorado', 'nebraska'], ['iowa-state', 'kansas-state'],
  ['virginia', 'virginia-tech'], ['north-carolina', 'nc-state'], ['north-carolina', 'duke'], ['duke', 'wake-forest'], ['virginia-tech', 'west-virginia'],
  ['boston-college', 'syracuse'], ['georgia-tech', 'clemson'], ['louisville', 'kentucky'],
  ['army', 'navy'], ['army', 'air-force'], ['navy', 'air-force'], ['memphis', 'ole-miss'], ['tulane', 'lsu'], ['south-florida', 'ucf'], ['temple', 'rutgers'],
  ['east-carolina', 'nc-state'], ['north-texas', 'smu'], ['utsa', 'texas-state'], ['utep', 'new-mexico-state'], ['florida-international', 'florida-atlantic'],
  ['boise-state', 'fresno-state'], ['boise-state', 'nevada'], ['san-diego-state', 'fresno-state'], ['nevada', 'unlv'], ['wyoming', 'colorado-state'],
  ['old-dominion', 'james-madison'], ['georgia-state', 'georgia-southern'], ['app-state', 'georgia-southern'], ['troy', 'south-alabama'],
  ['louisiana', 'ul-monroe'], ['louisiana-tech', 'southern-miss'], ['arkansas-state', 'louisiana'], ['toledo', 'bowling-green'], ['ohio', 'miami-oh'],
  ['central-michigan', 'western-michigan'], ['akron', 'kent-state'], ['buffalo', 'akron'], ['ball-state', 'northern-illinois'], ['eastern-michigan', 'central-michigan'],
  ['middle-tennessee', 'western-kentucky'], ['liberty', 'james-madison'], ['jacksonville-state', 'sam-houston'], ['hawaii', 'san-jose-state'],
  ['new-mexico', 'new-mexico-state'], ['charlotte', 'app-state'], ['kennesaw-state', 'georgia-state'],
];

export const rivalsOf = (id: string): string[] => RIVALRY_PAIRS.filter(([a, b]) => a === id || b === id).map(([a, b]) => (a === id ? b : a));

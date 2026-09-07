/**
 * CFB Gridiron AI subscription ladder.
 *
 * The recruiting ladder, because college fans already think in it: Walk-On,
 * Scholarship, Blue Chip, Dynasty. Annual is sold as a Season Pass — college
 * betting is seasonal, and a pass that covers Week 0 through the natty is an
 * easier yes in August than a subscription that renews in June.
 *
 * Each paid rung has to justify its price on one feature, not on a bundle.
 * 134 teams is the wedge: nobody can watch them all, so the app watching them
 * for you is the product.
 */

export type TierId = 'walkon' | 'scholarship' | 'bluechip' | 'dynasty';
export type Cycle = 'monthly' | 'annual';

export interface Entitlements {
  /** Simulations a day. Infinity = uncapped. */
  simsPerDay: number;
  /** Monte-Carlo runs per simulation. More runs = tighter interval. */
  simDepth: number;
  /** How far down the Edge Board you can see. */
  edgeBoardDepth: number;
  /** The single highest-conviction play of the day, with the reasoning. */
  lockOfDay: boolean;
  /** Days of track record you can page back through. */
  historyDays: number;
  /** Calibration curve + per-bucket hit rates. */
  calibration: boolean;
  /** Player prop projections on the profile screen. */
  props: boolean;
  /** Correlated parlay builder; number = max legs, 0 = locked. */
  parlayLegs: number;
  /** Line-move history and steam alerts. */
  lineMoves: boolean;
  /** What-if lab: re-run with any player in or out. */
  lab: boolean;
  /** Saved-pick card and share images. */
  shareCards: 'off' | 'basic' | 'branded';
  /** Teams you can follow for a personalised feed. */
  follows: number;
  /** Raw JSON model feed + backtests. */
  apiAccess: boolean;
  /** Model weight editing (your own priors). */
  customWeights: boolean;
}

export interface Tier {
  id: TierId;
  name: string;
  tagline: string;
  /** Cents, so nothing is ever a float. */
  monthly: number;
  annual: number;
  /** The one line that sells this rung. */
  hook: string;
  /** Bullets shown on the card — written as outcomes, not features. */
  bullets: string[];
  entitlements: Entitlements;
  accent: 'ink' | 'green' | 'gold' | 'platinum';
}

const FREE: Entitlements = {
  simsPerDay: 3,
  simDepth: 2000,
  edgeBoardDepth: 3,
  lockOfDay: false,
  historyDays: 7,
  calibration: false,
  props: false,
  parlayLegs: 0,
  lineMoves: false,
  lab: false,
  shareCards: 'off',
  follows: 1,
  apiAccess: false,
  customWeights: false,
};

export const TIERS: Tier[] = [
  {
    id: 'walkon',
    name: 'Walk-On',
    tagline: 'Free forever',
    monthly: 0,
    annual: 0,
    hook: 'See the model work before you pay a cent.',
    bullets: [
      '3 simulations a day at 2,000 runs',
      'Top 3 of the Edge Board',
      'Every game on the slate, scores and box scores',
      'Last 7 days of the track record',
    ],
    entitlements: FREE,
    accent: 'ink',
  },
  {
    id: 'scholarship',
    name: 'Scholarship',
    tagline: 'For every Saturday',
    monthly: 1299,
    annual: 8900,
    hook: 'Unlimited 10,000-run simulations across all 134 teams.',
    bullets: [
      'Unlimited sims at 10,000 runs',
      'The whole Edge Board, all 60+ games a week',
      'Lock of the Day with the reasoning',
      'Full season track record + calibration',
      'Follow 5 programs for a personal feed',
    ],
    entitlements: {
      ...FREE,
      simsPerDay: Infinity,
      simDepth: 10000,
      edgeBoardDepth: 10,
      lockOfDay: true,
      historyDays: 400,
      calibration: true,
      shareCards: 'basic',
      follows: 5,
    },
    accent: 'green',
  },
  {
    id: 'bluechip',
    name: 'Blue Chip',
    tagline: 'For the one who bets the noon window',
    monthly: 2999,
    annual: 19900,
    hook: 'Upset Radar, props and the tools that turn a number into a bet.',
    bullets: [
      'Everything in Scholarship, at 25,000 runs',
      'Upset Radar: every live dog the model likes',
      'Correlated parlay builder (up to 4 legs)',
      'Player prop projections on every starter',
      'Line-move history and steam alerts',
      'What-if lab: pull a starter, re-run instantly',
      'Branded share cards for your group chat',
    ],
    entitlements: {
      ...FREE,
      simsPerDay: Infinity,
      simDepth: 25000,
      edgeBoardDepth: Infinity,
      lockOfDay: true,
      historyDays: 3650,
      calibration: true,
      props: true,
      parlayLegs: 4,
      lineMoves: true,
      lab: true,
      shareCards: 'branded',
      follows: Infinity,
    },
    accent: 'gold',
  },
  {
    id: 'dynasty',
    name: 'Dynasty',
    tagline: 'For the syndicate',
    monthly: 9900,
    annual: 79900,
    hook: 'The model itself — weights, feed and all 134 programs.',
    bullets: [
      'Everything in Blue Chip, at 50,000 runs',
      'Raw JSON feed: every projection, every hour',
      'Backtests against the full season archive',
      'Edit the node weights and keep your own priors',
      '8-leg parlay engine with correlation matrix',
      'Direct line to the build',
    ],
    entitlements: {
      simsPerDay: Infinity,
      simDepth: 50000,
      edgeBoardDepth: Infinity,
      lockOfDay: true,
      historyDays: 3650,
      calibration: true,
      props: true,
      parlayLegs: 8,
      lineMoves: true,
      lab: true,
      shareCards: 'branded',
      follows: Infinity,
      apiAccess: true,
      customWeights: true,
    },
    accent: 'platinum',
  },
];

export const FREE_TIER = TIERS[0];
export const TIER_BY_ID = Object.fromEntries(TIERS.map((t) => [t.id, t])) as Record<TierId, Tier>;
export const RANK: Record<TierId, number> = { walkon: 0, scholarship: 1, bluechip: 2, dynasty: 3 };

/** Days of full All-Pro on the house, once, no card. */
export const TRIAL_DAYS = 7;
export const TRIAL_TIER: TierId = 'bluechip';

/** College sells a season, not a year. */
export const ANNUAL_LABEL = 'Season pass';

export const price = (cents: number) => (cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`);

/** Annual framed the way people buy it: "2 months free". */
export function annualSaving(t: Tier): { pct: number; months: number } | null {
  if (!t.monthly || !t.annual) return null;
  const full = t.monthly * 12;
  return { pct: Math.round(((full - t.annual) / full) * 100), months: Math.round((full - t.annual) / t.monthly) };
}

/** The cheapest tier that actually unlocks a given entitlement. */
export function tierUnlocking(key: keyof Entitlements): Tier {
  const better = (v: Entitlements[keyof Entitlements], base: Entitlements[keyof Entitlements]) => {
    if (typeof v === 'number' && typeof base === 'number') return v > base;
    if (typeof v === 'boolean') return v && !base;
    return v !== base && v !== 'off';
  };
  return TIERS.find((t) => better(t.entitlements[key], FREE[key])) ?? TIERS[1];
}

/** The nudge shown when a locked surface is tapped. */
export function upsellFor(key: keyof Entitlements): { tier: TierId; line: string } {
  const need = tierUnlocking(key);
  return { tier: need.id, line: `${need.name} unlocks this` };
}

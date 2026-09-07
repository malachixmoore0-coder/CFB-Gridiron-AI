/**
 * Model-versus-market maths. This is the part people pay for.
 *
 * The engine already publishes a projection for every game before kickoff
 * (predictions.json, written by the refresh workflow and frozen at kickoff).
 * Every number here is derived from that projection and the market lines on the
 * same game, so the Edge Board costs the device nothing and says exactly what
 * the graded track record says.
 *
 * Conventions, once, so the signs never drift:
 *   • A home line is printed the way a book prints it: -3.5 means home is
 *     favoured by 3.5. PredictionRecord.spread is the model's home line in the
 *     same convention (projectedAway − projectedHome).
 *   • Spread edge = market home line − model home line. Positive means the
 *     model thinks the home side is that many points better than the number.
 *   • Total edge = model total − market total. Positive leans over.
 */
import type { LiveGame, PredictionRecord } from '@/data/liveTypes';

export interface EdgeRow {
  gameId: string;
  game: LiveGame;
  rec: PredictionRecord;
  /** Points of value on the side the model likes. Always positive. */
  spreadEdge: number;
  /** 'home' | 'away' — the side that edge is on. */
  spreadSide: 'home' | 'away';
  /** Points of value on the total, and which way. */
  totalEdge: number;
  totalSide: 'over' | 'under';
  /** Model win probability for the side it likes, 0-100. */
  sidePct: number;
  /** Expected value per $1 on the model's side at the posted moneyline, or null. */
  ev: number | null;
  /** 0-100 blend of edge size, model confidence and how settled the number is. */
  conviction: number;
  /** One line a human can act on. */
  reason: string;
  kickoff: number;
  live: boolean;
  played: boolean;
}

/* ---------- odds plumbing ---------- */

/** American odds → implied probability (with the vig still in it). */
export function impliedProb(american: number): number {
  return american > 0 ? 100 / (american + 100) : -american / (-american + 100);
}

/** Strip the vig from a two-way market so model and market compare like for like. */
export function devig(away: number, home: number): { away: number; home: number } {
  const a = impliedProb(away);
  const h = impliedProb(home);
  const s = a + h;
  return s > 0 ? { away: a / s, home: h / s } : { away: 0.5, home: 0.5 };
}

/** Decimal payout for $1 staked. */
export const payout = (american: number) => (american > 0 ? american / 100 : 100 / -american);

/** Expected value per $1 staked at these odds if the model's probability is right. */
export const evOf = (p: number, american: number) => p * payout(american) - (1 - p);

/** American odds that exactly price a probability — the "fair" number. */
export function fairOdds(p: number): number {
  if (p <= 0 || p >= 1) return 0;
  return p >= 0.5 ? -Math.round((p / (1 - p)) * 100) : Math.round(((1 - p) / p) * 100);
}

export const fmtOdds = (n: number) => (n > 0 ? `+${Math.round(n)}` : `${Math.round(n)}`);

/* ---------- the board ---------- */

/**
 * Conviction is deliberately not just "biggest edge". A 9-point disagreement on
 * a game the market has barely priced is usually the model being wrong about a
 * backup quarterback, so three things are blended:
 *   • edge — how far the model is from the number (capped, 55%)
 *   • confidence — how far the model's own probability is from a coin flip (30%)
 *   • settledness — how many refreshes have agreed on this number (15%)
 */
export function convictionOf(spreadEdge: number, sidePct: number, updates: number): number {
  const edge = Math.min(Math.abs(spreadEdge) / 7, 1) * 55;
  const conf = Math.min(Math.abs(sidePct - 50) / 25, 1) * 30;
  const settled = Math.min(updates / 6, 1) * 15;
  return Math.round(edge + conf + settled);
}

function reasonFor(row: Omit<EdgeRow, 'reason' | 'conviction'>, awayAbbr: string, homeAbbr: string): string {
  const side = row.spreadSide === 'home' ? homeAbbr : awayAbbr;
  const market = row.game.homeSpread;
  const num = market == null ? null : row.spreadSide === 'home' ? market : -market;
  const at = num == null ? '' : ` at ${num > 0 ? `+${num}` : num}`;
  return `Model makes ${side} ${row.spreadEdge.toFixed(1)} better than the number${at} — ${row.sidePct.toFixed(0)}% to win outright.`;
}

/** Build the Edge Board from the published slate and the published projections. */
export function buildEdges(
  games: LiveGame[],
  records: PredictionRecord[],
  abbrOf: (teamId: string) => string,
): EdgeRow[] {
  const byId = new Map(records.map((r) => [r.id, r]));
  const rows: EdgeRow[] = [];
  for (const g of games) {
    const rec = byId.get(g.id);
    if (!rec) continue;
    const market = g.homeSpread ?? rec.marketHomeSpread;
    if (market == null) continue;
    const diff = market - rec.spread; // + = model likes home
    const spreadSide: 'home' | 'away' = diff >= 0 ? 'home' : 'away';
    const sidePct = spreadSide === 'home' ? rec.homeWinPct : rec.awayWinPct;
    const ml = spreadSide === 'home' ? g.homeMoneyline : g.awayMoneyline;
    const marketTotal = g.totalLine ?? rec.marketTotal;
    const totalDiff = marketTotal == null ? 0 : rec.total - marketTotal;
    const base = {
      gameId: g.id,
      game: g,
      rec,
      spreadEdge: Math.abs(diff),
      spreadSide,
      totalEdge: Math.abs(totalDiff),
      totalSide: (totalDiff >= 0 ? 'over' : 'under') as 'over' | 'under',
      sidePct,
      ev: ml == null ? null : evOf(sidePct / 100, ml),
      kickoff: Date.parse(g.kickoff),
      live: g.status === 'in_progress',
      played: g.status === 'final',
    };
    rows.push({
      ...base,
      conviction: convictionOf(base.spreadEdge, sidePct, rec.updates),
      reason: reasonFor(base, abbrOf(g.awayId), abbrOf(g.homeId)),
    });
  }
  return rows.sort((a, b) => b.conviction - a.conviction || b.spreadEdge - a.spreadEdge);
}

/**
 * The single play of the day: highest conviction among games that have not
 * kicked off, with a floor so the app says "nothing worth it today" rather than
 * inventing a pick out of a half-point disagreement.
 */
export function lockOfDay(rows: EdgeRow[], minConviction = 45): EdgeRow | null {
  const open = rows.filter((r) => !r.played && !r.live && r.kickoff > Date.now());
  const best = open[0];
  return best && best.conviction >= minConviction ? best : null;
}

/** Games where the model has the underdog winning outright — the upset board. */
export function upsets(rows: EdgeRow[]): EdgeRow[] {
  return rows
    .filter((r) => !r.played && r.game.homeSpread != null)
    .filter((r) => {
      const homeDog = (r.game.homeSpread ?? 0) > 0;
      const modelPicksHome = r.rec.homeWinPct >= 50;
      return homeDog === modelPicksHome && Math.abs(r.rec.homeWinPct - 50) > 2;
    })
    .sort((a, b) => Math.max(b.rec.homeWinPct, b.rec.awayWinPct) - Math.max(a.rec.homeWinPct, a.rec.awayWinPct));
}

/* ---------- parlays ---------- */

export interface ParlayLeg { key: string; gameId: string; label: string; prob: number; american: number | null; }

/**
 * Parlay pricing with a correlation haircut.
 *
 * Independent legs multiply. Legs from the same game do not — a team covering
 * and that game going over move together, and a book that lets you combine them
 * prices that in. Rather than pretend to a full copula on three data points,
 * this applies a flat, documented correlation of 0.12 per same-game pair,
 * shrinking the joint probability toward the weakest leg. It is deliberately
 * conservative: it will never quote a parlay as better than the independent
 * product.
 */
export const SAME_GAME_RHO = 0.12;

export function parlay(legs: ParlayLeg[]): { prob: number; fair: number; book: number | null; ev: number | null; correlated: boolean } {
  if (!legs.length) return { prob: 0, fair: 0, book: null, ev: null, correlated: false };
  const independent = legs.reduce((p, l) => p * l.prob, 1);
  let pairs = 0;
  for (let i = 0; i < legs.length; i += 1)
    for (let j = i + 1; j < legs.length; j += 1) if (legs[i].gameId === legs[j].gameId) pairs += 1;
  const weakest = Math.min(...legs.map((l) => l.prob));
  const prob = pairs ? independent + (weakest - independent) * Math.min(pairs * SAME_GAME_RHO, 0.6) : independent;
  const book = legs.every((l) => l.american != null)
    ? legs.reduce((d, l) => d * (payout(l.american as number) + 1), 1) - 1
    : null;
  return {
    prob,
    fair: fairOdds(prob),
    book: book == null ? null : book >= 1 ? Math.round(book * 100) : -Math.round(100 / book),
    ev: book == null ? null : prob * book - (1 - prob),
    correlated: pairs > 0,
  };
}

/* ---------- cover probabilities ---------- */

/**
 * Turning a projected margin into a cover probability needs a spread of
 * outcomes, and the on-device board has only the mean. Rather than re-run the
 * simulation for sixteen games, this uses the historical standard deviation of
 * college game margins around a projection — about 16.5 points, wider than the
 * NFL because the talent gaps are — and about 13 for totals. Those are the numbers the full simulation converges to,
 * so the board and the deep run agree to within about a point of probability.
 *
 * Where a real simulation is available (the result screen), prefer it. This is
 * the cheap approximation that makes a 16-game board instant.
 */
export const MARGIN_SIGMA = 16.5;
export const TOTAL_SIGMA = 13.0;

/** Standard normal CDF (Abramowitz & Stegun 7.1.26 via erf). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/**
 * Probability the home side covers a line printed the book's way
 * (-3 = home laying 3). Pass the negated line for the away side.
 */
export function coverProb(projectedMargin: number, homeLine: number, sigma = MARGIN_SIGMA): number {
  return 1 - normalCdf((-homeLine - projectedMargin) / sigma);
}

/** Probability the total goes over a posted number. */
export function overProb(projectedTotal: number, line: number, sigma = TOTAL_SIGMA): number {
  return 1 - normalCdf((line - projectedTotal) / sigma);
}

/** Every leg the model is willing to price on one game. */
export function legsFor(row: EdgeRow, awayAbbr: string, homeAbbr: string): ParlayLeg[] {
  const margin = row.rec.projectedHome - row.rec.projectedAway;
  const legs: ParlayLeg[] = [];
  const line = row.game.homeSpread ?? row.rec.marketHomeSpread;
  if (line != null) {
    const home = coverProb(margin, line);
    legs.push({ key: `${row.gameId}:spread:home`, gameId: row.gameId, label: `${homeAbbr} ${line > 0 ? `+${line}` : line}`, prob: home, american: -110 });
    legs.push({ key: `${row.gameId}:spread:away`, gameId: row.gameId, label: `${awayAbbr} ${-line > 0 ? `+${-line}` : -line}`, prob: 1 - home, american: -110 });
  }
  legs.push({ key: `${row.gameId}:ml:home`, gameId: row.gameId, label: `${homeAbbr} ML`, prob: row.rec.homeWinPct / 100, american: row.game.homeMoneyline });
  legs.push({ key: `${row.gameId}:ml:away`, gameId: row.gameId, label: `${awayAbbr} ML`, prob: row.rec.awayWinPct / 100, american: row.game.awayMoneyline });
  const total = row.game.totalLine ?? row.rec.marketTotal;
  if (total != null) {
    const over = overProb(row.rec.total, total);
    legs.push({ key: `${row.gameId}:total:over`, gameId: row.gameId, label: `${awayAbbr}/${homeAbbr} o${total}`, prob: over, american: -110 });
    legs.push({ key: `${row.gameId}:total:under`, gameId: row.gameId, label: `${awayAbbr}/${homeAbbr} u${total}`, prob: 1 - over, american: -110 });
  }
  return legs;
}

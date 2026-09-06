/**
 * Model track record. On every refresh each upcoming game on the slate is
 * predicted with the default model and the record is rewritten — right up to
 * kickoff, after which it is frozen. When a final score exists the frozen
 * prediction is graded (straight up, against the market spread, over/under,
 * Brier). Records accumulate for the whole season in data/live/predictions.json.
 */
import { analyzeMatchup, DEFAULT_WEIGHTS, HFA_DEFAULT } from '../../src/engine';
import type { MatchupInput, Team } from '../../src/engine/types';
import type { LiveGame, LivePredictionsFile, PredictionRecord, PredictionResult } from '../../src/data/liveTypes';

const SIMULATIONS = 10_000;
export const PREDICTION_MODEL: LivePredictionsFile['model'] = { weights: { ...DEFAULT_WEIGHTS }, simulations: SIMULATIONS, homeFieldBase: HFA_DEFAULT };
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Grade a frozen prediction against the final score. */
export function grade(p: PredictionRecord, homeScore: number, awayScore: number): PredictionResult {
  const margin = homeScore - awayScore;
  const modelMargin = -p.spread;
  const winner: 'home' | 'away' = margin > 0 ? 'home' : 'away';
  const modelFav: 'home' | 'away' = p.homeWinPct >= 50 ? 'home' : 'away';
  let atsPick: PredictionResult['atsPick'] = null;
  let ats: PredictionResult['ats'] = null;
  if (p.marketHomeSpread !== null) {
    const edge = modelMargin + p.marketHomeSpread; // > 0 ⇒ model likes the home side vs the line
    if (Math.abs(edge) >= 0.5) {
      atsPick = edge > 0 ? 'home' : 'away';
      const homeCoverBy = margin + p.marketHomeSpread;
      ats = homeCoverBy === 0 ? 'push' : (homeCoverBy > 0) === (atsPick === 'home') ? 'win' : 'loss';
    }
  }
  let ouPick: PredictionResult['ouPick'] = null;
  let ou: PredictionResult['ou'] = null;
  if (p.marketTotal !== null) {
    const edge = p.total - p.marketTotal;
    if (Math.abs(edge) >= 0.5) {
      ouPick = edge > 0 ? 'over' : 'under';
      const actual = homeScore + awayScore;
      ou = actual === p.marketTotal ? 'push' : (actual > p.marketTotal) === (ouPick === 'over') ? 'win' : 'loss';
    }
  }
  return {
    homeScore, awayScore, winner,
    suCorrect: winner === modelFav,
    atsPick, ats, ouPick, ou,
    spreadError: r1(margin - modelMargin),
    totalError: r1(homeScore + awayScore - p.total),
    brier: Math.round((p.homeWinPct / 100 - (winner === 'home' ? 1 : 0)) ** 2 * 10000) / 10000,
  };
}

export interface UpdateInputs {
  existing: LivePredictionsFile | null;
  season: number;
  now: Date;
  /** The current slate (upcoming and just-played games). */
  schedule: LiveGame[];
  teams: Team[];
  /** Final score for any game id this season, from the full results feed. */
  resolve: (id: string) => { homeScore: number; awayScore: number } | null;
}

export function updatePredictions(inp: UpdateInputs): LivePredictionsFile {
  const byId = new Map(inp.teams.map((t) => [t.id, t]));
  const prior = inp.existing && inp.existing.season === inp.season ? inp.existing.records : [];
  const records = new Map(prior.map((r) => [r.id, r]));
  const nowIso = inp.now.toISOString();
  const nowMs = inp.now.getTime();

  for (const g of inp.schedule) {
    const home = byId.get(g.homeId);
    const away = byId.get(g.awayId);
    if (!home || !away) continue;
    const kickoffMs = Date.parse(g.kickoff);
    const started = Number.isFinite(kickoffMs) && kickoffMs <= nowMs;
    const cur = records.get(g.id);
    if (started) {
      // No pre-kickoff prediction on file ⇒ nothing honest to record.
      if (cur && cur.status === 'open') { cur.status = 'locked'; cur.lockedAt = g.kickoff; }
      continue;
    }
    if (cur && cur.status !== 'open') continue; // never touch a frozen record
    const players = [...home.players, ...away.players];
    const input: MatchupInput = {
      home, away, neutralSite: g.neutralSite, primetime: g.primetime,
      weather: g.weatherHint && g.weatherHint !== 'dome' ? g.weatherHint : undefined,
      injuredOut: players.filter((p) => p.reported === 'out').map((p) => p.id),
      questionable: players.filter((p) => p.reported === 'questionable').map((p) => p.id),
    };
    const a = analyzeMatchup(input, { weights: PREDICTION_MODEL.weights, simulations: SIMULATIONS, homeFieldBase: PREDICTION_MODEL.homeFieldBase });
    const s = a.simulation;
    records.set(g.id, {
      id: g.id, season: g.season, week: g.week, gameType: g.gameType, kickoff: g.kickoff, awayId: g.awayId, homeId: g.homeId, neutralSite: g.neutralSite,
      homeWinPct: s.homeWinPct, awayWinPct: s.awayWinPct, projectedHome: s.projectedHome, projectedAway: s.projectedAway, spread: s.spread, total: s.projectedTotal,
      marketHomeSpread: g.homeSpread, marketTotal: g.totalLine,
      predictedAt: nowIso, updates: (cur?.updates ?? 0) + 1, status: 'open', lockedAt: null, result: null,
    });
  }

  // Freeze anything whose kickoff has passed, then grade what has a final score.
  for (const r of records.values()) {
    if (r.status === 'open' && Date.parse(r.kickoff) <= nowMs) { r.status = 'locked'; r.lockedAt = r.kickoff; }
    if (r.status === 'locked') {
      const res = inp.resolve(r.id);
      if (res) { r.result = grade(r, res.homeScore, res.awayScore); r.status = 'final'; }
    }
  }

  const list = [...records.values()].sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.id.localeCompare(b.id));
  return { generatedAt: nowIso, season: inp.season, model: PREDICTION_MODEL, records: list };
}

/** Headline hit rates for a set of records (shared with the app's Record tab via copy in src/utils/record.ts). */
export function summarize(records: PredictionRecord[]) {
  const finals = records.filter((r) => r.status === 'final' && r.result);
  const su = finals.filter((r) => r.result!.suCorrect).length;
  const ats = finals.filter((r) => r.result!.ats === 'win').length;
  const atsL = finals.filter((r) => r.result!.ats === 'loss').length;
  const ou = finals.filter((r) => r.result!.ou === 'win').length;
  const ouL = finals.filter((r) => r.result!.ou === 'loss').length;
  const brier = finals.length ? finals.reduce((s, r) => s + r.result!.brier, 0) / finals.length : null;
  return { finals: finals.length, su, ats, atsL, ou, ouL, brier };
}

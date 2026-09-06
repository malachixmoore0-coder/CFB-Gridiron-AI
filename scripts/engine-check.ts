/**
 * Runtime sanity checks for the CFB GRIDIRON-AI engine. Run with `npm run test:engine`.
 * Exits non-zero on any failed assertion.
 */
import { analyzeMatchup, DEFAULT_WEIGHTS, normalizeWeights } from '../src/engine';
import fs from 'node:fs';
import path from 'node:path';
import { TEAMS, getTeam } from '../src/data/teams';
import type { Team } from '../src/engine/types';

let failures = 0;
const check = (cond: boolean, msg: string) => {
  if (!cond) { failures++; console.error('  ✗', msg); } else { console.log('  ✓', msg); }
};

console.log('\n— Weights');
const w = normalizeWeights({ scheme: 30, personnel: 30, environment: 20, xfactor: 20 });
check(Math.abs(w.scheme + w.personnel + w.environment + w.xfactor - 100) < 1e-9, 'normalised weights sum to 100');
check(Math.abs(normalizeWeights({ scheme: 50 }).scheme - 50 / 125 * 100) < 1e-9, 'partial weights renormalise proportionally');
check(DEFAULT_WEIGHTS.scheme === 25 && DEFAULT_WEIGHTS.personnel === 35, 'defaults are 25/35/15/25');

// Prefer the live dataset (it has depth charts); fall back to the Elo-seeded baseline.
const livePath = path.resolve(__dirname, '../data/live/teams.json');
const live = fs.existsSync(livePath) ? (JSON.parse(fs.readFileSync(livePath, 'utf8')) as { generatedAt: string; season: number; teams: Team[] }) : null;
const pool: Team[] = live?.teams ?? TEAMS;
const T = (id: string) => { const t = pool.find((x) => x.id === id); if (!t) throw new Error(`missing ${id}`); return t; };
console.log(`\n— Dataset: ${live ? `live (${live.teams.length} teams, generated ${live.generatedAt})` : `baseline (${TEAMS.length} teams)`}`);
check(pool.length >= 120, `${pool.length} FBS teams`);
const ids = new Set(pool.flatMap((t) => t.players.map((p) => p.id)));
check(ids.size === pool.reduce((n, t) => n + t.players.length, 0), 'player ids are unique');
if (live) check(live.teams.every((t) => t.players.some((p) => p.pos === 'QB' && p.role === 'starter')), 'every live team has a starting QB');

console.log('\n— Baseline matchup: Michigan @ Ohio State');
const osu = T('ohio-state');
const mich = T('michigan');
const a = analyzeMatchup({ home: osu, away: mich });
const s = a.simulation;
console.log(`    ${mich.abbr} ${s.awayWinPct}%  @  ${osu.abbr} ${s.homeWinPct}%  | proj ${s.projectedAway}-${s.projectedHome} | total ${s.projectedTotal} | spread ${s.spread} | OT ${s.overtimePct}%`);
check(Math.abs(s.homeWinPct + s.awayWinPct - 100) < 0.2, 'win probabilities sum to 100 (no ties in college)');
check(s.tiePct === 0, 'no ties');
check(s.runs === 10_000, 'defaults to 10,000 runs');
check(s.projectedTotal > 34 && s.projectedTotal < 88, 'projected total is a college football number');
check(a.nodes.length === 4 && a.nodes.every((n) => Number.isFinite(n.points)), 'four finite nodes');
check(a.script.early.length > 40 && a.script.halftime.length > 40 && a.script.late.length > 40, 'three-act game script populated');
check(Object.values(a.matrix).every((r) => r.home >= 1 && r.home <= 10 && r.away >= 1 && r.away <= 10), 'advantage matrix within 1-10');
check(s.marginBins.reduce((t, b) => t + b.pct, 0) > 99, 'margin histogram covers the distribution');
check(a.nodes[2].factors.some((f) => f.label.startsWith('Rivalry game')), 'The Game is flagged as a rivalry');
if (live) check(a.sleepers.length >= 1 && a.sleepers.length <= 3, `sleeper report has 1-3 players (${a.sleepers.length})`);

console.log('\n— Determinism');
const b = analyzeMatchup({ home: osu, away: mich });
check(JSON.stringify(a.simulation) === JSON.stringify(b.simulation), 'same input ⇒ identical simulation');
const c = analyzeMatchup({ home: osu, away: mich }, { seed: 12345 });
check(c.seed !== a.seed, 'different seed ⇒ different draw');
check(Math.abs(c.simulation.homeWinPct - a.simulation.homeWinPct) < 3, 'different seeds agree within Monte-Carlo noise');

console.log('\n— Home field');
const neutral = analyzeMatchup({ home: osu, away: mich, neutralSite: true });
check(neutral.simulation.homeWinPct < a.simulation.homeWinPct, 'neutral site lowers the home win probability');
const flipped = analyzeMatchup({ home: mich, away: osu });
check(flipped.simulation.homeWinPct < a.simulation.homeWinPct, 'venue swap moves the number toward the new host');
const conf = analyzeMatchup({ home: T('iowa'), away: T('purdue') });
const nonConf = analyzeMatchup({ home: T('iowa'), away: T('tulsa') });
check(conf.nodes[2].factors.some((f) => f.label === 'Conference game'), 'conference game flagged');
check(nonConf.nodes[2].factors.some((f) => f.label === 'Non-conference matchup'), 'non-conference game flagged');

console.log('\n— Talent gap');
const mismatch = analyzeMatchup({ home: T('georgia'), away: T('kent-state') });
console.log(`    KENT @ UGA: UGA ${mismatch.simulation.homeWinPct}% · spread ${mismatch.simulation.spread} · total ${mismatch.simulation.projectedTotal}`);
check(mismatch.simulation.homeWinPct > 90, 'a power program is a heavy favourite over a bottom-tier MAC team');
check(mismatch.simulation.spread <= -20, 'the spread reflects a college-sized mismatch');

console.log('\n— Injury degradation');
const home = T('texas');
const away = T('oklahoma');
const qb1 = home.players.find((p) => p.pos === 'QB' && p.role === 'starter');
if (qb1) {
  const healthy = analyzeMatchup({ home, away, neutralSite: true });
  const qbOut = analyzeMatchup({ home, away, neutralSite: true, injuredOut: [qb1.id] });
  console.log(`    OU vs TEX (neutral): TEX ${healthy.simulation.homeWinPct}% → ${qb1.name} out: TEX ${qbOut.simulation.homeWinPct}%`);
  check(qbOut.simulation.homeWinPct < healthy.simulation.homeWinPct - 6, 'backup QB costs a big chunk of win probability');
  check(qbOut.injuries.length === 1 && qbOut.injuries[0].metric.includes('-20%'), 'QB metric reports -20% win efficiency');
  const q = analyzeMatchup({ home, away, neutralSite: true, questionable: [qb1.id] });
  check(q.simulation.homeWinPct < healthy.simulation.homeWinPct && q.simulation.homeWinPct > qbOut.simulation.homeWinPct, 'questionable = half the degradation');
} else {
  console.log('  (baseline dataset has no depth charts — injury checks need data/live)');
}

console.log('\n— Weather');
const clear = analyzeMatchup({ home: T('wisconsin'), away: T('minnesota') });
const snow = analyzeMatchup({ home: T('wisconsin'), away: T('minnesota'), weather: 'snow' });
check(snow.simulation.projectedTotal < clear.simulation.projectedTotal, 'snow lowers the total');

console.log('\n— Every team vs an average opponent (no NaNs, sane ranges)');
let allOk = true;
const worst: string[] = [];
const avg = [...pool].sort((x, y) => Math.abs((x.talent ?? 5.5) - 5.5) - Math.abs((y.talent ?? 5.5) - 5.5))[0];
for (const t of pool) {
  const opp = t.id === avg.id ? pool.find((x) => x.id !== t.id)! : avg;
  const r = analyzeMatchup({ home: t, away: opp }, { simulations: 1000 });
  const sim = r.simulation;
  const ok = Number.isFinite(sim.homeWinPct) && sim.homeWinPct > 1 && sim.homeWinPct < 99.5 && sim.projectedTotal > 30 && sim.projectedTotal < 90;
  if (!ok) { allOk = false; worst.push(`${t.abbr}: ${sim.homeWinPct}% / ${sim.projectedTotal}`); }
}
check(allOk, `all ${pool.length} teams simulate within bounds vs ${avg.school}${worst.length ? ' — ' + worst.join(', ') : ''}`);

console.log('\n— Spread sanity across marquee matchups');
const pairs: [string, string][] = [['alabama', 'georgia'], ['texas', 'oklahoma'], ['notre-dame', 'usc'], ['oregon', 'washington'], ['boise-state', 'fresno-state'], ['army', 'navy'], ['clemson', 'florida-state'], ['ohio-state', 'akron']];
for (const [awayId, homeId] of pairs) {
  const r = analyzeMatchup({ home: T(homeId), away: T(awayId) }, { simulations: 4000 });
  console.log(`    ${T(awayId).abbr} @ ${T(homeId).abbr}: home ${r.simulation.homeWinPct}% · spread ${r.simulation.spread} · total ${r.simulation.projectedTotal} · margin model ${r.modelMargin}`);
}

console.log('\n— Track record (predictions lock at kickoff, grade on the final)');
{
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { grade, updatePredictions } = require('../pipeline/compute/predictions') as typeof import('../pipeline/compute/predictions');
  const home = T('ohio-state');
  const away = T('michigan');
  const kickoff = '2026-11-28T17:00:00.000Z';
  const game = {
    id: 'test-1', season: 2026, week: 14, gameType: 'regular', kickoff, timeTbd: false, weekday: 'Saturday', awayId: away.id, homeId: home.id, neutralSite: false, conferenceGame: true,
    stadium: home.stadium.name, roof: 'outdoors', homeSpread: -10.5, totalLine: 48.5, awayMoneyline: null, homeMoneyline: null, lineSource: 'test', primetime: false, broadcast: null, notes: null,
    weather: null, weatherHint: null as null, awayScore: null, homeScore: null, status: 'scheduled' as const, statusDetail: null, awayRank: null, homeRank: null,
  };
  const before = updatePredictions({ existing: null, season: 2026, now: new Date('2026-11-27T12:00:00Z'), schedule: [game], teams: pool, resolve: () => null });
  const open = before.records[0];
  check(!!open && open.status === 'open' && open.updates === 1 && open.homeWinPct > 50, `prediction recorded before kickoff (OSU ${open?.homeWinPct}% · ${open?.spread})`);
  const again = updatePredictions({ existing: before, season: 2026, now: new Date('2026-11-28T12:00:00Z'), schedule: [{ ...game, homeSpread: -12 }], teams: pool, resolve: () => null });
  check(again.records[0].updates === 2 && again.records[0].marketHomeSpread === -12, 'open prediction is re-run and picks up the newer market line');
  const locked = updatePredictions({ existing: again, season: 2026, now: new Date('2026-11-28T17:30:00Z'), schedule: [{ ...game, homeSpread: -15 }], teams: pool, resolve: () => null });
  check(locked.records[0].status === 'locked' && locked.records[0].marketHomeSpread === -12 && locked.records[0].updates === 2, 'prediction freezes at kickoff and ignores later lines');
  const final = updatePredictions({ existing: locked, season: 2026, now: new Date('2026-11-29T02:00:00Z'), schedule: [], teams: pool, resolve: (id) => (id === 'test-1' ? { homeScore: 31, awayScore: 17 } : null) });
  const res = final.records[0].result!;
  check(final.records[0].status === 'final' && res.winner === 'home' && res.suCorrect, 'final score grades the frozen prediction');
  check(res.atsPick !== null && res.ats !== null && res.ou !== null, `market grading present (ATS pick ${res.atsPick} → ${res.ats}, O/U ${res.ouPick} → ${res.ou})`);
  const unseen = updatePredictions({ existing: null, season: 2026, now: new Date('2026-11-28T17:30:00Z'), schedule: [game], teams: pool, resolve: () => ({ homeScore: 31, awayScore: 17 }) });
  check(unseen.records.length === 0, 'a game first seen after kickoff is never back-filled');
  const g = grade({ ...open, homeWinPct: 70, awayWinPct: 30, spread: -7, total: 50, marketHomeSpread: -3, marketTotal: 45 }, 20, 24);
  check(!g.suCorrect && g.atsPick === 'home' && g.ats === 'loss' && g.ouPick === 'over' && g.ou === 'loss' && Math.abs(g.brier - 0.49) < 1e-9, 'grading arithmetic: upset ⇒ SU ✗, ATS ✗, O/U ✗, Brier 0.49');
  const push = grade({ ...open, homeWinPct: 60, awayWinPct: 40, spread: -7, total: 50, marketHomeSpread: -3, marketTotal: 44 }, 24, 21);
  check(push.ats === 'push' && push.ou === 'win', 'push on the number is a push, not a loss');
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll engine checks passed.');
if (failures) throw new Error(`${failures} engine check(s) failed`);

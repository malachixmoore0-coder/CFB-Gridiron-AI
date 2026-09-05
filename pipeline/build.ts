/**
 * CFB GRIDIRON-AI live data build.
 *
 *   npm run data:build                  # full build → data/live/*.json
 *   npm run data:build -- --no-weather  # skip Open-Meteo calls
 *
 * Sources: sportsdataverse ESPN play-by-play parquet (EPA / success / havoc,
 * player ids), cfbfastR-data mirrors of CollegeFootballData (schedule +
 * results + Elo, rosters), ESPN (best-effort odds, rankings, injuries, depth
 * charts), Open-Meteo (best-effort kickoff weather).
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { TEAMS } from '../src/data/teams';
import type { DefensiveFront, Team } from '../src/engine/types';
import { sourceLog } from './lib/fetch';
import { latestElo, loadRosters, loadSchedule } from './sources/cfbfastr';
import { aggregatePbp } from './sources/sdvpbp';
import { loadDepthCharts, loadEspnInjuries, loadRankings, loadScoreboard } from './sources/espn';
import type { BuildCtx } from './compute/context';
import { blendWeight, gamesPlayed } from './compute/context';
import { buildTeams, detectFront, roundMetrics } from './compute/teams';
import { buildPlayers, rosterPosition } from './compute/players';
import { buildSchedule, currentWeek, mergeResults, records } from './compute/schedule';

const OUT_DIR = path.resolve(__dirname, '../data/live');
const withWeather = !process.argv.includes('--no-weather');
const skipEspn = process.argv.includes('--no-espn');

async function main() {
  const t0 = Date.now();
  const today = new Date();
  console.log(`\nCFB Gridiron AI data build — ${today.toISOString()}`);

  console.log('\n[1/6] Schedule, results & Elo');
  let season = today.getUTCFullYear();
  let games = await loadSchedule(season, true);
  if (!games.length) { season -= 1; games = await loadSchedule(season); }
  const priorSeason = season - 1;
  const priorGames = await loadSchedule(priorSeason, true);
  const elo = latestElo([...priorGames, ...games]);
  console.log(`  season ${season} · ${games.length} games on file · Elo for ${elo.size} teams`);

  console.log('\n[2/6] Rosters & ESPN enrichment');
  const espnIds = TEAMS.map((t) => t.espnId);
  const [rosters, depth, injuries, rankings] = await Promise.all([
    loadRosters(season),
    skipEspn ? Promise.resolve({ byTeam: new Map(), ok: 0 }) : loadDepthCharts(espnIds),
    skipEspn ? Promise.resolve([]) : loadEspnInjuries(),
    skipEspn ? Promise.resolve(null) : loadRankings(),
  ]);
  console.log(`  ${rosters.length} roster rows · depth charts for ${depth.ok} teams · ESPN injuries ${injuries.length} · ${rankings ? `${rankings.poll} (${rankings.ranks.size})` : 'no poll'}`);

  const posById = new Map<string, string>();
  for (const r of rosters) { const p = rosterPosition(r); if (p) posById.set(r.athlete_id, p === 'EDGE' || p === 'DT' ? 'DL' : p); }
  const fronts = new Map<number, DefensiveFront>(TEAMS.map((b) => [b.espnId, detectFront(depth.byTeam.get(b.espnId), b.coaching.defFront)]));
  const frontOf = (id: number) => fronts.get(id) ?? '4-2-5';

  console.log('\n[3/6] Play-by-play (parquet)');
  const cur = await aggregatePbp(season, (id) => posById.get(id) ?? '', frontOf);
  console.log(`  ${season}: ${cur ? `${cur.plays} scrimmage plays · ${cur.games} games` : 'not published yet'}`);
  const prior = await aggregatePbp(priorSeason, (id) => posById.get(id) ?? '', frontOf);
  console.log(`  ${priorSeason}: ${prior ? `${prior.plays} scrimmage plays · ${prior.games} games` : 'unavailable'}`);
  // Scores from the play-by-play feed fill in what the schedule file has not caught up on yet.
  games = mergeResults(games, cur?.results);
  const { week, phase } = currentWeek(games, season, today);
  const all = [...priorGames, ...games];
  console.log(`  ${phase} · current week ${week} · ${games.filter((g) => Number.isFinite(g.home_points)).length} results on file`);

  const ctx: BuildCtx = {
    season, priorSeason, today, games: all, cur, prior, rosters, depth: depth.byTeam, espnInjuries: injuries, elo, ranks: rankings?.ranks ?? new Map(), baseline: TEAMS, notes: [],
  };

  console.log('\n[4/6] Team profiles');
  const built = buildTeams(ctx, () => undefined, () => undefined);
  console.log('\n[5/6] Depth charts & player grades');
  const players = buildPlayers(ctx, built.map((b) => b.team));
  // Second pass so the QB1 / TE1 grades feed the team ratings.
  const built2 = buildTeams(ctx, (id) => players.qbRating.get(id), (id) => players.teSpeed.get(id));
  const recs = records(games, season);
  const teams: Team[] = built2.map(({ team }) => ({
    ...team,
    players: players.byTeam.get(team.id) ?? [],
    record: recs.get(team.espnId) ?? '0-0',
  }));
  if (!depth.ok) ctx.notes.push('ESPN depth charts unavailable — depth charts ordered by play-by-play usage and roster class.');
  if (!injuries.length) ctx.notes.push('No availability report loaded — statuses can be set by hand on each team page.');

  console.log('\n[6/6] Schedule, lines & weather');
  const [scoreboard, scoreboardNext] = await Promise.all([
    skipEspn ? Promise.resolve(new Map()) : loadScoreboard(season, week, phase === 'postseason' ? 3 : 2),
    skipEspn || phase === 'postseason' ? Promise.resolve(new Map()) : loadScoreboard(season, week + 1, 2),
  ]);
  const espn = new Map([...scoreboard, ...scoreboardNext]);
  console.log(`  ESPN scoreboard odds for ${[...espn.values()].filter((g) => g.homeSpread !== null).length} games`);
  const { games: schedule, skippedNonFbs } = await buildSchedule({ games, season, week, phase, teams, withWeather, espn, pbpLines: new Map([...(prior?.lines ?? []), ...(cur?.lines ?? [])]), ranks: ctx.ranks, today });
  console.log(`  ${schedule.length} FBS-vs-FBS games for weeks ${week}-${week + 1} (${skippedNonFbs} vs FCS skipped) · lines on ${schedule.filter((g) => g.homeSpread !== null).length} · weather on ${schedule.filter((g) => g.weather).length}`);
  if (skippedNonFbs) ctx.notes.push(`${skippedNonFbs} games against non-FBS opponents are not on the slate (no profile for the FCS side).`);

  // ---- validation ----
  const problems: string[] = [];
  if (teams.length !== TEAMS.length) problems.push(`expected ${TEAMS.length} teams, got ${teams.length}`);
  for (const t of teams) {
    if (!t.players.some((p) => p.pos === 'QB' && p.role === 'starter')) problems.push(`${t.abbr}: no starting QB on depth chart`);
    if (t.players.length < 10) problems.push(`${t.abbr}: only ${t.players.length} players`);
    const ratings = [t.offense.passEfficiency, t.offense.rushEfficiency, t.offense.explosiveness, t.offense.qb, t.offense.slotEfficiency, t.offense.teSpeed, t.defense.passDefense, t.defense.rushDefense, t.defense.nickelCorner, t.defense.lbCoverage, t.defense.takeaways, t.coaching.halftimeAdjust, t.coaching.redZoneAggression];
    if (ratings.some((v) => !Number.isFinite(v) || v < 1 || v > 10)) problems.push(`${t.abbr}: rating out of range ${JSON.stringify(ratings)}`);
    if (!(t.offense.pbwr > 0.4 && t.offense.pbwr < 0.8) || !(t.defense.prwr > 0.25 && t.defense.prwr < 0.65)) problems.push(`${t.abbr}: pbwr/prwr out of range`);
  }
  const ids = teams.flatMap((t) => t.players.map((p) => p.id));
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) problems.push(`duplicate player ids: ${[...new Set(dupes)].join(', ')}`);
  if (problems.length) {
    console.error('\nValidation failed:\n  ' + problems.join('\n  '));
    process.exitCode = 1;
    return;
  }

  // ---- write ----
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const gpList = teams.map((t) => gamesPlayed(cur, t.espnId));
  const meta = {
    generatedAt: today.toISOString(),
    season,
    priorSeason,
    currentWeek: week,
    phase,
    depthChartsAsOf: depth.ok ? today.toISOString() : null,
    poll: rankings?.poll ?? null,
    blend: {
      description: 'Team metrics = w·current season + (1−w)·prior season, w = games played / (games played + 4); each unit rating then blends toward the Elo-derived program strength with weight 0.12 + 0.33·(1−w).',
      gamesPlayedMin: Math.min(...gpList),
      gamesPlayedMax: Math.max(...gpList),
      currentWeightMin: Number(blendWeight(Math.min(...gpList)).toFixed(3)),
      currentWeightMax: Number(blendWeight(Math.max(...gpList)).toFixed(3)),
    },
    proxies: {
      talent: 'Program strength 1-10 = 5.5 + 1.6 × z-score of the latest CFBD Elo among FBS teams.',
      pbwr: 'Pass-block win rate proxy = 0.82 − 1.6 × (sacks + hurries allowed) / dropbacks, ± 0.01 per talent point.',
      prwr: 'Pass-rush win rate proxy = 0.26 + 1.3 × (sacks + hurries) / opponent dropbacks; per player from sacks and forced fumbles per game.',
      tprr: 'Targets per route run proxy = targets / (team dropbacks × estimated snap share).',
      snapPct: 'Snap shares are role-based estimates (college feeds publish no snap counts).',
      slotEfficiency: 'Offense EPA per target on throws ≤ 10 air yards.',
      nickelCorner: 'Defense EPA allowed per target on WR throws ≤ 10 air yards (inverted).',
      lbCoverage: 'Defense EPA allowed per target to TEs and RBs (inverted).',
      halftimeAdjust: '2nd-half minus 1st-half EPA/play margin, shrunk toward league average.',
      blitzRate: 'Not charted for college — 0.18 + 0.9 × havoc rate stands in for defensive aggression.',
      playActionRate: 'Not charted for college — curated per team (default 24%).',
      baseCoverage: 'Not available from free sources — curated per team in src/data/curated.ts.',
    },
    sources: sourceLog,
    notes: ctx.notes,
    teamMetrics: Object.fromEntries(built2.map((b) => [b.team.id, { gamesPlayed: b.gp, ...roundMetrics(b.metrics) }])),
  };
  fs.writeFileSync(path.join(OUT_DIR, 'teams.json'), JSON.stringify({ generatedAt: meta.generatedAt, season, week, phase, teams }, null, 1));
  fs.writeFileSync(path.join(OUT_DIR, 'schedule.json'), JSON.stringify({ generatedAt: meta.generatedAt, season, week, phase, games: schedule }, null, 1));
  fs.writeFileSync(path.join(OUT_DIR, 'meta.json'), JSON.stringify(meta, null, 1));

  const ok = sourceLog.filter((s) => s.ok).length;
  console.log(`\nWrote data/live/{teams,schedule,meta}.json · ${ok}/${sourceLog.length} sources OK · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  for (const s of sourceLog.filter((s) => !s.ok)) console.log(`  ✗ ${s.name}: ${s.note}`);
  for (const id of ['ohio-state', 'kent-state']) {
    const t = teams.find((x) => x.id === id)!;
    console.log(`\nSample — ${t.school} ${t.mascot} (${t.record}${t.rank ? `, #${t.rank}` : ''}) · Elo ${t.elo} · talent ${t.talent} · ${t.coaching.offScheme} / ${t.coaching.defFront} / ${t.coaching.baseCoverage}`);
    console.log(`  QB ${t.offense.qb} pass ${t.offense.passEfficiency} rush ${t.offense.rushEfficiency} expl ${t.offense.explosiveness} pbwr ${t.offense.pbwr} | passD ${t.defense.passDefense} rushD ${t.defense.rushDefense} prwr ${t.defense.prwr} blitz ${t.defense.blitzRate}`);
    console.log(`  pass ${t.coaching.passRate} pace ${t.coaching.pace} qbRun ${t.coaching.qbRunShare} 3rd ${t.coaching.thirdDownOff} 4th-go ${t.coaching.fourthDownGoRate} RZ ${t.coaching.redZoneTd}`);
    for (const p of t.players.slice(0, 14)) console.log(`  ${p.pos.padEnd(4)} ${p.role.padEnd(10)} ${String(p.rating).padStart(3)} ${p.name.padEnd(24)} snaps ${p.snapPct} ${p.targetShare !== undefined ? `tgt ${p.targetShare} tprr ${p.tprr}` : ''}${p.prwr !== undefined ? `prwr ${p.prwr}` : ''} ${p.reported ? `[${p.reported}: ${p.reportNote}]` : ''} ${p.note ?? ''}`);
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });

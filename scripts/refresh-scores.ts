/**
 * Fast score refresh — everything that has to move the moment a game ends,
 * without rebuilding the dataset.
 *
 *   npm run data:scores
 *
 * Reads the published data/live files, pulls the ESPN scoreboard (and the
 * CollegeFootballData schedule as a backstop), then updates:
 *   • team records in teams.json
 *   • final scores and status in schedule.json
 *   • grading of any locked prediction in predictions.json
 *
 * It never touches ratings, depth charts or rosters, so it is safe to run
 * every few minutes on a game day: seconds to run, and a diff of a few lines.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import type { Team } from '../src/engine/types';
import type { LivePredictionsFile, LiveScheduleFile, LiveTeamsFile, TeamRosterFile } from '../src/data/liveTypes';
import { loadSchedule } from '../pipeline/sources/cfbfastr';
import { loadScoreboard, type EspnGame } from '../pipeline/sources/espn';
import { weekByDate } from '../pipeline/compute/schedule';
import { grade } from '../pipeline/compute/predictions';
import { sourceLog } from '../pipeline/lib/fetch';

const OUT_DIR = path.resolve(__dirname, '../data/live');
const read = <T>(name: string): T | null => { try { return JSON.parse(fs.readFileSync(path.join(OUT_DIR, name), 'utf8')) as T; } catch { return null; } };
const write = (name: string, data: unknown) => fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(data, null, 1));

async function main() {
  const today = new Date();
  console.log(`\nCFB Gridiron AI score refresh — ${today.toISOString()}`);
  const teamsFile = read<LiveTeamsFile>('teams.json');
  const scheduleFile = read<LiveScheduleFile>('schedule.json');
  if (!teamsFile || !scheduleFile) { console.error('No published dataset yet — run npm run data:build first.'); process.exitCode = 1; return; }
  const season = teamsFile.season;

  const games = await loadSchedule(season, true);
  const dateWeek = weekByDate(games, season, today);
  const weeks = dateWeek.postseason ? [dateWeek.week] : [dateWeek.week - 1, dateWeek.week, dateWeek.week + 1].filter((w) => w >= 1);
  const boards = await Promise.all(weeks.map((w) => loadScoreboard(season, w, dateWeek.postseason ? 3 : 2)));
  const espn = new Map<string, EspnGame>(boards.flatMap((b) => [...b]));
  console.log(`  weeks ${weeks.join(', ')} · ${espn.size} games from ESPN · ${[...espn.values()].filter((g) => g.final).length} final · ${games.length} on the schedule file`);

  /** Final score for a game id, ESPN first (it posts within minutes), the schedule file second. */
  const finalOf = (id: string): { home: number; away: number } | null => {
    const e = espn.get(id);
    if (e?.final && e.homeScore !== null && e.awayScore !== null) return { home: e.homeScore, away: e.awayScore };
    const g = games.find((x) => x.game_id === id);
    if (g && Number.isFinite(g.home_points) && Number.isFinite(g.away_points)) return { home: g.home_points, away: g.away_points };
    return null;
  };

  // ---- records ----
  const byEspnId = new Map(teamsFile.teams.map((t) => [t.espnId, t]));
  const wl = new Map<number, { w: number; l: number }>();
  for (const g of games) {
    if (g.season !== season) continue;
    const f = finalOf(g.game_id);
    if (!f) continue;
    const h = wl.get(g.home_id) ?? { w: 0, l: 0 };
    const a = wl.get(g.away_id) ?? { w: 0, l: 0 };
    if (f.home > f.away) { h.w++; a.l++; } else if (f.home < f.away) { a.w++; h.l++; }
    wl.set(g.home_id, h); wl.set(g.away_id, a);
  }
  let recordChanges = 0;
  const teams: Team[] = teamsFile.teams.map((t) => {
    const r = wl.get(t.espnId);
    const rec = r ? `${r.w}-${r.l}` : '0-0';
    if (rec !== t.record) recordChanges++;
    return { ...t, record: rec };
  });

  // ---- schedule ----
  let scoreChanges = 0;
  const schedule = scheduleFile.games.map((g) => {
    if (g.status === 'final') return g;
    const f = finalOf(g.id);
    if (!f) return g;
    scoreChanges++;
    return { ...g, homeScore: f.home, awayScore: f.away, status: 'final' as const };
  });

  // ---- predictions ----
  const predFile = read<LivePredictionsFile>('predictions.json');
  let graded = 0;
  let locked = 0;
  if (predFile && predFile.season === season) {
    for (const r of predFile.records) {
      if (r.status === 'open' && Date.parse(r.kickoff) <= today.getTime()) { r.status = 'locked'; r.lockedAt = r.kickoff; locked++; }
      if (r.status === 'locked') {
        const f = finalOf(r.id);
        if (f) { r.result = grade(r, f.home, f.away); r.status = 'final'; graded++; }
      }
    }
  }

  // ---- roster records (the team page shows this one) ----
  let rosterChanges = 0;
  const rosterDir = path.join(OUT_DIR, 'rosters');
  if (fs.existsSync(rosterDir)) {
    for (const t of teams) {
      const p = path.join(rosterDir, `${t.id}.json`);
      let file: TeamRosterFile;
      try { file = JSON.parse(fs.readFileSync(p, 'utf8')) as TeamRosterFile; } catch { continue; }
      let touched = file.record !== (t.record ?? '0-0');
      file.record = t.record ?? '0-0';
      for (const g of file.schedule) {
        if (g.status === 'final') continue;
        const f = finalOf(g.id);
        if (!f) continue;
        // A neutral-site game is stored with home = false, so the schedule feed's team ids decide which side is which.
        const row = games.find((x) => x.game_id === g.id);
        const isHome = row ? row.home_id === t.espnId : g.home;
        g.teamScore = isHome ? f.home : f.away;
        g.oppScore = isHome ? f.away : f.home;
        g.result = g.teamScore > g.oppScore ? 'W' : 'L';
        g.status = 'final';
        touched = true;
      }
      const next = file.schedule.find((g) => g.status === 'scheduled');
      if (file.nextGameId !== (next?.id ?? null)) { file.nextGameId = next?.id ?? null; touched = true; }
      if (touched) { file.generatedAt = today.toISOString(); fs.writeFileSync(p, JSON.stringify(file)); rosterChanges++; }
    }
  }

  const stamp = today.toISOString();
  if (recordChanges || scoreChanges) {
    write('teams.json', { ...teamsFile, generatedAt: stamp, teams });
    write('schedule.json', { ...scheduleFile, generatedAt: stamp, games: schedule });
  }
  if (predFile && (graded || locked)) write('predictions.json', { ...predFile, generatedAt: stamp, records: predFile.records });

  const ok = sourceLog.filter((s) => s.ok).length;
  console.log(`  ${recordChanges} records changed · ${scoreChanges} games finalised · ${locked} predictions locked · ${graded} graded · ${rosterChanges} roster files touched · ${ok}/${sourceLog.length} sources OK`);
  if (!recordChanges && !scoreChanges && !graded && !locked && !rosterChanges) console.log('  Nothing to update.');
}

main().catch((e) => { console.error(e); process.exitCode = 1; });

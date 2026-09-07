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
import { loadBooks } from '../pipeline/sources/books';
import { loadTeamNews } from '../pipeline/sources/news';
import { weekByDate } from '../pipeline/compute/schedule';
import { grade } from '../pipeline/compute/predictions';
import { sourceLog } from '../pipeline/lib/fetch';

const OUT_DIR = path.resolve(__dirname, '../data/live');
const read = <T>(name: string): T | null => { try { return JSON.parse(fs.readFileSync(path.join(OUT_DIR, name), 'utf8')) as T; } catch { return null; } };
const write = (name: string, data: unknown) => fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(data, null, 1));
/** The schedule is a whole season now — written without indentation, as the build does. */
const writeCompact = (name: string, data: unknown) => fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(data));

async function main() {
  const today = new Date();
  console.log(`\nCFB Gridiron AI score refresh — ${today.toISOString()}`);
  const teamsFile = read<LiveTeamsFile>('teams.json');
  const scheduleFile = read<LiveScheduleFile>('schedule.json');
  if (!teamsFile || !scheduleFile) { console.error('No published dataset yet — run npm run data:build first.'); process.exitCode = 1; return; }
  const season = teamsFile.season;

  const games = await loadSchedule(season, true);
  const dateWeek = weekByDate(games, season, today);
  const fetchWeeks = dateWeek.postseason ? [dateWeek.week] : [dateWeek.week - 1, dateWeek.week, dateWeek.week + 1].filter((w) => w >= 1);
  const boards = await Promise.all(fetchWeeks.map((w) => loadScoreboard(season, w, dateWeek.postseason ? 3 : 2)));
  const espn = new Map<string, EspnGame>(boards.flatMap((b) => [...b]));
  console.log(`  weeks ${fetchWeeks.join(', ')} · ${espn.size} games from ESPN · ${[...espn.values()].filter((g) => g.final).length} final · ${games.length} on the schedule file`);

  /** Final score for a game id, ESPN first (it posts within minutes), the schedule file second. */
  const finalOf = (id: string): { home: number; away: number } | null => {
    const e = espn.get(id);
    if (e?.final && e.homeScore !== null && e.awayScore !== null) return { home: e.homeScore, away: e.awayScore };
    if (e?.live) return null; // a game under way has a score, but not a final one
    const g = games.find((x) => x.game_id === id);
    if (g && Number.isFinite(g.home_points) && Number.isFinite(g.away_points)) return { home: g.home_points, away: g.away_points };
    return null;
  };
  /** Score and clock for a game that is under way. */
  const liveOf = (id: string): { home: number; away: number; detail: string | null } | null => {
    const e = espn.get(id);
    return e?.live && e.homeScore !== null && e.awayScore !== null ? { home: e.homeScore, away: e.awayScore, detail: e.detail } : null;
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
  let liveChanges = 0;
  const schedule = scheduleFile.games.map((g) => {
    if (g.status === 'final') return g;
    const f = finalOf(g.id);
    if (f) { scoreChanges++; return { ...g, homeScore: f.home, awayScore: f.away, status: 'final' as const, statusDetail: null }; }
    const live = liveOf(g.id);
    if (!live) return g;
    if (g.status === 'in_progress' && g.homeScore === live.home && g.awayScore === live.away && g.statusDetail === live.detail) return g;
    liveChanges++;
    return { ...g, homeScore: live.home, awayScore: live.away, status: 'in_progress' as const, statusDetail: live.detail };
  });
  // Week counters follow the games, so the Slate's tabs stay accurate between builds.
  const weeks = scheduleFile.weeks?.map((w) => {
    const list = schedule.filter((g) => g.week === w.week && g.gameType === w.gameType);
    return { ...w, games: list.length, final: list.filter((g) => g.status === 'final').length, live: list.filter((g) => g.status === 'in_progress').length };
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

  /* ---- per-book lines ---------------------------------------------------
     College game ids are ESPN event ids, so the provider list comes straight
     off the event. Only games inside the window, and never a finished one. */
  let bookedGames = 0;
  const upcoming = schedule
    .filter((g) => g.status !== 'final' && Date.parse(g.kickoff) > Date.now() - 6 * 3_600_000)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
    .slice(0, 30);
  if (upcoming.length) {
    const books = await loadBooks('college-football', upcoming.map((g) => g.id));
    for (const g of upcoming) {
      const list = books.get(g.id);
      if (!list?.length) continue;
      (g as unknown as { books: unknown }).books = list;
      bookedGames += 1;
    }
    console.log(`  ${bookedGames}/${upcoming.length} games with per-book lines`);
  }

  /* ---- team headlines ---------------------------------------------------
     Only for programs with a game inside the window: 134 teams every twenty
     minutes would be rude, and nobody is reading Week 9 news for a team on a
     bye. */
  let newsFiles = 0;
  try {
    const soon = new Set<string>();
    for (const g of upcoming) { soon.add(g.awayId); soon.add(g.homeId); }
    const newsDir = path.join(OUT_DIR, 'news');
    fs.mkdirSync(newsDir, { recursive: true });
    const queue = teams.filter((t) => soon.has(t.id) && t.espnId).slice(0, 60).map((t) => t);
    const run = async () => {
      for (;;) {
        const t = queue.shift();
        if (!t) return;
        const items = await loadTeamNews('college-football', t.espnId).catch(() => []);
        if (!items.length) continue;
        fs.writeFileSync(path.join(newsDir, `${t.id}.json`), JSON.stringify({ teamId: t.id, generatedAt: today.toISOString(), items }));
        newsFiles += 1;
      }
    };
    await Promise.all([run(), run(), run(), run()]);
    console.log(`  ${newsFiles} team news files`);
  } catch {
    console.log('  team news unavailable this run');
  }

  const stamp = today.toISOString();
  if (recordChanges || scoreChanges || liveChanges || bookedGames) {
    if (recordChanges || scoreChanges) write('teams.json', { ...teamsFile, generatedAt: stamp, teams });
    writeCompact('schedule.json', { ...scheduleFile, generatedAt: stamp, weeks, games: schedule });
  }
  if (predFile && (graded || locked)) write('predictions.json', { ...predFile, generatedAt: stamp, records: predFile.records });

  const ok = sourceLog.filter((s) => s.ok).length;
  console.log(`  ${recordChanges} records changed · ${scoreChanges} games finalised · ${liveChanges} live updates · ${locked} predictions locked · ${graded} graded · ${rosterChanges} roster files touched · ${ok}/${sourceLog.length} sources OK`);
  if (!recordChanges && !scoreChanges && !liveChanges && !graded && !locked && !rosterChanges && !bookedGames && !newsFiles) console.log('  Nothing to update.');
}

main().catch((e) => { console.error(e); process.exitCode = 1; });

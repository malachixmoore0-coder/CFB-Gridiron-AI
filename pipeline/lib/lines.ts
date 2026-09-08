/**
 * What the number was, every time we looked.
 *
 * The build reads the market three times a day and, until now, wrote the
 * current number over the old one — so the app could tell you what the line is
 * and never what it was. That costs two things a betting product is judged on:
 * line movement, and closing line value, which is the only honest measure of
 * whether a model is actually beating the market rather than agreeing with it
 * loudly.
 *
 * So the numbers are kept. The file is append-only and deliberately small:
 *
 *   • a snapshot is written only when a number actually changes, which on a
 *     quiet game is once for the whole week;
 *   • only games the market has priced are tracked at all, which is a few dozen
 *     per league rather than the two thousand nine hundred fixtures baseball
 *     publishes;
 *   • the last number seen before kickoff becomes the close, and the game is
 *     then frozen — a closing line that keeps moving is not a closing line;
 *   • anything that finished six weeks ago is dropped, because a track record
 *     needs the season, not the archive.
 */
import fs from 'node:fs';
import path from 'node:path';

export interface LineSnapshot {
  at: string;
  /** Home line the way a book prints it: -3.5 = home favoured by 3.5. */
  spread: number | null;
  total: number | null;
  home: number | null;
  away: number | null;
}

export interface LineHistory {
  kickoff: string;
  opened: LineSnapshot;
  /** Every change after the open, oldest first. Excludes the close. */
  moves: LineSnapshot[];
  /** The last number seen before the game started. Null while it is open. */
  closed: LineSnapshot | null;
}

export interface LinesFile {
  league: string;
  generatedAt: string;
  games: Record<string, LineHistory>;
}

/** Games that finished longer ago than this are dropped. */
const KEEP_DAYS = 45;

export const emptyLines = (league: string): LinesFile =>
  ({ league, generatedAt: new Date().toISOString(), games: {} });

export function readLines(dir: string, league: string): LinesFile {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, 'lines.json'), 'utf8')) as LinesFile;
    return raw?.games ? raw : emptyLines(league);
  } catch { return emptyLines(league); }
}

export function writeLines(dir: string, file: LinesFile): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'lines.json'), JSON.stringify({ ...file, generatedAt: new Date().toISOString() }));
}

const same = (a: LineSnapshot, b: Omit<LineSnapshot, 'at'>) =>
  a.spread === b.spread && a.total === b.total && a.home === b.home && a.away === b.away;

const priced = (s: Omit<LineSnapshot, 'at'>) =>
  s.spread != null || s.total != null || s.home != null || s.away != null;

export interface PricedGame {
  id: string;
  kickoff: string;
  status: string;
  homeSpread: number | null;
  totalLine: number | null;
  homeMoneyline: number | null;
  awayMoneyline: number | null;
}

export interface LinesRun { tracked: number; opened: number; moved: number; closed: number; dropped: number }

/** Fold this run's numbers into the history and report what changed. */
export function recordLines(file: LinesFile, games: PricedGame[], now = new Date()): LinesRun {
  const at = now.toISOString();
  const run: LinesRun = { tracked: 0, opened: 0, moved: 0, closed: 0, dropped: 0 };

  for (const g of games) {
    const next = { spread: g.homeSpread, total: g.totalLine, home: g.homeMoneyline, away: g.awayMoneyline };
    const started = g.status !== 'scheduled' || Date.parse(g.kickoff) <= now.getTime();
    const seen = file.games[g.id];

    if (!seen) {
      // Nothing to open on a game nobody has priced, or one already under way:
      // a line first seen after kickoff is not an opening line.
      if (!priced(next) || started) continue;
      file.games[g.id] = { kickoff: g.kickoff, opened: { at, ...next }, moves: [], closed: null };
      run.opened += 1;
      run.tracked += 1;
      continue;
    }

    run.tracked += 1;
    const last = seen.moves[seen.moves.length - 1] ?? seen.opened;

    if (started) {
      // The close is the last number we saw before it started, and it is
      // written once. After that the game's history never changes again.
      if (!seen.closed) { seen.closed = last; run.closed += 1; }
      continue;
    }

    if (priced(next) && !same(last, next)) {
      seen.moves.push({ at, ...next });
      run.moved += 1;
    }
  }

  // A track record needs the season, not the archive.
  const cutoff = now.getTime() - KEEP_DAYS * 86_400_000;
  for (const [id, h] of Object.entries(file.games)) {
    if (h.closed && Date.parse(h.kickoff) < cutoff) { delete file.games[id]; run.dropped += 1; }
  }

  return run;
}

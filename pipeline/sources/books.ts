/**
 * Sportsbook lines, per book.
 *
 * ESPN's scoreboard only carries one consensus number. The core API carries a
 * list of providers per game — DraftKings, FanDuel, BetMGM, Caesars, ESPN BET
 * and whoever else is posting — and that list is the difference between "the
 * line is -3.5" and "three books have -3.5 and one still has -3, take the 3".
 *
 * Anything missing is left null rather than guessed: a half point invented here
 * would be a half point of imaginary edge downstream.
 */
import { fetchJson } from '../lib/fetch';

export interface BookLine {
  book: string;
  name: string;
  homeSpread: number | null;
  spreadHomeOdds: number | null;
  spreadAwayOdds: number | null;
  totalLine: number | null;
  overOdds: number | null;
  underOdds: number | null;
  homeMoneyline: number | null;
  awayMoneyline: number | null;
  updated?: string | null;
}

/** Books worth showing, in the order a bettor scans them. */
const RANK = ['draftkings', 'fanduel', 'betmgm', 'caesars', 'espnbet', 'bet365', 'pointsbet', 'consensus'];

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') { const n = Number(v.replace(/[^\d.+-]/g, '')); return Number.isFinite(n) ? n : null; }
  return null;
};

interface OddsItem {
  provider?: { id?: string; name?: string; $ref?: string };
  spread?: number | string;
  overUnder?: number | string;
  overOdds?: number | string;
  underOdds?: number | string;
  awayTeamOdds?: { moneyLine?: number; spreadOdds?: number | string };
  homeTeamOdds?: { moneyLine?: number; spreadOdds?: number | string };
  lastUpdated?: string;
}

/**
 * Every book on one event. `sport` is ESPN's league path, e.g. "nfl" or
 * "college-football".
 */
export async function loadEventBooks(sport: string, eventId: string, timeoutMs = 9000): Promise<BookLine[]> {
  const url = `https://sports.core.api.espn.com/v2/sports/football/leagues/${sport}/events/${eventId}/competitions/${eventId}/odds?limit=25`;
  const json = await fetchJson<{ items?: OddsItem[] }>(url, `odds ${eventId}`, timeoutMs).catch(() => null);
  const items = json?.items ?? [];
  const out: BookLine[] = [];
  for (const it of items) {
    const rawName = it.provider?.name ?? (it.provider?.$ref ? '' : '');
    if (!rawName) continue;
    const book = slug(rawName);
    if (out.some((b) => b.book === book)) continue;
    out.push({
      book,
      name: rawName,
      homeSpread: num(it.spread),
      spreadHomeOdds: num(it.homeTeamOdds?.spreadOdds) ?? -110,
      spreadAwayOdds: num(it.awayTeamOdds?.spreadOdds) ?? -110,
      totalLine: num(it.overUnder),
      overOdds: num(it.overOdds) ?? -110,
      underOdds: num(it.underOdds) ?? -110,
      homeMoneyline: num(it.homeTeamOdds?.moneyLine),
      awayMoneyline: num(it.awayTeamOdds?.moneyLine),
      updated: it.lastUpdated ?? null,
    });
  }
  return out.sort((a, b) => {
    const ai = RANK.indexOf(a.book); const bi = RANK.indexOf(b.book);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.name.localeCompare(b.name);
  });
}

/**
 * Books for a set of events, a few at a time so one refresh does not open forty
 * sockets at once. Events that fail are simply absent from the result.
 */
export async function loadBooks(sport: string, eventIds: string[], concurrency = 4): Promise<Map<string, BookLine[]>> {
  const out = new Map<string, BookLine[]>();
  const queue = [...eventIds];
  const worker = async () => {
    for (;;) {
      const id = queue.shift();
      if (!id) return;
      const books = await loadEventBooks(sport, id).catch(() => []);
      if (books.length) out.set(id, books);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, eventIds.length)) }, worker));
  return out;
}

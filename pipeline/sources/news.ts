/**
 * Team headlines.
 *
 * Pulled into the published feed rather than fetched per device: one job hitting
 * ESPN 32 times every twenty minutes, instead of every phone hitting it on every
 * team page. It also means the news survives on a plane, like the rest of the
 * dataset.
 */
import { fetchJson } from '../lib/fetch';

export interface NewsItem {
  id: string;
  headline: string;
  description: string;
  published: string;
  byline: string | null;
  link: string | null;
  image: string | null;
  source: string;
}

interface EspnArticle {
  id?: number | string;
  headline?: string;
  description?: string;
  published?: string;
  byline?: string;
  links?: { web?: { href?: string } };
  images?: { url?: string }[];
}

/** `sport` is ESPN's league path; `espnTeamId` its numeric team id. */
export async function loadTeamNews(sport: string, espnTeamId: string | number, limit = 6): Promise<NewsItem[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/${sport}/news?team=${espnTeamId}&limit=${limit}`;
  const json = await fetchJson<{ articles?: EspnArticle[] }>(url, `news ${espnTeamId}`, 9000).catch(() => null);
  return (json?.articles ?? []).slice(0, limit).map((a, i) => ({
    id: String(a.id ?? `${espnTeamId}-${i}`),
    headline: (a.headline ?? '').trim(),
    description: (a.description ?? '').trim(),
    published: a.published ?? '',
    byline: a.byline?.trim() || null,
    link: a.links?.web?.href ?? null,
    image: a.images?.[0]?.url ?? null,
    source: 'ESPN',
  })).filter((n) => n.headline);
}

/** The NFL team list, so headlines can be requested by ESPN's own team id. */
export async function loadEspnTeamIds(sport: string): Promise<Map<string, string>> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/${sport}/teams?limit=1000`;
  const json = await fetchJson<{ sports?: { leagues?: { teams?: { team?: { id?: string; abbreviation?: string } }[] }[] }[] }>(url, 'espn teams', 12000).catch(() => null);
  const out = new Map<string, string>();
  for (const t of json?.sports?.[0]?.leagues?.[0]?.teams ?? []) {
    const abbr = t.team?.abbreviation?.toLowerCase();
    const id = t.team?.id;
    if (abbr && id) out.set(abbr, String(id));
  }
  return out;
}

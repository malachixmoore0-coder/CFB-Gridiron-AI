/**
 * ESPN public endpoints — best-effort enrichment only (odds, rankings,
 * injuries, depth charts). These are undocumented, so every access is guarded
 * and any surprise in the payload just means we skip the enrichment and say
 * so in meta.json.
 */
import { fetchJson } from '../lib/fetch';
import { mapLimit } from '../lib/util';

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football';
const WEB = 'https://site.web.api.espn.com/apis/common/v3/sports/football/college-football';

export const espnLogo = (espnId: number) => `https://a.espncdn.com/i/teamlogos/ncaa/500/${espnId}.png`;

export interface EspnGame {
  id: string; kickoff: string; neutralSite: boolean; venue: string; broadcast: string | null; status: string;
  /** Scores when the game has started; `final` once ESPN marks it complete. */
  homeScore: number | null; awayScore: number | null; final: boolean;
  /** Under way right now (kicked off, not yet final). */
  live: boolean;
  /** Live clock, e.g. "Q3 8:24" or "Halftime". */
  detail: string | null;
  homeId: number; awayId: number; homeRank: number | null; awayRank: number | null;
  homeSpread: number | null; total: number | null; homeMoneyline: number | null; awayMoneyline: number | null; provider: string | null;
}

/** One week's FBS scoreboard (all games, with consensus odds where ESPN has them). */
export async function loadScoreboard(season: number, week: number, seasonType = 2): Promise<Map<string, EspnGame>> {
  const url = `${SITE}/scoreboard?groups=80&limit=400&dates=${season}&seasontype=${seasonType}&week=${week}`;
  const data = await fetchJson<any>(url, `ESPN scoreboard week ${week} (best-effort)`);
  const out = new Map<string, EspnGame>();
  try {
    for (const ev of Array.isArray(data?.events) ? data.events : []) {
      const comp = ev?.competitions?.[0];
      if (!ev?.id || !comp) continue;
      const home = (comp.competitors ?? []).find((c: any) => c?.homeAway === 'home');
      const away = (comp.competitors ?? []).find((c: any) => c?.homeAway === 'away');
      if (!home?.team?.id || !away?.team?.id) continue;
      const odds = comp.odds?.[0];
      let homeSpread: number | null = null;
      if (typeof odds?.spread === 'number') {
        // ESPN's `spread` is the home team's line already (negative = home favoured) in the scoreboard payload.
        homeSpread = odds.spread;
      } else if (typeof odds?.details === 'string') {
        const m = odds.details.match(/^([A-Z&'-]+)\s+(-?\d+(?:\.\d+)?)$/);
        if (m) {
          const line = Number(m[2]);
          const favIsHome = m[1] === home.team.abbreviation;
          homeSpread = favIsHome ? line : -line;
        } else if (/EVEN/i.test(odds.details)) homeSpread = 0;
      }
      const rank = (c: any) => { const r = Number(c?.curatedRank?.current); return Number.isFinite(r) && r >= 1 && r <= 25 ? r : null; };
      const st = String(comp.status?.type?.name ?? '');
      const started = st !== 'STATUS_SCHEDULED' && st !== '';
      const sc = (c: any) => { const v = Number(c?.score); return started && Number.isFinite(v) ? v : null; };
      out.set(String(ev.id), {
        id: String(ev.id), kickoff: String(comp.date ?? ev.date ?? ''), neutralSite: !!comp.neutralSite, venue: String(comp.venue?.fullName ?? ''),
        broadcast: comp.broadcasts?.[0]?.names?.[0] ?? comp.geoBroadcasts?.[0]?.media?.shortName ?? null, status: st,
        homeScore: sc(home), awayScore: sc(away), final: st === 'STATUS_FINAL' || !!comp.status?.type?.completed,
        live: started && !(st === 'STATUS_FINAL' || !!comp.status?.type?.completed) && st !== 'STATUS_POSTPONED' && st !== 'STATUS_CANCELED',
        detail: (comp.status?.type?.shortDetail ?? comp.status?.type?.detail ?? null) || null,
        homeId: Number(home.team.id), awayId: Number(away.team.id), homeRank: rank(home), awayRank: rank(away),
        homeSpread, total: typeof odds?.overUnder === 'number' ? odds.overUnder : null,
        homeMoneyline: typeof odds?.homeTeamOdds?.moneyLine === 'number' ? odds.homeTeamOdds.moneyLine : null,
        awayMoneyline: typeof odds?.awayTeamOdds?.moneyLine === 'number' ? odds.awayTeamOdds.moneyLine : null,
        provider: odds?.provider?.name ?? null,
      });
    }
  } catch {
    return new Map();
  }
  return out;
}

/** AP Top 25 (falls back to the first poll ESPN lists). */
export async function loadRankings(): Promise<{ poll: string; ranks: Map<number, number> } | null> {
  const data = await fetchJson<any>(`${SITE}/rankings`, 'ESPN rankings (best-effort)');
  try {
    const polls: any[] = Array.isArray(data?.rankings) ? data.rankings : [];
    const poll = polls.find((p) => /AP/i.test(String(p?.name ?? p?.shortName ?? ''))) ?? polls[0];
    if (!poll) return null;
    const ranks = new Map<number, number>();
    for (const r of Array.isArray(poll.ranks) ? poll.ranks : []) {
      const id = Number(r?.team?.id);
      const cur = Number(r?.current);
      if (Number.isFinite(id) && Number.isFinite(cur) && cur >= 1) ranks.set(id, cur);
    }
    return ranks.size ? { poll: String(poll.name ?? poll.shortName ?? 'Poll'), ranks } : null;
  } catch {
    return null;
  }
}

export interface EspnInjury { teamId: number; name: string; status: string; detail: string; }

/** Current injury / availability list per team from ESPN. Returns [] when unreachable or unexpected. */
export async function loadEspnInjuries(): Promise<EspnInjury[]> {
  const data = await fetchJson<any>(`${SITE}/injuries`, 'ESPN injuries (best-effort)');
  const out: EspnInjury[] = [];
  try {
    const teams: any[] = Array.isArray(data?.injuries) ? data.injuries : [];
    for (const t of teams) {
      const teamId = Number(t?.team?.id ?? t?.id);
      const list: any[] = Array.isArray(t?.injuries) ? t.injuries : [];
      for (const inj of list) {
        const name = inj?.athlete?.displayName ?? inj?.athlete?.fullName;
        const status = inj?.status ?? inj?.type?.description;
        if (!Number.isFinite(teamId) || !name || !status) continue;
        out.push({ teamId, name: String(name), status: String(status), detail: String(inj?.details?.type ?? inj?.shortComment ?? '') });
      }
    }
  } catch {
    return [];
  }
  return out;
}

export interface DepthRow { teamId: number; group: string; pos_abb: string; pos_rank: number; athlete_id: string; name: string; }

/**
 * ESPN depth charts for a set of teams (concurrency-limited). ESPN does not
 * currently publish these for college teams (the endpoint 404s), so a single
 * probe decides whether the rest are worth requesting at all.
 */
export async function loadDepthCharts(teamIds: number[]): Promise<{ byTeam: Map<number, DepthRow[]>; ok: number }> {
  const byTeam = new Map<number, DepthRow[]>();
  let failures = 0;
  let ok = 0;
  if (!teamIds.length) return { byTeam, ok };
  const probe = await fetchJson<any>(`${WEB}/teams/${teamIds[0]}/depthcharts`, 'ESPN depth charts (probe, best-effort)', 12_000);
  if (!probe) return { byTeam, ok };
  await mapLimit(teamIds, 4, async (id) => {
    if (failures >= 6 && ok === 0) return; // endpoint changed shape — stop hammering it
    const data = await fetchJson<any>(`${WEB}/teams/${id}/depthcharts`, `ESPN depth chart ${id}`, 12_000);
    try {
      const groups: any[] = Array.isArray(data?.depthchart) ? data.depthchart : Array.isArray(data?.items) ? data.items : [];
      const rows: DepthRow[] = [];
      for (const g of groups) {
        const positions = g?.positions ?? {};
        for (const key of Object.keys(positions)) {
          const p = positions[key];
          const abb = String(p?.position?.abbreviation ?? key).toUpperCase();
          for (const a of Array.isArray(p?.athletes) ? p.athletes : []) {
            const athleteId = String(a?.athlete?.id ?? a?.id ?? '');
            const name = String(a?.athlete?.displayName ?? a?.athlete?.fullName ?? '');
            const rank = Number(a?.rank ?? a?.slot ?? 0);
            if (!athleteId || !name) continue;
            rows.push({ teamId: id, group: String(g?.name ?? ''), pos_abb: abb, pos_rank: rank || rows.filter((r) => r.pos_abb === abb).length + 1, athlete_id: athleteId, name });
          }
        }
      }
      if (rows.length) { byTeam.set(id, rows); ok++; } else failures++;
    } catch {
      failures++;
    }
  });
  return { byTeam, ok };
}

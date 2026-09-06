import type { RosterPlayer, RosterPositionLabel, StatLine, TeamRosterFile } from '@/data/liveTypes';

/** Published roster files drop zero counters — read them back as 0. */
export const stat = (line: StatLine | null | undefined, key: keyof StatLine): number => (line?.[key] ?? 0);

/**
 * Ask the image host for a small, face-cropped derivative.
 *
 * Both feeds hand out full-resolution portraits — the NFL's are Cloudinary
 * originals well over a megapixel. A roster page shows ~90 of them at once,
 * which is enough to exhaust the memory an installed iOS web app is given and
 * take the whole page down with it, so never request the original.
 */
export function sizedHeadshot(url: string, px: number): string {
  const size = Math.round(px);
  // Cloudinary (NFL): transforms live in the path segment after /upload/.
  if (url.includes('/image/upload/')) {
    return url.replace(/\/image\/upload\/([^/]*)\//, (_m, transform: string) => {
      const kept = String(transform).split(',').filter((t) => !/^[wh]_|^c_|^g_|^dpr_/.test(t));
      return `/image/upload/${[...kept, `w_${size}`, `h_${size}`, 'c_fill', 'g_face', 'dpr_2.0'].filter(Boolean).join(',')}/`;
    });
  }
  // ESPN's image CDN takes width/height as query parameters.
  if (url.includes('espncdn.com')) return `${url}${url.includes('?') ? '&' : '?'}w=${size * 2}&h=${size * 2}`;
  return url;
}

/**
 * Headshot for a player: an explicit URL, else the feed's derived one, always
 * requested at roughly the size it will be drawn. Null means show initials.
 */
export function headshotOf(p: RosterPlayer, file: TeamRosterFile | null | undefined, px = 48): string | null {
  const url = p.headshotUrl ?? (file?.headshotBase ? `${file.headshotBase}${p.athleteId}.png` : null);
  return url ? sizedHeadshot(url, px) : null;
}

export const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

export const STRING_LABEL = (n: number) => (n === 1 ? '1st string' : n === 2 ? '2nd string' : n === 3 ? '3rd string' : `${n}th string`);

export const POSITION_NAME: Record<RosterPositionLabel, string> = {
  QB: 'Quarterbacks', RB: 'Running backs', WR: 'Wide receivers', TE: 'Tight ends', OL: 'Offensive line',
  EDGE: 'Edge rushers', DT: 'Defensive tackles', LB: 'Linebackers', CB: 'Cornerbacks', NCB: 'Nickel backs', S: 'Safeties',
  K: 'Kickers', P: 'Punters', LS: 'Long snappers',
};

export const UNIT_NAME: Record<RosterPlayer['unit'], string> = { offense: 'Offense', defense: 'Defense', special: 'Special teams' };

/**
 * One-line stat summary for a roster row. Falls back to last season when this
 * one has not started (or the player has not played), so a roster row is never
 * blank for an established player.
 */
export function seasonLine(p: RosterPlayer): string | null {
  const cur = lineFor(p, p.season);
  if (cur) return cur;
  const prior = p.prior ? lineFor(p, p.prior) : null;
  return prior ? `${prior} · last yr` : null;
}

function lineFor(p: RosterPlayer, s: StatLine & { games: number }): string | null {
  if (!s.games) return null;
  const g = s.games;
  const v = (k: keyof StatLine) => stat(s, k);
  const per = (x: number) => (x / g).toFixed(1);
  switch (p.pos) {
    case 'QB': {
      if (!v('passAtt')) return null;
      return `${v('passCmp')}/${v('passAtt')} · ${v('passYds')} yds · ${v('passTd')} TD · ${v('passInt')} INT`;
    }
    case 'RB':
      return v('rushAtt') || v('rec') ? `${v('rushAtt')} car · ${v('rushYds')} yds · ${v('rushTd') + v('recTd')} TD${v('rec') ? ` · ${v('rec')} rec` : ''}` : null;
    case 'WR': case 'TE':
      return v('tgt') ? `${v('rec')}/${v('tgt')} · ${v('recYds')} yds · ${v('recTd')} TD` : null;
    case 'EDGE': case 'DT': case 'LB':
      return v('sacks') || v('int') || v('pbu') || v('ff') ? `${v('sacks')} sk · ${v('pbu')} PBU · ${v('int')} INT · ${v('ff')} FF` : null;
    case 'CB': case 'NCB': case 'S':
      return v('pbu') || v('int') ? `${v('pbu')} PBU · ${v('int')} INT${v('ff') ? ` · ${v('ff')} FF` : ''}` : null;
    case 'K':
      return v('fga') ? `${v('fgm')}/${v('fga')} FG` : null;
    default:
      return v('epa') ? `${per(v('epa'))} EPA/g` : null;
  }
}

/** Column set for a position's game log table. */
export interface LogColumn { key: keyof StatLine; label: string; }
export function logColumns(pos: RosterPositionLabel): LogColumn[] {
  switch (pos) {
    case 'QB': return [{ key: 'passCmp', label: 'CMP' }, { key: 'passAtt', label: 'ATT' }, { key: 'passYds', label: 'YDS' }, { key: 'passTd', label: 'TD' }, { key: 'passInt', label: 'INT' }, { key: 'rushYds', label: 'RUSH' }];
    case 'RB': return [{ key: 'rushAtt', label: 'CAR' }, { key: 'rushYds', label: 'YDS' }, { key: 'rushTd', label: 'TD' }, { key: 'rec', label: 'REC' }, { key: 'recYds', label: 'RYDS' }];
    case 'WR': case 'TE': return [{ key: 'tgt', label: 'TGT' }, { key: 'rec', label: 'REC' }, { key: 'recYds', label: 'YDS' }, { key: 'recTd', label: 'TD' }];
    case 'EDGE': case 'DT': case 'LB': return [{ key: 'sacks', label: 'SK' }, { key: 'pbu', label: 'PBU' }, { key: 'int', label: 'INT' }, { key: 'ff', label: 'FF' }];
    case 'CB': case 'NCB': case 'S': return [{ key: 'pbu', label: 'PBU' }, { key: 'int', label: 'INT' }, { key: 'ff', label: 'FF' }];
    case 'K': return [{ key: 'fgm', label: 'FGM' }, { key: 'fga', label: 'FGA' }];
    default: return [{ key: 'epa', label: 'EPA' }];
  }
}

/** Group a roster into unit → position → players, preserving the file's order. */
export interface PositionGroup { pos: RosterPositionLabel; players: RosterPlayer[]; }
export function groupRoster(roster: RosterPlayer[]): { unit: RosterPlayer['unit']; groups: PositionGroup[] }[] {
  const units: RosterPlayer['unit'][] = ['offense', 'defense', 'special'];
  return units.map((unit) => {
    const inUnit = roster.filter((p) => p.unit === unit);
    const positions = [...new Set(inUnit.map((p) => p.pos))];
    return { unit, groups: positions.map((pos) => ({ pos, players: inUnit.filter((p) => p.pos === pos).sort((a, b) => a.rank - b.rank) })) };
  }).filter((u) => u.groups.length > 0);
}

/** Group a roster by string (1st, 2nd, …) for the depth-chart view. */
export function groupByString(roster: RosterPlayer[]): { string: number; players: RosterPlayer[] }[] {
  const strings = [...new Set(roster.map((p) => p.string))].sort((a, b) => a - b);
  const order = (p: RosterPlayer) => Object.keys(POSITION_NAME).indexOf(p.pos);
  return strings.map((s) => ({ string: s, players: roster.filter((p) => p.string === s).sort((a, b) => order(a) - order(b) || a.rank - b.rank) }));
}

/* ------------------------------------------------------------------ */
/* Box scores                                                           */
/* ------------------------------------------------------------------ */

export interface BoxLine { player: RosterPlayer; stats: StatLine; line: string; sort: number; }
export interface BoxCategory { key: 'passing' | 'rushing' | 'receiving' | 'defense' | 'kicking'; title: string; columns: LogColumn[]; lines: BoxLine[]; }

/** Team totals for one game, summed from the players who recorded something. */
export interface BoxTotals { passYds: number; rushYds: number; recYds: number; passTd: number; rushTd: number; turnovers: number; sacks: number; takeaways: number; plays: number; }

const num = (l: StatLine, k: keyof StatLine) => l[k] ?? 0;

/**
 * One team's box score for a single game, assembled from the per-game lines in
 * its roster file. Only players who actually recorded something appear.
 */
export function boxScore(roster: RosterPlayer[], gameId: string): { categories: BoxCategory[]; totals: BoxTotals } {
  const entries = roster
    .map((player) => ({ player, log: player.games.find((g) => g.gameId === gameId) }))
    .filter((e): e is { player: RosterPlayer; log: NonNullable<typeof e.log> } => !!e.log);

  const cat = (
    key: BoxCategory['key'],
    title: string,
    columns: LogColumn[],
    include: (s: StatLine) => boolean,
    line: (s: StatLine) => string,
    sort: (s: StatLine) => number,
  ): BoxCategory => ({
    key, title, columns,
    lines: entries
      .filter((e) => include(e.log.stats))
      .map((e) => ({ player: e.player, stats: e.log.stats, line: line(e.log.stats), sort: sort(e.log.stats) }))
      .sort((a, b) => b.sort - a.sort),
  });

  const categories = [
    cat('passing', 'Passing', [{ key: 'passCmp', label: 'CMP' }, { key: 'passAtt', label: 'ATT' }, { key: 'passYds', label: 'YDS' }, { key: 'passTd', label: 'TD' }, { key: 'passInt', label: 'INT' }],
      (s) => num(s, 'passAtt') > 0,
      (s) => `${num(s, 'passCmp')}/${num(s, 'passAtt')} · ${num(s, 'passYds')} yds`,
      (s) => num(s, 'passYds')),
    cat('rushing', 'Rushing', [{ key: 'rushAtt', label: 'CAR' }, { key: 'rushYds', label: 'YDS' }, { key: 'rushTd', label: 'TD' }],
      (s) => num(s, 'rushAtt') > 0,
      (s) => `${num(s, 'rushAtt')} car · ${num(s, 'rushYds')} yds`,
      (s) => num(s, 'rushYds')),
    cat('receiving', 'Receiving', [{ key: 'rec', label: 'REC' }, { key: 'tgt', label: 'TGT' }, { key: 'recYds', label: 'YDS' }, { key: 'recTd', label: 'TD' }],
      (s) => num(s, 'tgt') > 0,
      (s) => `${num(s, 'rec')}/${num(s, 'tgt')} · ${num(s, 'recYds')} yds`,
      (s) => num(s, 'recYds')),
    cat('defense', 'Defense', [{ key: 'sacks', label: 'SK' }, { key: 'int', label: 'INT' }, { key: 'pbu', label: 'PBU' }, { key: 'ff', label: 'FF' }],
      (s) => num(s, 'sacks') + num(s, 'int') + num(s, 'pbu') + num(s, 'ff') > 0,
      (s) => `${num(s, 'sacks')} sk · ${num(s, 'int')} INT`,
      (s) => num(s, 'sacks') * 3 + num(s, 'int') * 4 + num(s, 'pbu') + num(s, 'ff') * 2),
    cat('kicking', 'Kicking', [{ key: 'fgm', label: 'FGM' }, { key: 'fga', label: 'FGA' }],
      (s) => num(s, 'fga') > 0,
      (s) => `${num(s, 'fgm')}/${num(s, 'fga')} FG`,
      (s) => num(s, 'fgm')),
  ].filter((c) => c.lines.length > 0);

  const sum = (k: keyof StatLine) => entries.reduce((n, e) => n + num(e.log.stats, k), 0);
  return {
    categories,
    totals: {
      passYds: sum('passYds'), rushYds: sum('rushYds'), recYds: sum('recYds'),
      passTd: sum('passTd'), rushTd: sum('rushTd'),
      turnovers: sum('passInt'), sacks: sum('sacks'), takeaways: sum('int') + sum('ff'),
      plays: sum('passAtt') + sum('rushAtt'),
    },
  };
}

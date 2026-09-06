import type { RosterPlayer, RosterPositionLabel, StatLine, TeamRosterFile } from '@/data/liveTypes';

/** Published roster files drop zero counters — read them back as 0. */
export const stat = (line: StatLine | null | undefined, key: keyof StatLine): number => (line?.[key] ?? 0);

/** Headshot for a player: an explicit URL, else the feed's derived one. Null means show initials. */
export const headshotOf = (p: RosterPlayer, file: TeamRosterFile | null | undefined): string | null =>
  p.headshotUrl ?? (file?.headshotBase ? `${file.headshotBase}${p.athleteId}.png` : null);

export const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

export const STRING_LABEL = (n: number) => (n === 1 ? '1st string' : n === 2 ? '2nd string' : n === 3 ? '3rd string' : `${n}th string`);

export const POSITION_NAME: Record<RosterPositionLabel, string> = {
  QB: 'Quarterbacks', RB: 'Running backs', WR: 'Wide receivers', TE: 'Tight ends', OL: 'Offensive line',
  EDGE: 'Edge rushers', DT: 'Defensive tackles', LB: 'Linebackers', CB: 'Cornerbacks', NCB: 'Nickel backs', S: 'Safeties',
  K: 'Kickers', P: 'Punters', LS: 'Long snappers',
};

export const UNIT_NAME: Record<RosterPlayer['unit'], string> = { offense: 'Offense', defense: 'Defense', special: 'Special teams' };

/** One-line season stat summary for a roster row, by position group. */
export function seasonLine(p: RosterPlayer): string | null {
  const s = p.season;
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

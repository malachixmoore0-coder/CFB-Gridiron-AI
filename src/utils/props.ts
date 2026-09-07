/**
 * Player prop projections.
 *
 * The honest version of a prop model: take what a player has actually done per
 * game, blend this season with last (weighted by how much of this season there
 * is), then scale by the game the model is projecting — a team the engine has
 * scoring 45 will throw and run more than the same team projected for 20.
 *
 * The interval is the part most prop tools skip. A projection of 248 passing
 * yards with a range of 180-320 tells you the over at 249.5 is a coin flip; the
 * point estimate alone does not. Ranges are one standard deviation, using the
 * historical game-to-game spread of each stat rather than anything fitted.
 */
import type { RosterPlayer, StatLine } from '@/data/liveTypes';

export interface PropLine {
  key: string;
  label: string;
  projection: number;
  low: number;
  high: number;
  /** Where the number came from, in words. */
  basis: string;
}

/** Typical game-to-game standard deviation as a share of the mean. */
const SPREAD: Record<string, number> = {
  passYds: 0.28, passTd: 0.55, passCmp: 0.22, rushYds: 0.42, rushTd: 0.8, rec: 0.35, recYds: 0.48, tgt: 0.3, sacks: 0.9, int: 1.1, pbu: 0.7, ff: 1.2,
};

const per = (line: StatLine | null | undefined, key: keyof StatLine, games: number | undefined) => {
  const v = (line?.[key] as number | undefined) ?? 0;
  const g = games ?? 0;
  return g > 0 ? v / g : 0;
};

/** League-average points a team is expected to score, used as the pace baseline. */
export const BASELINE_POINTS = 27.5;

export function propsFor(player: RosterPlayer, projectedPoints: number | null): PropLine[] {
  const sg = player.season?.games ?? 0;
  const pg = player.prior?.games ?? 0;
  if (!sg && !pg) return [];

  // Weight this season more as it accumulates; four games is where it takes over.
  const w = sg / (sg + 4);
  const rate = (key: keyof StatLine) => per(player.season, key, sg) * w + per(player.prior, key, pg) * (1 - w);

  // A projected shootout lifts volume; a projected rock fight cuts it.
  const scale = projectedPoints == null ? 1 : Math.max(0.7, Math.min(1.35, projectedPoints / BASELINE_POINTS));

  const line = (key: keyof StatLine, label: string, dp = 0): PropLine | null => {
    const base = rate(key) * scale;
    if (base < 0.35) return null;
    const sd = base * (SPREAD[key as string] ?? 0.4);
    const round = (v: number) => Number(Math.max(0, v).toFixed(dp));
    return {
      key: key as string,
      label,
      projection: round(base),
      low: round(base - sd),
      high: round(base + sd),
      basis: sg ? `${sg} game${sg === 1 ? '' : 's'} this season${pg ? ` + ${pg} last` : ''}` : `${pg} games last season`,
    };
  };

  const out: (PropLine | null)[] = [];
  switch (player.pos) {
    case 'QB':
      out.push(line('passYds', 'Passing yards'), line('passCmp', 'Completions'), line('passTd', 'Passing TDs', 1), line('rushYds', 'Rushing yards'));
      break;
    case 'RB':
      out.push(line('rushYds', 'Rushing yards'), line('rushAtt', 'Carries'), line('rec', 'Receptions', 1), line('recYds', 'Receiving yards'));
      break;
    case 'WR':
    case 'TE':
      out.push(line('rec', 'Receptions', 1), line('recYds', 'Receiving yards'), line('tgt', 'Targets', 1), line('recTd', 'Receiving TDs', 1));
      break;
    default:
      out.push(line('sacks', 'Sacks', 1), line('int', 'Interceptions', 1), line('pbu', 'Passes broken up', 1), line('ff', 'Forced fumbles', 1));
  }
  return out.filter(Boolean) as PropLine[];
}

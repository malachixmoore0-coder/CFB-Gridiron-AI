import type { PredictionRecord } from '@/data/liveTypes';

export interface RecordSummary {
  finals: number;
  su: number;
  ats: number; atsL: number; atsP: number;
  ou: number; ouL: number; ouP: number;
  brier: number | null;
  /** Mean absolute error of the projected margin and total, in points. */
  spreadMae: number | null;
  totalMae: number | null;
  /** Share of finals where the model favourite was also the market favourite (or no line). */
  open: number;
  locked: number;
}

export function summarize(records: PredictionRecord[]): RecordSummary {
  const finals = records.filter((r) => r.status === 'final' && r.result);
  const n = finals.length;
  const count = (f: (r: PredictionRecord) => boolean) => finals.filter(f).length;
  return {
    finals: n,
    su: count((r) => r.result!.suCorrect),
    ats: count((r) => r.result!.ats === 'win'), atsL: count((r) => r.result!.ats === 'loss'), atsP: count((r) => r.result!.ats === 'push'),
    ou: count((r) => r.result!.ou === 'win'), ouL: count((r) => r.result!.ou === 'loss'), ouP: count((r) => r.result!.ou === 'push'),
    brier: n ? finals.reduce((s, r) => s + r.result!.brier, 0) / n : null,
    spreadMae: n ? finals.reduce((s, r) => s + Math.abs(r.result!.spreadError), 0) / n : null,
    totalMae: n ? finals.reduce((s, r) => s + Math.abs(r.result!.totalError), 0) / n : null,
    open: records.filter((r) => r.status === 'open').length,
    locked: records.filter((r) => r.status === 'locked').length,
  };
}

export const pctOf = (hits: number, n: number) => (n ? `${Math.round((hits / n) * 100)}%` : '—');

export interface CalibrationRow { label: string; lo: number; hi: number; games: number; favWins: number; expected: number; }

/**
 * Calibration by favourite confidence: for games where the model favourite
 * had 50-60%, 60-70%, … how often did that favourite actually win, versus the
 * average probability it was given?
 */
export function calibration(records: PredictionRecord[]): CalibrationRow[] {
  const finals = records.filter((r) => r.status === 'final' && r.result);
  const rows: CalibrationRow[] = [
    { label: '50–60%', lo: 50, hi: 60, games: 0, favWins: 0, expected: 0 },
    { label: '60–70%', lo: 60, hi: 70, games: 0, favWins: 0, expected: 0 },
    { label: '70–80%', lo: 70, hi: 80, games: 0, favWins: 0, expected: 0 },
    { label: '80–90%', lo: 80, hi: 90, games: 0, favWins: 0, expected: 0 },
    { label: '90–100%', lo: 90, hi: 101, games: 0, favWins: 0, expected: 0 },
  ];
  for (const r of finals) {
    const favPct = Math.max(r.homeWinPct, r.awayWinPct);
    const row = rows.find((x) => favPct >= x.lo && favPct < x.hi);
    if (!row) continue;
    row.games++;
    row.expected += favPct;
    if (r.result!.suCorrect) row.favWins++;
  }
  return rows;
}

import type { InjuryImpact, InjuryStatus, MatchupInput, Player, Team } from './types';
import { INJURY_DEGRADATION, POINTS_PER_WIN_PCT } from './weights';
import { clamp } from './math';

/** How much of the full positional degradation a given role's absence carries. */
const ROLE_FACTOR: Record<Player['role'], number> = { starter: 1, rotational: 0.5, depth: 0.2 };
const STATUS_FACTOR: Record<InjuryStatus, number> = { healthy: 0, questionable: 0.5, out: 1 };

/** Multiplicative losses (0-1) applied to the affected unit of a team profile. */
export interface UnitDegradation {
  qb: number;
  passPro: number;
  passEff: number;
  rushEff: number;
  redZone: number;
  passRush: number;
  runStop: number;
  coverage: number;
  slotCoverage: number;
  lbCoverage: number;
}

const ZERO: UnitDegradation = {
  qb: 0, passPro: 0, passEff: 0, rushEff: 0, redZone: 0,
  passRush: 0, runStop: 0, coverage: 0, slotCoverage: 0, lbCoverage: 0,
};

export function statusFor(player: Player, input: MatchupInput): InjuryStatus {
  if (input.injuredOut?.includes(player.id)) return 'out';
  if (input.questionable?.includes(player.id)) return 'questionable';
  return 'healthy';
}

/** Compute injury impacts for one side and the resulting unit degradation. */
export function assessInjuries(
  team: Team,
  side: 'home' | 'away',
  input: MatchupInput,
): { impacts: InjuryImpact[]; degradation: UnitDegradation; pointsLost: number } {
  const degradation: UnitDegradation = { ...ZERO };
  const impacts: InjuryImpact[] = [];
  let pointsLost = 0;

  for (const p of team.players) {
    const status = statusFor(p, input);
    if (status === 'healthy') continue;
    const spec = INJURY_DEGRADATION[p.pos];
    const factor = ROLE_FACTOR[p.role] * STATUS_FACTOR[status];
    // Better players hurt more to lose: a 90-grade starter is a bigger hole than a 65.
    const quality = 0.6 + (clamp(p.rating, 40, 99) - 40) / 100;
    const winEff = spec.winEff * factor * quality;
    const pts = winEff * POINTS_PER_WIN_PCT;
    pointsLost += pts;

    // Translate win-efficiency loss into the unit it actually hits.
    const unitLoss = clamp((spec.winEff / 100) * factor * quality * 1.6, 0, 0.6);
    switch (p.pos) {
      case 'QB': degradation.qb += unitLoss; degradation.passEff += unitLoss * 0.6; break;
      case 'LT': degradation.passPro += unitLoss; break;
      case 'OL': degradation.passPro += unitLoss * 0.7; degradation.rushEff += unitLoss * 0.5; break;
      case 'WR': degradation.passEff += unitLoss; break;
      case 'TE': degradation.redZone += unitLoss; degradation.passEff += unitLoss * 0.4; break;
      case 'RB': degradation.rushEff += unitLoss; break;
      case 'EDGE': degradation.passRush += unitLoss; break;
      case 'DT': degradation.runStop += unitLoss; degradation.passRush += unitLoss * 0.3; break;
      case 'LB': degradation.lbCoverage += unitLoss; degradation.runStop += unitLoss * 0.5; break;
      case 'CB': degradation.coverage += unitLoss; break;
      case 'NCB': degradation.slotCoverage += unitLoss; degradation.coverage += unitLoss * 0.4; break;
      case 'S': degradation.coverage += unitLoss * 0.7; break;
      case 'K': degradation.redZone += unitLoss * 0.5; break;
    }

    impacts.push({
      player: p,
      team: side,
      status,
      metric: status === 'questionable' ? `${spec.label} (½ — questionable)` : spec.label,
      pointsLost: Math.round(pts * 10) / 10,
    });
  }

  (Object.keys(degradation) as (keyof UnitDegradation)[]).forEach((k) => {
    degradation[k] = clamp(degradation[k], 0, 0.7);
  });

  return { impacts, degradation, pointsLost };
}

/** Return a copy of the team with its unit ratings degraded by the injury report. */
export function applyDegradation(team: Team, d: UnitDegradation): Team {
  const scale = (v: number, loss: number) => Math.max(1, v * (1 - loss));
  return {
    ...team,
    offense: {
      ...team.offense,
      qb: scale(team.offense.qb, d.qb),
      passEfficiency: scale(team.offense.passEfficiency, d.passEff),
      rushEfficiency: scale(team.offense.rushEfficiency, d.rushEff),
      explosiveness: scale(team.offense.explosiveness, d.passEff * 0.5),
      pbwr: team.offense.pbwr * (1 - d.passPro),
      teSpeed: scale(team.offense.teSpeed, d.redZone * 0.5),
    },
    defense: {
      ...team.defense,
      prwr: team.defense.prwr * (1 - d.passRush),
      rushDefense: scale(team.defense.rushDefense, d.runStop),
      passDefense: scale(team.defense.passDefense, d.coverage),
      nickelCorner: scale(team.defense.nickelCorner, d.slotCoverage),
      lbCoverage: scale(team.defense.lbCoverage, d.lbCoverage),
    },
    coaching: {
      ...team.coaching,
      redZoneTd: team.coaching.redZoneTd * (1 - d.redZone * 0.5),
    },
  };
}

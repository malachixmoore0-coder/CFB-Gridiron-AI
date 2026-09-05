import type { AdvantageMatrix, Team } from './types';
import { clamp10, mean, rateTo10, round } from './math';

/** Visual 1-10 ratings for each team across the four headline axes, adjusted for who they face. */
export function buildMatrix(home: Team, away: Team): AdvantageMatrix {
  const passing = (t: Team, opp: Team) =>
    clamp10(mean([t.offense.qb, t.offense.passEfficiency, t.offense.explosiveness, t.offense.slotEfficiency]) + (5.5 - opp.defense.passDefense) * 0.45 + (5.5 - opp.defense.nickelCorner) * 0.15);
  const rushing = (t: Team, opp: Team) =>
    clamp10(t.offense.rushEfficiency * 0.7 + t.coaching.redZoneTd * 3 + (5.5 - opp.defense.rushDefense) * 0.5);
  const trench = (t: Team, opp: Team) => {
    const ol = rateTo10(t.offense.pbwr, 0.48, 0.72);
    const dl = rateTo10(t.defense.prwr, 0.32, 0.56);
    const oppOl = rateTo10(opp.offense.pbwr, 0.48, 0.72);
    const oppDl = rateTo10(opp.defense.prwr, 0.32, 0.56);
    return clamp10(ol * 0.5 + dl * 0.5 + (5.5 - oppDl) * 0.2 + (5.5 - oppOl) * 0.2);
  };
  const coaching = (t: Team) =>
    clamp10(mean([
      t.coaching.halftimeAdjust,
      t.defense.secondaryAdjust,
      t.coaching.redZoneAggression,
      rateTo10(t.coaching.thirdDownOff, 0.3, 0.52),
      rateTo10(t.coaching.thirdDownDef, 0.52, 0.72),
      rateTo10(t.coaching.fourthDownGoRate, 0.2, 0.8),
    ]));

  const r = (v: number) => round(v, 1);
  return {
    passing: { home: r(passing(home, away)), away: r(passing(away, home)) },
    rushing: { home: r(rushing(home, away)), away: r(rushing(away, home)) },
    trench: { home: r(trench(home, away)), away: r(trench(away, home)) },
    coaching: { home: r(coaching(home)), away: r(coaching(away)) },
  };
}

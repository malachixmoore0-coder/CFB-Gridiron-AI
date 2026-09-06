import type { RosterPlayer } from '@/data/liveTypes';
import type { Team } from '@/engine/types';

export interface MatchupAngle {
  /** What the player does. */
  label: string;
  /** Who or what he goes against. */
  against: string;
  /** Opponent's rating on that axis, 1-10. */
  oppRating: number;
  /** Positive favours the player. */
  edge: number;
  note: string;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/**
 * How a player's position projects against a specific opponent, using the same
 * unit ratings the engine's nodes compare. Positive edge favours the player.
 */
export function matchupAngles(player: RosterPlayer, own: Team, opp: Team): MatchupAngle[] {
  const o = opp.offense;
  const d = opp.defense;
  const mine = own.offense;
  const angles: MatchupAngle[] = [];
  const add = (label: string, against: string, oppRating: number, mineRating: number, note: string) =>
    angles.push({ label, against, oppRating: r1(oppRating), edge: r1(mineRating - oppRating), note });

  switch (player.pos) {
    case 'QB':
      add('Passing', `${opp.abbr} pass defense`, d.passDefense, mine.qb, 'Quarterback grade against the coverage he will see.');
      add('Protection', `${opp.abbr} pass rush`, (d.prwr - 0.3) * 33, (mine.pbwr - 0.45) * 33, 'Pass-block win rate against their pass-rush win rate.');
      add('Front', `${opp.coaching.defFront} front`, 5.5, mine.vsFront[opp.coaching.defFront], `How this offense has fared against a ${opp.coaching.defFront}.`);
      break;
    case 'RB':
      add('Rushing', `${opp.abbr} run defense`, d.rushDefense, mine.rushEfficiency, 'Rushing efficiency against their run defense.');
      add('Receiving', `${opp.abbr} linebackers`, d.lbCoverage, mine.slotEfficiency, 'Backs out of the backfield against linebacker coverage.');
      break;
    case 'WR':
      add('Outside', `${opp.abbr} pass defense`, d.passDefense, mine.passEfficiency, 'Passing efficiency against their coverage.');
      add('Slot', `${opp.abbr} nickel back`, d.nickelCorner, mine.slotEfficiency, 'Short-area targets against their slot defender.');
      add('Coverage shell', `${opp.coaching.baseCoverage}`, 5.5, mine.vsCoverage[opp.coaching.baseCoverage], `How this offense attacks ${opp.coaching.baseCoverage}.`);
      break;
    case 'TE':
      add('Seams', `${opp.abbr} linebackers`, d.lbCoverage, mine.teSpeed, 'Tight end speed against linebacker coverage.');
      add('Red zone', `${opp.abbr} pass defense`, d.passDefense, mine.passEfficiency, 'Scoring-area targets against their coverage.');
      break;
    case 'OL':
      add('Pass protection', `${opp.abbr} pass rush`, (d.prwr - 0.3) * 33, (mine.pbwr - 0.45) * 33, 'Pass-block win rate against their pass-rush win rate.');
      add('Run blocking', `${opp.abbr} run defense`, d.rushDefense, mine.rushEfficiency, 'Run game against their front.');
      break;
    case 'EDGE': case 'DT':
      add('Pass rush', `${opp.abbr} pass protection`, (o.pbwr - 0.45) * 33, (own.defense.prwr - 0.3) * 33, 'Pass-rush win rate against their protection.');
      add('Run stop', `${opp.abbr} run game`, o.rushEfficiency, own.defense.rushDefense, 'Run defense against their ground attack.');
      break;
    case 'LB':
      add('Coverage', `${opp.abbr} tight ends & backs`, o.teSpeed, own.defense.lbCoverage, 'Linebacker coverage against their receiving backs and tight ends.');
      add('Run fits', `${opp.abbr} run game`, o.rushEfficiency, own.defense.rushDefense, 'Run defense against their ground attack.');
      break;
    case 'CB':
      add('Coverage', `${opp.abbr} passing game`, o.passEfficiency, own.defense.passDefense, 'Coverage against their passing efficiency.');
      add('Explosives', `${opp.abbr} explosiveness`, o.explosiveness, own.defense.passDefense, 'Keeping the top on against a big-play offense.');
      break;
    case 'NCB':
      add('Slot coverage', `${opp.abbr} slot receivers`, o.slotEfficiency, own.defense.nickelCorner, 'Nickel back against their short-area passing game.');
      break;
    case 'S':
      add('Deep coverage', `${opp.abbr} explosiveness`, o.explosiveness, own.defense.passDefense, 'Safety help against their explosive plays.');
      add('Run support', `${opp.abbr} run game`, o.rushEfficiency, own.defense.rushDefense, 'Filling against their ground attack.');
      break;
    default:
      add('Special teams', `${opp.abbr}`, 5.5, 5.5, 'No unit rating tracked for this position.');
  }
  return angles;
}

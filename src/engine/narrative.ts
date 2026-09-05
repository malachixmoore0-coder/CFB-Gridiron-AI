import type { AdvantageMatrix, GameScript, NodeResult, SleeperReport, Team } from './types';
import type { SimDetail } from './simulate';
import type { EnvironmentExtras } from './nodes';
import { round } from './math';

interface NarrativeInput {
  home: Team;
  away: Team;
  sim: SimDetail;
  matrix: AdvantageMatrix;
  nodes: NodeResult[];
  env: EnvironmentExtras;
  sleepers: SleeperReport[];
  modelMargin: number;
}

const pick = <T,>(xs: T[], i: number) => xs[Math.abs(i) % xs.length];

/** Turns the simulation output into the three-act game script the spec asks for. */
export function buildGameScript(n: NarrativeInput): GameScript {
  const { home, away, sim, matrix, env } = n;
  const fav = sim.homeWinPct >= sim.awayWinPct ? home : away;
  const dog = fav === home ? away : home;
  const favSide = fav === home ? 'home' : 'away';
  const dogSide = favSide === 'home' ? 'away' : 'home';
  const favWin = fav === home ? sim.homeWinPct : sim.awayWinPct;
  const coin = Math.round(sim.projectedTotal * 10);

  /* ---------- Early game ---------- */
  const runTilt = (t: Team) => t.offense.rushEfficiency - t.offense.passEfficiency;
  const opener = (t: Team, oppT: Team) => {
    const pa = t.coaching.playActionRate >= 0.28;
    const heavyRun = t.coaching.passRate < 0.45 || runTilt(t) > 0.8;
    if (t.coaching.offScheme === 'Triple Option') return `${t.abbr} opens with the option — ${Math.round((t.coaching.qbRunShare ?? 0.3) * 100)}% of its carries go to the quarterback, and ${oppT.abbr}'s ${oppT.coaching.defFront} front has to stay disciplined on the dive, keep and pitch`;
    if ((t.coaching.qbRunShare ?? 0) >= 0.25 && heavyRun) return `${t.abbr} opens on the ground with the quarterback as a runner (${Math.round((t.coaching.qbRunShare ?? 0) * 100)}% of carries) — ${t.coaching.offScheme.toLowerCase()} looks to test ${oppT.abbr}'s ${oppT.coaching.defFront} front before the pass game gets going`;
    if (heavyRun) return `${t.abbr} opens on the ground — ${t.coaching.offScheme.toLowerCase()} looks to test ${oppT.abbr}'s ${oppT.coaching.defFront} front before the pass game gets going`;
    if (pa) return `${t.abbr} scripts play-action early (${Math.round(t.coaching.playActionRate * 100)}% PA rate) to freeze ${oppT.abbr}'s linebackers and hit intermediate windows behind ${oppT.coaching.baseCoverage}`;
    return `${t.abbr} comes out throwing — a ${Math.round(t.coaching.passRate * 100)}% early-down pass rate attacks ${oppT.abbr}'s ${oppT.coaching.baseCoverage} shell from the first series`;
  };
  const trenchGap = matrix.trench.home - matrix.trench.away;
  const trenchLine =
    Math.abs(trenchGap) >= 1.2
      ? ` The trenches tilt ${trenchGap > 0 ? home.abbr : away.abbr} early (${matrix.trench.home} vs ${matrix.trench.away}), so expect ${trenchGap > 0 ? away.abbr : home.abbr}'s quarterback to feel pressure by the second series.`
      : ' The line play is close to even, so the first quarter is about which quarterback wins on schedule.';
  const halfLead = sim.homeLeadsAtHalfPct;
  const early = `${opener(home, away)}. ${opener(away, home)}.${trenchLine} ${
    halfLead >= 50 ? home.abbr : away.abbr
  } leads at the half in ${Math.round(halfLead >= 50 ? halfLead : 100 - halfLead)}% of simulations.`;

  /* ---------- Halftime ---------- */
  const adjLeader = home.coaching.halftimeAdjust >= away.coaching.halftimeAdjust ? home : away;
  const adjTrailer = adjLeader === home ? away : home;
  const secLeader = home.defense.secondaryAdjust >= away.defense.secondaryAdjust ? home : away;
  const comeback = adjLeader === home ? sim.homeComebackPct : sim.awayComebackPct;
  const covShift = pick(
    [
      `rotates from ${adjTrailer.coaching.baseCoverage} into more two-high looks to cap the explosive plays`,
      `moves the nickel inside on the slot and brings a fifth rusher on obvious passing downs`,
      `spins a safety down to take away the tight end and dares the outside receivers to win one-on-one`,
    ],
    coin,
  );
  const halftime = `${adjLeader.abbr}'s staff grades ${adjLeader.coaching.halftimeAdjust}/10 on in-game adjustments (vs ${adjTrailer.coaching.halftimeAdjust}/10). When trailing at the break, ${adjLeader.abbr} still wins ${comeback}% of the time. Watch ${secLeader.abbr}'s secondary: it ${covShift}. ${
    env.isRivalry ? `Rivalry familiarity keeps things volatile — the margin's standard deviation is ${sim.volatility} points, above a normal game.` : env.isConference ? `Conference play adds a little variance — the margin's standard deviation is ${sim.volatility} points.` : `Volatility runs at ${sim.volatility} points of margin, a standard non-conference profile.`
  }`;

  /* ---------- Late game ---------- */
  const clutchQb = home.offense.qb >= away.offense.qb ? home : away;
  const aggressive = home.coaching.fourthDownGoRate >= away.coaching.fourthDownGoRate ? home : away;
  const late = `${sim.clutchPct}% of simulations are within one score entering the fourth quarter. In those games ${clutchQb.abbr}'s quarterback (${round(clutchQb.offense.qb)}/10) is the clutch tiebreaker, and ${aggressive.abbr} is the side more likely to go for it on 4th-and-short (${Math.round(aggressive.coaching.fourthDownGoRate * 100)}% go rate) rather than settle for three. ${fav.abbr} closes it out ${favWin}% of the time; ${dog.abbr}'s live path is a takeaway (${dog.abbr} takeaway grade ${round(dog.defense.takeaways)}/10) that flips a possession late.`;

  const keys: string[] = [];
  const topNode = [...n.nodes].sort((a, b) => Math.abs(b.points) - Math.abs(a.points))[0];
  if (topNode) {
    keys.push(`${topNode.label} is the biggest lever: ${topNode.points > 0 ? home.abbr : away.abbr} gains ${Math.abs(topNode.points).toFixed(1)} pts of margin there.`);
  }
  const passGap = matrix.passing[favSide] - matrix.passing[dogSide];
  if (Math.abs(passGap) >= 1) keys.push(`${passGap > 0 ? fav.abbr : dog.abbr} owns the passing matchup (${matrix.passing.home} vs ${matrix.passing.away}).`);
  const rushGap = matrix.rushing.home - matrix.rushing.away;
  if (Math.abs(rushGap) >= 1) keys.push(`${rushGap > 0 ? home.abbr : away.abbr} should control the run game (${matrix.rushing.home} vs ${matrix.rushing.away}).`);
  if (n.sleepers[0]) keys.push(`Sleeper to watch: ${n.sleepers[0].player.name} (${n.sleepers[0].team === 'home' ? home.abbr : away.abbr}) — ${n.sleepers[0].spreadImpact.toFixed(1)} pts of spread if he hits.`);
  keys.push(`Most likely final: ${home.abbr} ${sim.mostLikelyScores[0]?.home ?? '-'} – ${away.abbr} ${sim.mostLikelyScores[0]?.away ?? '-'} · ${sim.oneScoreGamePct}% one-score games · ${sim.overtimePct}% overtime.`);

  return { early, halftime, late, homeLeadsAtHalfPct: sim.homeLeadsAtHalfPct, clutchPct: sim.clutchPct, keys };
}

/**
 * The four weighted analytical nodes. Each returns an edge in roughly the
 * -10..+10 range where positive favours the HOME team, plus the factors that
 * produced it so the UI can show its work. Teams passed in are already
 * injury-degraded.
 */
import type { MatchupInput, NodeResult, NodeWeights, SleeperReport, Team, Weather } from './types';
import { POINTS_PER_EDGE_UNIT, POINTS_PER_WIN_PCT, HFA_DEFAULT, HFA_MIN, HFA_MAX } from './weights';
import { clamp, distanceMiles, rateTo10, round, signed, pct } from './math';

type Factor = NodeResult['factors'][number];
const favors = (v: number, tol = 0.15): Factor['favors'] => (v > tol ? 'home' : v < -tol ? 'away' : 'even');

function finish(
  key: keyof NodeWeights,
  label: string,
  weight: number,
  rawEdge: number,
  factors: Factor[],
): NodeResult {
  const edge = clamp(rawEdge, -10, 10);
  return {
    key,
    label,
    weight,
    edge: round(edge, 2),
    points: round(edge * (weight / 100) * POINTS_PER_EDGE_UNIT, 2),
    factors,
  };
}

/* ------------------------------------------------------------------ */
/* 1. SCHEME & TACTICAL BIAS                                            */
/* ------------------------------------------------------------------ */
export function schemeNode(home: Team, away: Team, weight: number): NodeResult {
  const f: Factor[] = [];

  // Offence vs the specific defensive front it will see.
  const frontH = home.offense.vsFront[away.coaching.defFront];
  const frontA = away.offense.vsFront[home.coaching.defFront];
  const frontEdge = (frontH - frontA) * 0.45;
  f.push({
    label: `Offense vs front (${home.abbr} vs ${away.coaching.defFront} / ${away.abbr} vs ${home.coaching.defFront})`,
    value: `${round(frontH)} vs ${round(frontA)}`,
    favors: favors(frontEdge),
  });

  // Offence vs base coverage family.
  const covH = home.offense.vsCoverage[away.coaching.baseCoverage];
  const covA = away.offense.vsCoverage[home.coaching.baseCoverage];
  const covEdge = (covH - covA) * 0.45;
  f.push({
    label: `Offense vs coverage (${away.coaching.baseCoverage} / ${home.coaching.baseCoverage})`,
    value: `${round(covH)} vs ${round(covA)}`,
    favors: favors(covEdge),
  });

  // Play-action leverage: PA rate pays off against poor LB coverage / heavy blitz.
  const paH = home.coaching.playActionRate * (10 - away.defense.lbCoverage + away.defense.blitzRate * 6);
  const paA = away.coaching.playActionRate * (10 - home.defense.lbCoverage + home.defense.blitzRate * 6);
  const paEdge = (paH - paA) * 0.5;
  f.push({
    label: 'Play-action leverage',
    value: `${pct(home.coaching.playActionRate)} PA vs ${pct(away.coaching.playActionRate)} PA`,
    favors: favors(paEdge),
  });

  // Passing vs rushing efficiency against what the opponent actually stops.
  const passH = home.offense.passEfficiency - away.defense.passDefense;
  const passA = away.offense.passEfficiency - home.defense.passDefense;
  const rushH = home.offense.rushEfficiency - away.defense.rushDefense;
  const rushA = away.offense.rushEfficiency - home.defense.rushDefense;
  const effEdge = (passH - passA) * 0.55 + (rushH - rushA) * 0.35;
  f.push({ label: 'Passing efficiency vs pass D', value: `${signed(passH)} / ${signed(passA)}`, favors: favors(passH - passA) });
  f.push({ label: 'Rushing efficiency vs run D', value: `${signed(rushH)} / ${signed(rushA)}`, favors: favors(rushH - rushA) });

  // Coaching tendencies: 3rd down, 4th-down aggression, red zone, adjustments.
  const thirdH = home.coaching.thirdDownOff - (1 - away.coaching.thirdDownDef);
  const thirdA = away.coaching.thirdDownOff - (1 - home.coaching.thirdDownDef);
  const thirdEdge = (thirdH - thirdA) * 22;
  f.push({
    label: '3rd-down success (off vs opp stop rate)',
    value: `${pct(home.coaching.thirdDownOff)} / ${pct(away.coaching.thirdDownOff)}`,
    favors: favors(thirdEdge),
  });

  const aggrH = home.coaching.fourthDownGoRate * 4 + home.coaching.redZoneAggression * 0.3 + home.coaching.redZoneTd * 5;
  const aggrA = away.coaching.fourthDownGoRate * 4 + away.coaching.redZoneAggression * 0.3 + away.coaching.redZoneTd * 5;
  const aggrEdge = (aggrH - aggrA) * 0.6;
  f.push({
    label: '4th-down / red-zone aggressiveness',
    value: `${pct(home.coaching.fourthDownGoRate)} go, ${pct(home.coaching.redZoneTd)} RZ TD vs ${pct(away.coaching.fourthDownGoRate)} go, ${pct(away.coaching.redZoneTd)} RZ TD`,
    favors: favors(aggrEdge),
  });

  const adjEdge = ((home.coaching.halftimeAdjust + home.defense.secondaryAdjust) - (away.coaching.halftimeAdjust + away.defense.secondaryAdjust)) * 0.3;
  f.push({
    label: 'Halftime & secondary adjustments',
    value: `${round(home.coaching.halftimeAdjust)}/${round(home.defense.secondaryAdjust)} vs ${round(away.coaching.halftimeAdjust)}/${round(away.defense.secondaryAdjust)}`,
    favors: favors(adjEdge),
  });

  const raw = frontEdge + covEdge + paEdge + effEdge + thirdEdge + aggrEdge + adjEdge;
  return finish('scheme', 'Scheme & Tactical Bias', weight, raw * 0.55, f);
}

/* ------------------------------------------------------------------ */
/* 2. PERSONNEL & MATCHUP EDGE                                          */
/* ------------------------------------------------------------------ */
export function personnelNode(home: Team, away: Team, weight: number, injuryPointsHome: number, injuryPointsAway: number): NodeResult {
  const f: Factor[] = [];

  // Quarterback play is the single largest personnel lever.
  const qbEdge = (home.offense.qb - away.offense.qb) * 0.9;
  f.push({ label: 'Quarterback', value: `${round(home.offense.qb)} vs ${round(away.offense.qb)}`, favors: favors(qbEdge) });

  // Roster talent gap. College rosters are far less even than NFL ones, so the
  // program-strength rating (Elo-derived) carries an explicit weight here.
  const talentH = home.talent ?? 5.5;
  const talentA = away.talent ?? 5.5;
  const talentEdge = (talentH - talentA) * 0.7;
  f.push({ label: 'Roster talent / program strength', value: `${round(talentH)} vs ${round(talentA)}${home.elo && away.elo ? ` · Elo ${Math.round(home.elo)} vs ${Math.round(away.elo)}` : ''}`, favors: favors(talentEdge) });

  // Trench battles: PBWR vs the opponent's PRWR, both directions.
  const protH = home.offense.pbwr - away.defense.prwr; // home O-line vs away rush
  const protA = away.offense.pbwr - home.defense.prwr; // away O-line vs home rush
  const trenchEdge = (protH - protA) * 22;
  f.push({
    label: 'Pass-block win rate vs pass-rush win rate',
    value: `${pct(home.offense.pbwr)} PBWR vs ${pct(away.defense.prwr)} PRWR | ${pct(away.offense.pbwr)} PBWR vs ${pct(home.defense.prwr)} PRWR`,
    favors: favors(trenchEdge),
  });

  // Coverage angles: slot vs nickel, TE speed vs linebackers.
  const slotH = home.offense.slotEfficiency - away.defense.nickelCorner;
  const slotA = away.offense.slotEfficiency - home.defense.nickelCorner;
  const slotEdge = (slotH - slotA) * 0.35;
  f.push({ label: 'Slot receiver vs nickel corner', value: `${signed(slotH)} / ${signed(slotA)}`, favors: favors(slotEdge) });

  const teH = home.offense.teSpeed - away.defense.lbCoverage;
  const teA = away.offense.teSpeed - home.defense.lbCoverage;
  const teEdge = (teH - teA) * 0.3;
  f.push({ label: 'TE speed vs linebackers', value: `${signed(teH)} / ${signed(teA)}`, favors: favors(teEdge) });

  // Explosiveness & takeaway generation.
  const explEdge = ((home.offense.explosiveness - away.defense.takeaways) - (away.offense.explosiveness - home.defense.takeaways)) * 0.25;
  f.push({ label: 'Explosive plays vs takeaways', value: `${round(home.offense.explosiveness)}/${round(home.defense.takeaways)} vs ${round(away.offense.explosiveness)}/${round(away.defense.takeaways)}`, favors: favors(explEdge) });

  // Injury degradation shows its work here. The unit ratings above are already
  // degraded (roughly 40% of the effect); the explicit win-efficiency metric
  // supplies the rest so a backup QB really does cost ~18% win efficiency.
  const injPoints = (injuryPointsAway - injuryPointsHome) * 0.6;
  const injEdge = injPoints / (POINTS_PER_EDGE_UNIT * (weight / 100 || 0.35));
  if (injuryPointsHome > 0 || injuryPointsAway > 0) {
    f.push({
      label: 'Injury degradation (margin swing)',
      value: `${home.abbr} -${round(injuryPointsHome)} pts | ${away.abbr} -${round(injuryPointsAway)} pts`,
      favors: favors(injEdge),
    });
  }

  const raw = (qbEdge + talentEdge + trenchEdge + slotEdge + teEdge + explEdge) * 0.6 + injEdge;
  return finish('personnel', 'Personnel & Matchup Edge', weight, raw, f);
}

/* ------------------------------------------------------------------ */
/* 3. ENVIRONMENTAL & RIVALRY MODIFIERS                                 */
/* ------------------------------------------------------------------ */
export interface EnvironmentExtras {
  /** Multiplier on score variance (1 = normal). */
  varianceMultiplier: number;
  /** Points to add to the projected total (weather, dome, pace). */
  totalAdjust: number;
  isConference: boolean;
  isRivalry: boolean;
  hfaWinPct: number;
  travelMiles: number;
}

export function environmentNode(
  home: Team,
  away: Team,
  input: MatchupInput,
  weight: number,
  hfaBase = HFA_DEFAULT,
): { node: NodeResult; extras: EnvironmentExtras } {
  const f: Factor[] = [];
  const weather: Weather = input.weather ?? (home.stadium.dome ? 'dome' : 'clear');
  const travelMiles = distanceMiles(home.stadium.lat, home.stadium.lng, away.stadium.lat, away.stadium.lng);

  // Home-field advantage: base 4-8 win-probability points depending on
  // stadium noise (a 100,000-seat SEC stadium is a different animal from a
  // 25,000-seat MAC venue), how far the visitor travelled, altitude and a
  // night kick.
  let hfa = 0;
  if (!input.neutralSite) {
    const base = clamp(hfaBase, HFA_MIN, HFA_MAX);
    const noiseBoost = (home.stadium.noise - 5.5) * 0.4; // ±1.8
    const travelBoost = clamp((travelMiles - 600) / 1600, 0, 1) * 1.0; // up to +1.0 for a cross-country trip
    const altitudeBoost = home.stadium.altitudeFt > 4000 ? 0.8 : 0;
    const primetimeBoost = input.primetime ? 0.5 : 0;
    hfa = clamp(base + noiseBoost + travelBoost + altitudeBoost + primetimeBoost, HFA_MIN - 1, HFA_MAX + 1.5);
  }
  const hfaPoints = hfa * POINTS_PER_WIN_PCT;
  const hfaEdge = hfaPoints / (POINTS_PER_EDGE_UNIT * (weight / 100 || 0.15));
  f.push({
    label: input.neutralSite ? 'Neutral site — no home-field edge' : `Home-field advantage (${home.stadium.name})`,
    value: input.neutralSite ? '0.0%' : `+${round(hfa)}% · noise ${home.stadium.noise}/10${home.stadium.capacity ? ` · ${Math.round(home.stadium.capacity / 1000)}k seats` : ''} · ${Math.round(travelMiles)} mi trip`,
    favors: hfa > 0 ? 'home' : 'even',
  });

  // Weather: penalises the more pass-dependent / less physical team and cuts scoring.
  let weatherEdge = 0;
  let totalAdjust = 0;
  const passDependence = (t: Team) => t.coaching.passRate * 10 + (t.offense.passEfficiency - t.offense.rushEfficiency) * 0.5;
  const weatherSwing = passDependence(away) - passDependence(home); // positive favours home
  switch (weather) {
    case 'dome': totalAdjust = 1.5; break;
    case 'clear': break;
    case 'wind': weatherEdge = weatherSwing * 0.18; totalAdjust = -4.0; break;
    case 'rain': weatherEdge = weatherSwing * 0.12; totalAdjust = -3.0; break;
    case 'snow': weatherEdge = weatherSwing * 0.22; totalAdjust = -5.5; break;
    case 'cold': weatherEdge = weatherSwing * 0.10 + (home.stadium.dome ? 0 : 0.2); totalAdjust = -2.0; break;
    case 'heat': weatherEdge = 0.2; totalAdjust = 0.5; break;
  }
  if (weather !== 'clear' && weather !== 'dome') {
    f.push({
      label: `Weather: ${weather}`,
      value: `${signed(totalAdjust)} pts to total · ${pct(home.coaching.passRate)} vs ${pct(away.coaching.passRate)} pass rate`,
      favors: favors(weatherEdge),
    });
  } else {
    f.push({ label: weather === 'dome' ? 'Indoors' : 'Clear conditions', value: `${signed(totalAdjust)} pts to total`, favors: 'even' });
  }

  // Conference / rivalry: raises variance; a trophy game also compresses the favourite's edge.
  const isConference = home.conference === away.conference && home.conference !== 'FBS Independents';
  const isRivalry = !!home.rivals?.includes(away.id) || !!away.rivals?.includes(home.id);
  const varianceMultiplier = isRivalry ? 1.12 : isConference ? 1.06 : 1.0;
  f.push({
    label: isRivalry ? (isConference ? 'Rivalry game (conference)' : 'Rivalry game') : isConference ? 'Conference game' : 'Non-conference matchup',
    value: isRivalry ? `variance ×${varianceMultiplier.toFixed(2)} · rivalry familiarity compresses spread` : isConference ? `variance ×${varianceMultiplier.toFixed(2)}` : 'standard variance',
    favors: 'even',
  });

  const raw = hfaEdge + weatherEdge;
  return {
    node: finish('environment', 'Environmental & Rivalry Modifiers', weight, raw, f),
    extras: { varianceMultiplier, totalAdjust, isConference, isRivalry, hfaWinPct: hfa, travelMiles },
  };
}

/* ------------------------------------------------------------------ */
/* 4. SLEEPER & X-FACTOR MODELING                                       */
/* ------------------------------------------------------------------ */
function sleeperCandidates(team: Team, opp: Team, side: 'home' | 'away', input: MatchupInput): SleeperReport[] {
  const out: SleeperReport[] = [];
  const isOut = (id: string) => input.injuredOut?.includes(id);
  const oppLtOut = opp.players.some((p) => p.pos === 'LT' && isOut(p.id));
  const oppWr1Out = opp.players.some((p) => p.pos === 'WR' && p.role === 'starter' && (p.targetShare ?? 0) >= 0.22 && isOut(p.id));
  const teamWr1Out = team.players.some((p) => p.pos === 'WR' && p.role === 'starter' && (p.targetShare ?? 0) >= 0.22 && isOut(p.id));

  for (const p of team.players) {
    if (isOut(p.id)) continue;
    const q = (p.rating - 60) / 40; // 0..1 quality
    if ((p.pos === 'WR' || p.pos === 'TE' || p.pos === 'RB') && p.tprr !== undefined && p.targetShare !== undefined) {
      const isPrimary = p.role === 'starter' && p.targetShare >= 0.22;
      // Slot / secondary weapons vs a soft nickel; TEs vs slow LBs; role bump if WR1 is out.
      const mismatch =
        p.pos === 'TE'
          ? team.offense.teSpeed - opp.defense.lbCoverage
          : p.pos === 'RB'
            ? team.offense.rushEfficiency - opp.defense.rushDefense + (10 - opp.defense.lbCoverage) * 0.3
            : team.offense.slotEfficiency - opp.defense.nickelCorner;
      const usageBoost = teamWr1Out && !isPrimary ? 0.08 : 0;
      const score = p.tprr * 10 + mismatch * 0.5 + (p.targetShare + usageBoost) * 6 + q * 2 - (isPrimary ? 2.2 : 0);
      if (score > 3.2) {
        const spreadImpact = clamp(0.4 + score * 0.28, 0.5, 3.2);
        const hitRate = clamp(0.22 + p.tprr * 0.9 + mismatch * 0.03 + usageBoost, 0.2, 0.62);
        const headline =
          p.pos === 'TE'
            ? `${p.name} vs. ${opp.abbr} linebackers`
            : p.pos === 'RB'
              ? `${p.name} on the ground vs. ${opp.abbr}`
              : `${p.name} working the slot vs. ${opp.abbr} nickel`;
        const reason = [
          `${pct(p.tprr)} TPRR on ${pct(p.targetShare + usageBoost)} projected target share`,
          mismatch > 0.5 ? `+${round(mismatch)} mismatch grade on the angle he attacks` : `neutral matchup, volume driven`,
          usageBoost ? `target share bumps with the WR1 out` : '',
          p.note ?? '',
        ].filter(Boolean).join(' · ');
        out.push({ player: p, team: side, headline, reason, spreadImpact: round(spreadImpact), hitRate: round(hitRate, 2) });
      }
    }
    if ((p.pos === 'EDGE' || p.pos === 'DT') && p.prwr !== undefined) {
      const rotational = p.role !== 'starter';
      const protWeak = (0.62 - opp.offense.pbwr) * 10 + (oppLtOut ? 2.5 : 0);
      const score = p.prwr * 18 + p.snapPct * 3 + protWeak + q * 2 - (rotational ? 0 : 2.5);
      if (score > 5.4 && (rotational || oppLtOut)) {
        const spreadImpact = clamp(0.3 + score * 0.22, 0.5, 3.0);
        const hitRate = clamp(0.2 + p.prwr * 1.1 + (oppLtOut ? 0.12 : 0), 0.2, 0.6);
        out.push({
          player: p,
          team: side,
          headline: oppLtOut ? `${p.name} vs. a backup left tackle` : `${p.name} as a rotational rusher`,
          reason: [
            `${pct(p.prwr)} PRWR on ${pct(p.snapPct)} of snaps`,
            oppLtOut ? `${opp.abbr} LT is out — protection drops ~12%` : `${opp.abbr} protects at ${pct(opp.offense.pbwr)} PBWR`,
            p.note ?? '',
          ].filter(Boolean).join(' · '),
          spreadImpact: round(spreadImpact),
          hitRate: round(hitRate, 2),
        });
      }
    }
    if ((p.pos === 'CB' || p.pos === 'NCB' || p.pos === 'S' || p.pos === 'LB') && oppWr1Out && p.rating >= 78) {
      out.push({
        player: p,
        team: side,
        headline: `${p.name} erases a thinned ${opp.abbr} receiving corps`,
        reason: `${opp.abbr} WR1 is out; a ${p.rating}-grade coverage piece can sit on the remaining targets`,
        spreadImpact: 1.1,
        hitRate: 0.4,
      });
    }
  }
  return out.sort((a, b) => b.spreadImpact * b.hitRate - a.spreadImpact * a.hitRate);
}

export function xfactorNode(home: Team, away: Team, input: MatchupInput, weight: number): { node: NodeResult; sleepers: SleeperReport[] } {
  const homeS = sleeperCandidates(home, away, 'home', input);
  const awayS = sleeperCandidates(away, home, 'away', input);
  const ev = (xs: SleeperReport[]) => xs.slice(0, 3).reduce((s, x) => s + x.spreadImpact * x.hitRate, 0);
  const evH = ev(homeS);
  const evA = ev(awayS);

  const f: Factor[] = [];
  f.push({ label: 'Sleeper expected swing (top 3 each)', value: `${signed(evH)} vs ${signed(evA)} pts`, favors: favors(evH - evA) });

  // Depth of the target tree: concentrated trees get erased by elite corners.
  const concentration = (t: Team) => Math.max(...t.players.filter((p) => p.targetShare).map((p) => p.targetShare ?? 0), 0);
  const cH = concentration(home);
  const cA = concentration(away);
  const concEdge = ((cA - cH) * 10) * 0.6 + ((away.defense.passDefense - home.defense.passDefense) * 0.05);
  f.push({ label: 'Target-tree concentration (WR1 share)', value: `${pct(cH)} vs ${pct(cA)}`, favors: favors(-concEdge * -1) });

  // Rotational rush depth: fresh legs matter in the 4th quarter.
  const rushDepth = (t: Team) => t.players.filter((p) => (p.pos === 'EDGE' || p.pos === 'DT') && p.role === 'rotational').reduce((s, p) => s + (p.prwr ?? 0) * p.snapPct, 0);
  const depthEdge = (rushDepth(home) - rushDepth(away)) * 12;
  f.push({ label: 'Rotational pass-rush depth', value: `${round(rushDepth(home) * 100)} vs ${round(rushDepth(away) * 100)} weighted PRWR`, favors: favors(depthEdge) });

  const raw = (evH - evA) * 1.6 + concEdge + depthEdge;
  const sleepers = [...homeS, ...awayS]
    .sort((a, b) => b.spreadImpact * b.hitRate - a.spreadImpact * a.hitRate)
    .slice(0, 3);

  return { node: finish('xfactor', 'Sleeper & X-Factor Modeling', weight, raw, f), sleepers };
}

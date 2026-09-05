import { useMemo } from 'react';
import { analyzeMatchup, matchupKey } from '@/engine';
import type { InjuryStatus, MatchupAnalysis, MatchupInput, Team } from '@/engine/types';
import { hashString } from '@/engine/rng';
import { useSettings, MatchupContext, effectiveStatus } from '@/context/SettingsContext';
import { useTeams } from '@/context/TeamsContext';

export interface RunRequest {
  awayId: string;
  homeId: string;
  ctx: MatchupContext;
}

export const DEFAULT_CTX: MatchupContext = { neutralSite: false, primetime: false, weather: 'auto' };

/** Build the engine input for a request: reported injuries + the user's manual overrides. */
export function buildInput(req: RunRequest, home: Team, away: Team, overrides: Record<string, InjuryStatus>): MatchupInput {
  const players = [...home.players, ...away.players];
  return {
    home,
    away,
    neutralSite: req.ctx.neutralSite,
    primetime: req.ctx.primetime,
    weather: req.ctx.weather === 'auto' ? undefined : req.ctx.weather,
    injuredOut: players.filter((p) => effectiveStatus(p, overrides) === 'out').map((p) => p.id),
    questionable: players.filter((p) => effectiveStatus(p, overrides) === 'questionable').map((p) => p.id),
  };
}

/** Runs the full engine for a matchup, memoised on everything that can change the answer. */
export function useAnalysis(req: RunRequest, reroll = 0, simulations?: number): MatchupAnalysis {
  const s = useSettings();
  const { getTeam, generatedAt } = useTeams();
  const ov = JSON.stringify(s.overrides);
  const w = `${s.weights.scheme}|${s.weights.personnel}|${s.weights.environment}|${s.weights.xfactor}`;
  const runs = simulations ?? s.simulations;
  return useMemo(() => {
    const input = buildInput(req, getTeam(req.homeId), getTeam(req.awayId), s.overrides);
    const seed = hashString(`${matchupKey(input)}#${reroll}`);
    return analyzeMatchup(input, { weights: s.weights, simulations: runs, homeFieldBase: s.homeFieldBase, seed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req.awayId, req.homeId, req.ctx.neutralSite, req.ctx.primetime, req.ctx.weather, ov, w, runs, s.homeFieldBase, reroll, generatedAt]);
}

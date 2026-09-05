import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { InjuryStatus, NodeWeights, Player, Weather } from '@/engine/types';
import { DEFAULT_WEIGHTS, HFA_DEFAULT, HFA_MAX, HFA_MIN } from '@/engine/weights';

const KEY = 'cfb-gridiron-ai.settings.v1';

export type SimCount = 2000 | 5000 | 10000 | 25000;

export interface RecentMatchup { awayId: string; homeId: string; ts: number; }

export interface MatchupContext {
  neutralSite: boolean;
  primetime: boolean;
  weather: Weather | 'auto';
}

interface Persisted {
  weights: NodeWeights;
  simulations: SimCount;
  homeFieldBase: number;
  /** Manual injury overrides by player id. Absent = follow the reported status. */
  overrides: Record<string, InjuryStatus>;
  recent: RecentMatchup[];
  onboarded: boolean;
}

const DEFAULTS: Persisted = {
  weights: { ...DEFAULT_WEIGHTS },
  simulations: 10000,
  homeFieldBase: HFA_DEFAULT,
  overrides: {},
  recent: [],
  onboarded: false,
};

interface SettingsState extends Persisted {
  loaded: boolean;
  setWeight: (key: keyof NodeWeights, value: number) => void;
  resetWeights: () => void;
  setSimulations: (n: SimCount) => void;
  setHomeFieldBase: (v: number) => void;
  /** Effective status: manual override if set, otherwise the reported status, otherwise healthy. */
  statusOf: (player: Player) => InjuryStatus;
  hasOverride: (playerId: string) => boolean;
  setOverride: (playerId: string, status: InjuryStatus | null) => void;
  /** Cycle Active → Questionable → Out → back to reported. */
  cycleStatus: (player: Player) => void;
  clearOverrides: () => void;
  pushRecent: (m: Omit<RecentMatchup, 'ts'>) => void;
  setOnboarded: (v: boolean) => void;
}

const Ctx = createContext<SettingsState | null>(null);

export const effectiveStatus = (player: Player, overrides: Record<string, InjuryStatus>): InjuryStatus =>
  overrides[player.id] ?? player.reported ?? 'healthy';

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Persisted>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<Persisted>;
          setState({ ...DEFAULTS, ...parsed, weights: { ...DEFAULT_WEIGHTS, ...(parsed.weights ?? {}) }, overrides: parsed.overrides ?? {} });
        }
      } catch {
        // defaults
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  }, [state, loaded]);

  const patch = useCallback((p: Partial<Persisted> | ((s: Persisted) => Partial<Persisted>)) => {
    setState((s) => ({ ...s, ...(typeof p === 'function' ? p(s) : p) }));
  }, []);

  const setOverride = useCallback((id: string, status: InjuryStatus | null) => {
    patch((s) => {
      const overrides = { ...s.overrides };
      if (status === null) delete overrides[id]; else overrides[id] = status;
      return { overrides };
    });
  }, [patch]);

  const value = useMemo<SettingsState>(() => ({
    ...state,
    homeFieldBase: Math.max(HFA_MIN, Math.min(HFA_MAX, state.homeFieldBase)),
    loaded,
    setWeight: (key, v) => patch((s) => ({ weights: { ...s.weights, [key]: Math.max(0, Math.min(100, v)) } })),
    resetWeights: () => patch({ weights: { ...DEFAULT_WEIGHTS } }),
    setSimulations: (n) => patch({ simulations: n }),
    setHomeFieldBase: (v) => patch({ homeFieldBase: Math.max(HFA_MIN, Math.min(HFA_MAX, Math.round(v * 10) / 10)) }),
    statusOf: (p) => effectiveStatus(p, state.overrides),
    hasOverride: (id) => id in state.overrides,
    setOverride,
    cycleStatus: (p) => {
      const order: InjuryStatus[] = ['healthy', 'questionable', 'out'];
      const cur = effectiveStatus(p, state.overrides);
      const next = order[(order.indexOf(cur) + 1) % order.length];
      // Landing on the reported status means "follow the report" — drop the override.
      setOverride(p.id, next === (p.reported ?? 'healthy') ? null : next);
    },
    clearOverrides: () => patch({ overrides: {} }),
    pushRecent: (m) => patch((s) => ({
      recent: [{ ...m, ts: Date.now() }, ...s.recent.filter((r) => !(r.awayId === m.awayId && r.homeId === m.homeId))].slice(0, 8),
    })),
    setOnboarded: (v) => patch({ onboarded: v }),
  }), [state, loaded, patch, setOverride]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSettings must be used inside SettingsProvider');
  return v;
}

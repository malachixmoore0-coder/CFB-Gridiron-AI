/**
 * The retention layer: the reasons to open the app on a Tuesday.
 *
 * Three loops, in the order they start working on a new user:
 *   1. Streak — a visit counter that only moves if you show up. Cheap, honest,
 *      and it survives a bad week because it rewards attendance, not results.
 *   2. Card — the picks you saved, graded automatically off the same final
 *      scores the model is graded on. This is the loop that makes the app
 *      personal: it stops being "the model's record" and becomes yours.
 *   3. Follows — the teams you care about, which decide what the home feed
 *      leads with. A user with follows set has a reason to open on a Tuesday.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'cfb-gridiron-ai.engagement.v1';

export type Market = 'ml' | 'spread' | 'total';
export type PickSide = 'home' | 'away' | 'over' | 'under';
export type PickStatus = 'open' | 'won' | 'lost' | 'push';

export interface SavedPick {
  id: string;
  gameId: string;
  awayId: string;
  homeId: string;
  market: Market;
  side: PickSide;
  /** Spread or total the pick was taken at. Null for a moneyline. */
  number: number | null;
  /** The model's probability at the moment it was saved. */
  modelPct: number;
  /** Model minus market, in points, at the moment it was saved. */
  edge: number;
  label: string;
  addedAt: number;
  status: PickStatus;
  settledAt?: number;
}

export interface Badge { id: string; name: string; blurb: string; icon: string; earned: boolean; progress: number; goal: number; }

interface Persisted {
  streak: number;
  best: number;
  lastOpen: string | null;
  opens: number;
  follows: string[];
  picks: SavedPick[];
  /** Nudges already dismissed, so nothing asks twice. */
  dismissed: string[];
}

const today = () => new Date().toISOString().slice(0, 10);
const yesterday = () => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const DEFAULTS: Persisted = { streak: 0, best: 0, lastOpen: null, opens: 0, follows: [], picks: [], dismissed: [] };

export interface CardSummary { open: number; graded: number; won: number; lost: number; push: number; hitRate: number | null; units: number; }

interface State {
  loaded: boolean;
  streak: number;
  best: number;
  opens: number;
  follows: string[];
  picks: SavedPick[];
  summary: CardSummary;
  badges: Badge[];
  isFollowing: (teamId: string) => boolean;
  toggleFollow: (teamId: string, max: number) => 'added' | 'removed' | 'limit';
  savePick: (p: Omit<SavedPick, 'id' | 'addedAt' | 'status'>) => void;
  hasPick: (gameId: string, market: Market, side: PickSide) => boolean;
  removePick: (id: string) => void;
  clearSettled: () => void;
  /** Grade every open pick against finals from the schedule feed. */
  settle: (finals: Map<string, { awayScore: number; homeScore: number }>) => void;
  dismiss: (k: string) => void;
  dismissed: (k: string) => boolean;
}

const Ctx = createContext<State | null>(null);

/** Straight-up / spread / total grading, all from the final score. */
export function gradePick(p: SavedPick, away: number, home: number): PickStatus {
  if (p.market === 'total') {
    const total = away + home;
    if (p.number == null || total === p.number) return 'push';
    return (total > p.number) === (p.side === 'over') ? 'won' : 'lost';
  }
  const margin = home - away; // positive = home won by that much
  if (p.market === 'ml') {
    if (margin === 0) return 'push';
    return (margin > 0) === (p.side === 'home') ? 'won' : 'lost';
  }
  // Spread is stored from the home side, the way a book prints it.
  const line = p.number ?? 0;
  const adjusted = margin + line;
  if (adjusted === 0) return 'push';
  return (adjusted > 0) === (p.side === 'home') ? 'won' : 'lost';
}

/** Flat 1-unit staking at -110, which is how a bettor reads a record. */
const unitsOf = (picks: SavedPick[]) =>
  picks.reduce((u, p) => (p.status === 'won' ? u + 0.909 : p.status === 'lost' ? u - 1 : u), 0);

export function EngagementProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<Persisted>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  const save = useCallback((next: Persisted) => { setS(next); AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {}); }, []);

  useEffect(() => {
    (async () => {
      let next = DEFAULTS;
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) next = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Persisted>) };
      } catch { /* first run */ }
      // Attendance is counted once a day: continue the run, or start a new one.
      if (next.lastOpen !== today()) {
        const streak = next.lastOpen === yesterday() ? next.streak + 1 : 1;
        next = { ...next, streak, best: Math.max(next.best, streak), lastOpen: today(), opens: next.opens + 1 };
        AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      }
      setS(next);
      setLoaded(true);
    })();
  }, []);

  const summary: CardSummary = useMemo(() => {
    const graded = s.picks.filter((p) => p.status !== 'open');
    const won = graded.filter((p) => p.status === 'won').length;
    const lost = graded.filter((p) => p.status === 'lost').length;
    const push = graded.filter((p) => p.status === 'push').length;
    return {
      open: s.picks.length - graded.length,
      graded: graded.length,
      won, lost, push,
      hitRate: won + lost ? (won / (won + lost)) * 100 : null,
      units: unitsOf(graded),
    };
  }, [s.picks]);

  const badges: Badge[] = useMemo(() => {
    const b = (id: string, name: string, blurb: string, icon: string, progress: number, goal: number): Badge =>
      ({ id, name, blurb, icon, progress: Math.min(progress, goal), goal, earned: progress >= goal });
    return [
      b('rookie', 'Rookie', 'Save your first pick', 'bookmark', s.picks.length, 1),
      b('regular', 'Regular', 'Open the app 7 days running', 'flame', s.streak, 7),
      b('grinder', 'Grinder', '30-day streak', 'bonfire', s.streak, 30),
      b('handicapper', 'Handicapper', 'Grade 25 picks', 'clipboard', summary.graded, 25),
      b('sharp', 'Sharp', '55%+ on 20 graded picks', 'trending-up', summary.graded >= 20 && (summary.hitRate ?? 0) >= 55 ? 1 : 0, 1),
      b('scout', 'Scout', 'Follow 5 teams', 'eye', s.follows.length, 5),
    ];
  }, [s.picks.length, s.streak, s.follows.length, summary.graded, summary.hitRate]);

  const value: State = useMemo(() => ({
    loaded,
    streak: s.streak,
    best: s.best,
    opens: s.opens,
    follows: s.follows,
    picks: s.picks,
    summary,
    badges,
    isFollowing: (id) => s.follows.includes(id),
    toggleFollow: (id, max) => {
      if (s.follows.includes(id)) { save({ ...s, follows: s.follows.filter((f) => f !== id) }); return 'removed'; }
      if (s.follows.length >= max) return 'limit';
      save({ ...s, follows: [...s.follows, id] });
      return 'added';
    },
    savePick: (p) => {
      const id = `${p.gameId}:${p.market}:${p.side}`;
      if (s.picks.some((x) => x.id === id)) return;
      const fresh: SavedPick = { ...p, id, addedAt: Date.now(), status: 'open' };
      save({ ...s, picks: [fresh, ...s.picks].slice(0, 400) });
    },
    hasPick: (gameId, market, side) => s.picks.some((p) => p.id === `${gameId}:${market}:${side}`),
    removePick: (id) => save({ ...s, picks: s.picks.filter((p) => p.id !== id) }),
    clearSettled: () => save({ ...s, picks: s.picks.filter((p) => p.status === 'open') }),
    settle: (finals) => {
      let changed = false;
      const picks = s.picks.map((p) => {
        if (p.status !== 'open') return p;
        const f = finals.get(p.gameId);
        if (!f) return p;
        changed = true;
        return { ...p, status: gradePick(p, f.awayScore, f.homeScore), settledAt: Date.now() };
      });
      if (changed) save({ ...s, picks });
    },
    dismiss: (k) => save({ ...s, dismissed: [...new Set([...s.dismissed, k])] }),
    dismissed: (k) => s.dismissed.includes(k),
  }), [loaded, s, summary, badges, save]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEngagement(): State {
  const v = useContext(Ctx);
  if (!v) throw new Error('useEngagement outside EngagementProvider');
  return v;
}

/**
 * Live data provider. Order of precedence:
 *   1. Fresh JSON fetched from the published dataset (refreshed by GitHub Actions),
 *   2. the last fetched copy cached on-device,
 *   3. the dataset bundled at build time (data/live/*.json),
 *   4. the curated sample in src/data/teams.ts (only if the bundle is missing).
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Conference, Team } from '@/engine/types';
import { TEAMS as SAMPLE_TEAMS, groupByConference, type ConferenceGroup } from '@/data/teams';
import { FBS_SEASON } from '@/data/fbs';
import type { LiveGame, LiveMetaFile, LiveScheduleFile, LiveTeamsFile, Phase } from '@/data/liveTypes';
import bundledTeams from '../../data/live/teams.json';
import bundledSchedule from '../../data/live/schedule.json';
import bundledMeta from '../../data/live/meta.json';

export const DATA_URL: string =
  (process.env.EXPO_PUBLIC_DATA_URL as string | undefined)?.replace(/\/$/, '') ??
  'https://raw.githubusercontent.com/malachixmoore0-coder/CFB-Gridiron-AI/main/data/live';

const CACHE_KEY = 'cfb-gridiron-ai.live-data.v1';
/** A dataset must cover (nearly) all of FBS to be trusted. */
const MIN_TEAMS = 100;
const FETCH_TIMEOUT_MS = 15_000;

export type DataSource = 'remote' | 'cache' | 'bundled' | 'sample';
export type { Conference };

interface Dataset { teams: Team[]; games: LiveGame[]; meta: LiveMetaFile | null; generatedAt: string; season: number; week: number; phase: Phase; }

interface TeamsState extends Dataset {
  source: DataSource;
  refreshing: boolean;
  lastError: string | null;
  lastChecked: number | null;
  getTeam: (id: string) => Team;
  hasTeam: (id: string) => boolean;
  conferences: ConferenceGroup[];
  /** Teams sorted by poll rank, then Elo. */
  ranked: Team[];
  poll: string | null;
  /** Upcoming (or most recent) scheduled games for the current week. */
  weekGames: LiveGame[];
  /** Find the scheduled game for a matchup, if it is on the slate. */
  findGame: (awayId: string, homeId: string) => LiveGame | undefined;
  refresh: () => Promise<void>;
}

const Ctx = createContext<TeamsState | null>(null);

function bundled(): { data: Dataset; source: DataSource } {
  const t = bundledTeams as unknown as LiveTeamsFile;
  const s = bundledSchedule as unknown as LiveScheduleFile;
  const m = bundledMeta as unknown as LiveMetaFile;
  if (Array.isArray(t?.teams) && t.teams.length >= MIN_TEAMS) {
    return { data: { teams: t.teams, games: s?.games ?? [], meta: m ?? null, generatedAt: t.generatedAt, season: t.season, week: t.week, phase: t.phase }, source: 'bundled' };
  }
  return { data: { teams: SAMPLE_TEAMS, games: [], meta: null, generatedAt: '', season: FBS_SEASON, week: 1, phase: 'preseason' }, source: 'sample' };
}

async function fetchJson<T>(url: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${url}?t=${Math.floor(Date.now() / 60_000)}`, { signal: ctrl.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function validDataset(d: Partial<Dataset> | null | undefined): d is Dataset {
  return !!d && Array.isArray(d.teams) && d.teams.length >= MIN_TEAMS && typeof d.generatedAt === 'string' && d.teams.every((t) => t && t.id && t.school && t.players && t.offense && t.defense && t.coaching);
}

export function TeamsProvider({ children }: { children: React.ReactNode }) {
  const initial = useMemo(bundled, []);
  const [data, setData] = useState<Dataset>(initial.data);
  const [source, setSource] = useState<DataSource>(initial.source);
  const [refreshing, setRefreshing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [t, s, m] = await Promise.all([
        fetchJson<LiveTeamsFile>(`${DATA_URL}/teams.json`),
        fetchJson<LiveScheduleFile>(`${DATA_URL}/schedule.json`),
        fetchJson<LiveMetaFile>(`${DATA_URL}/meta.json`).catch(() => null),
      ]);
      const next: Dataset = { teams: t.teams, games: s.games ?? [], meta: m, generatedAt: t.generatedAt, season: t.season, week: t.week, phase: t.phase };
      if (!validDataset(next)) throw new Error('Unexpected dataset shape');
      if (!mounted.current) return;
      setData((cur) => (next.generatedAt >= cur.generatedAt ? next : cur));
      setSource('remote');
      setLastError(null);
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next)).catch(() => {});
    } catch (e) {
      if (mounted.current) setLastError(e instanceof Error ? e.message : String(e));
    } finally {
      if (mounted.current) { setRefreshing(false); setLastChecked(Date.now()); }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw) as Dataset;
          if (validDataset(cached) && cached.generatedAt > initial.data.generatedAt && mounted.current) { setData(cached); setSource('cache'); }
        }
      } catch { /* ignore cache errors */ }
      await refresh();
    })();
    return () => { mounted.current = false; };
  }, [refresh, initial.data.generatedAt]);

  const value = useMemo<TeamsState>(() => {
    const byId = new Map(data.teams.map((t) => [t.id, t]));
    const getTeam = (id: string) => {
      const t = byId.get(id);
      if (!t) throw new Error(`Unknown team id: ${id}`);
      return t;
    };
    const conferences = groupByConference(data.teams);
    const ranked = [...data.teams].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || (b.elo ?? 0) - (a.elo ?? 0));
    const weekGames = data.games.filter((g) => g.week === data.week && byId.has(g.awayId) && byId.has(g.homeId));
    return {
      ...data, source, refreshing, lastError, lastChecked, getTeam, hasTeam: (id) => byId.has(id), conferences, ranked, poll: data.meta?.poll ?? null, weekGames,
      findGame: (awayId, homeId) => data.games.find((g) => g.awayId === awayId && g.homeId === homeId),
      refresh,
    };
  }, [data, source, refreshing, lastError, lastChecked, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTeams(): TeamsState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTeams must be used inside TeamsProvider');
  return v;
}

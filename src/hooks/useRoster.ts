import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TeamRosterFile } from '@/data/liveTypes';
import { DATA_URL } from '@/context/TeamsContext';

const CACHE_PREFIX = 'cfb-gridiron-ai.roster.v1.';
const TIMEOUT_MS = 15_000;
const memory = new Map<string, TeamRosterFile>();

/**
 * Per-team roster file, fetched on demand the first time a team page opens.
 * Served from memory, then the on-device cache, then the network — so a team
 * you have opened before still works offline.
 */
export function useRoster(teamId: string): { roster: TeamRosterFile | null; loading: boolean; error: string | null } {
  const [roster, setRoster] = useState<TeamRosterFile | null>(() => memory.get(teamId) ?? null);
  const [loading, setLoading] = useState(!memory.has(teamId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const cached = memory.get(teamId);
    setRoster(cached ?? null);
    setLoading(!cached);
    setError(null);
    if (cached) return () => { alive = false; };

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CACHE_PREFIX + teamId);
        if (raw && alive && !memory.has(teamId)) {
          const parsed = JSON.parse(raw) as TeamRosterFile;
          if (Array.isArray(parsed?.roster)) { memory.set(teamId, parsed); setRoster(parsed); setLoading(false); }
        }
      } catch { /* cache miss is fine */ }

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(`${DATA_URL}/rosters/${teamId}.json?t=${Math.floor(Date.now() / 300_000)}`, { signal: ctrl.signal, headers: { accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const file = (await res.json()) as TeamRosterFile;
        if (!Array.isArray(file?.roster)) throw new Error('Unexpected roster shape');
        memory.set(teamId, file);
        if (alive) { setRoster(file); setError(null); }
        AsyncStorage.setItem(CACHE_PREFIX + teamId, JSON.stringify(file)).catch(() => {});
      } catch (e) {
        if (alive && !memory.has(teamId)) setError(e instanceof Error ? e.message : String(e));
      } finally {
        clearTimeout(timer);
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [teamId]);

  return { roster, loading, error };
}

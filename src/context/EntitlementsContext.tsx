/**
 * Who the user is to the product: which tier, how much of today's free meter is
 * left, whether the trial is running, and what each of those unlocks.
 *
 * Everything is local and optimistic. A purchase returns from Stripe with
 * ?upgraded=<tier> on the URL, which is enough to flip the app over
 * immediately; the licence check that makes it authoritative is the next
 * roadmap step (docs/GROWTH.md).
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Entitlements, RANK, TIER_BY_ID, TIERS, TRIAL_DAYS, TRIAL_TIER, Tier, TierId, Cycle } from '@/monetize/tiers';
import { checkoutUrl, openLink } from '@/monetize/checkout';

const KEY = 'cfb-gridiron-ai.entitlements.v1';
const DAY = 86_400_000;

interface Persisted {
  tier: TierId;
  cycle: Cycle;
  since: number | null;
  trialStartedAt: number | null;
  /** Redeemed founder / beta code, kept so support can see it. */
  code: string | null;
  /** Free-meter usage, reset each local day. */
  usage: { day: string; sims: number };
  /** Upgrade prompts already shown, so the app never nags twice for the same thing. */
  seen: string[];
}

const today = () => new Date().toISOString().slice(0, 10);
const DEFAULTS: Persisted = { tier: 'walkon', cycle: 'monthly', since: null, trialStartedAt: null, code: null, usage: { day: today(), sims: 0 }, seen: [] };

/**
 * Beta codes. Client-side, therefore convenience rather than security — they
 * exist so early users, podcast partners and refund cases can be made whole in
 * one tap while the licence server is still on the roadmap.
 */
const CODES: Record<string, { tier: TierId; days: number }> = {
  FOUNDER: { tier: 'dynasty', days: 3650 },
  WEEKZERO: { tier: 'bluechip', days: 30 },
  BEATWRITER: { tier: 'bluechip', days: 365 },
  RIVALRY: { tier: 'scholarship', days: 30 },
};

interface State {
  loaded: boolean;
  tier: Tier;
  tierId: TierId;
  cycle: Cycle;
  ent: Entitlements;
  paid: boolean;
  /** Trial state, if one is running or available. */
  trial: { active: boolean; available: boolean; daysLeft: number };
  /** Sims left today on the free meter; Infinity when uncapped. */
  simsLeft: number;
  /** True when the tier covers the entitlement at all. */
  can: (key: keyof Entitlements) => boolean;
  /** Numeric ceiling for an entitlement. */
  limit: (key: keyof Entitlements) => number;
  /** Spend one unit of the daily meter. False = out of sims. */
  spendSim: () => boolean;
  atLeast: (t: TierId) => boolean;
  startTrial: () => void;
  redeem: (code: string) => { ok: boolean; message: string };
  upgrade: (tier: TierId, cycle: Cycle) => Promise<'checkout' | 'intent'>;
  setCycle: (c: Cycle) => void;
  /** Dev/preview: set the tier by hand (Settings → Developer). */
  setTier: (t: TierId) => void;
  markSeen: (k: string) => void;
  hasSeen: (k: string) => boolean;
}

const Ctx = createContext<State | null>(null);

export function EntitlementsProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<Persisted>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        let next = raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Persisted>) } : DEFAULTS;
        if (next.usage?.day !== today()) next = { ...next, usage: { day: today(), sims: 0 } };
        // Coming back from Stripe: ?upgraded=allpro
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const q = new URLSearchParams(window.location.search).get('upgraded') as TierId | null;
          if (q && TIER_BY_ID[q]) {
            next = { ...next, tier: q, since: Date.now() };
            window.history.replaceState({}, '', window.location.pathname);
          }
        }
        setS(next);
      } catch { /* first run */ }
      setLoaded(true);
    })();
  }, []);

  const save = useCallback((next: Persisted) => { setS(next); AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {}); }, []);

  const trialActive = s.trialStartedAt != null && Date.now() - s.trialStartedAt < TRIAL_DAYS * DAY;
  const effectiveId: TierId = trialActive && RANK[TRIAL_TIER] > RANK[s.tier] ? TRIAL_TIER : s.tier;
  const tier = TIER_BY_ID[effectiveId] ?? TIERS[0];
  const ent = tier.entitlements;

  const value: State = useMemo(() => ({
    loaded,
    tier,
    tierId: effectiveId,
    cycle: s.cycle,
    ent,
    paid: RANK[effectiveId] > 0,
    trial: {
      active: trialActive,
      available: s.trialStartedAt == null && RANK[s.tier] === 0,
      daysLeft: trialActive ? Math.max(0, Math.ceil((s.trialStartedAt! + TRIAL_DAYS * DAY - Date.now()) / DAY)) : 0,
    },
    simsLeft: ent.simsPerDay === Infinity ? Infinity : Math.max(0, ent.simsPerDay - s.usage.sims),
    can: (key) => {
      const v = ent[key];
      return typeof v === 'number' ? v > 0 : typeof v === 'boolean' ? v : v !== 'off';
    },
    limit: (key) => { const v = ent[key]; return typeof v === 'number' ? v : v ? 1 : 0; },
    spendSim: () => {
      if (ent.simsPerDay === Infinity) return true;
      if (s.usage.sims >= ent.simsPerDay) return false;
      save({ ...s, usage: { day: today(), sims: s.usage.sims + 1 } });
      return true;
    },
    atLeast: (t) => RANK[effectiveId] >= RANK[t],
    startTrial: () => save({ ...s, trialStartedAt: Date.now() }),
    redeem: (raw) => {
      const code = raw.trim().toUpperCase();
      const hit = CODES[code];
      if (!hit) return { ok: false, message: 'That code is not live. Check the spelling?' };
      save({ ...s, tier: hit.tier, since: Date.now(), code });
      return { ok: true, message: `${TIER_BY_ID[hit.tier].name} unlocked. Welcome in.` };
    },
    upgrade: async (t, c) => {
      const url = checkoutUrl(t, c);
      if (url && (await openLink(url))) return 'checkout';
      save({ ...s, seen: [...new Set([...s.seen, `intent:${t}:${c}`])] });
      return 'intent';
    },
    setCycle: (c) => save({ ...s, cycle: c }),
    setTier: (t) => save({ ...s, tier: t, since: Date.now() }),
    markSeen: (k) => save({ ...s, seen: [...new Set([...s.seen, k])] }),
    hasSeen: (k) => s.seen.includes(k),
  }), [loaded, s, tier, ent, effectiveId, trialActive, save]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEntitlements(): State {
  const v = useContext(Ctx);
  if (!v) throw new Error('useEntitlements outside EntitlementsProvider');
  return v;
}

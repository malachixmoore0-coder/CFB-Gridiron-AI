import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NodeWeights } from '@/engine/types';
import { normalizeWeights, HFA_MAX, HFA_MIN } from '@/engine/weights';
import { colors, radius, spacing } from '@/theme';
import { useSettings, SimCount } from '@/context/SettingsContext';
import { useTeams, DATA_URL } from '@/context/TeamsContext';
import { timeAgo } from '@/utils/format';
import { Section } from '@/components/Section';
import { Stepper } from '@/components/Stepper';
import { Chip } from '@/components/Chip';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useEntitlements } from '@/context/EntitlementsContext';
import { useEngagement } from '@/context/EngagementContext';
import { TierPill } from '@/components/Pro';
import { TIERS, price } from '@/monetize/tiers';
import { Ionicons } from '@expo/vector-icons';

const NODES: { key: keyof NodeWeights; label: string; hint: string }[] = [
  { key: 'scheme', label: 'Scheme & Tactical Bias', hint: 'Fronts, coverages, play-action, 3rd/4th down, red zone, adjustments' },
  { key: 'personnel', label: 'Personnel & Matchup Edge', hint: 'QB, roster talent, PBWR vs PRWR, slot vs nickel, TE vs LB, injuries' },
  { key: 'environment', label: 'Environmental & Rivalry', hint: 'Home field (crowd, travel, altitude, night), weather, rivalry variance' },
  { key: 'xfactor', label: 'Sleeper & X-Factor', hint: 'Target share, TPRR, rotational rushers, target-tree concentration' },
];

const SIMS: SimCount[] = [2000, 5000, 10000, 25000];

interface Props { onBack?: () => void; onUpgrade?: () => void; onOpenCard?: () => void; }

export function SettingsScreen({ onBack, onUpgrade, onOpenCard }: Props) {
  const s = useSettings();
  const live = useTeams();
  const ent = useEntitlements();
  const eng = useEngagement();
  const norm = normalizeWeights(s.weights);
  const rawTotal = s.weights.scheme + s.weights.personnel + s.weights.environment + s.weights.xfactor;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader title="Model" subtitle="Tune the engine's weighted nodes" onBack={onBack}
        right={<TierPill tier={ent.tier} trial={ent.trial.active ? ent.trial.daysLeft : undefined} onPress={onUpgrade} />} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Section icon="person-circle" title="Your account" subtitle={`${ent.tier.name}${ent.trial.active ? ` · trial, ${ent.trial.daysLeft}d left` : ''}`}>
          <View style={styles.accountRow}>
            <AccountStat label="STREAK" value={`${eng.streak}d`} />
            <AccountStat label="CARD" value={`${eng.summary.won}-${eng.summary.lost}`} />
            <AccountStat label="SIMS TODAY" value={ent.simsLeft === Infinity ? '∞' : `${ent.simsLeft} left`} />
            <AccountStat label="DEPTH" value={ent.ent.simDepth.toLocaleString()} />
          </View>
          <View style={styles.accountActions}>
            {!!onOpenCard && (
              <TouchableOpacity style={styles.accountBtn} activeOpacity={0.85} onPress={onOpenCard}>
                <Ionicons name="bookmark" size={13} color={colors.ink} />
                <Text style={styles.accountBtnText}>Your card</Text>
              </TouchableOpacity>
            )}
            {!!onUpgrade && (
              <TouchableOpacity style={[styles.accountBtn, styles.accountBtnGo]} activeOpacity={0.85} onPress={onUpgrade}>
                <Ionicons name="flash" size={13} color={colors.bg} />
                <Text style={[styles.accountBtnText, { color: colors.bg }]}>
                  {ent.paid ? 'Manage plan' : `Go Pro · from ${price(TIERS[1].monthly)}/mo`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Section>
        <Section
          icon="git-network"
          title="Node weights"
          subtitle={rawTotal === 100 ? 'Sums to 100' : `Raw sum ${rawTotal} → normalised to 100`}
          right={(
            <TouchableOpacity onPress={s.resetWeights} style={styles.reset}><Text style={styles.resetText}>Reset</Text></TouchableOpacity>
          )}
        >
          {NODES.map((n) => (
            <View key={n.key}>
              <Stepper label={n.label} hint={n.hint} value={s.weights[n.key]} step={5} min={0} max={100} format={(v) => `${v}%`} onChange={(v) => s.setWeight(n.key, v)} />
              <View style={styles.track}><View style={[styles.fill, { width: `${norm[n.key]}%` }]} /></View>
            </View>
          ))}
          <Text style={styles.small}>Effective: Scheme {Math.round(norm.scheme)}% · Personnel {Math.round(norm.personnel)}% · Environment {Math.round(norm.environment)}% · X-Factor {Math.round(norm.xfactor)}%</Text>
        </Section>

        <Section icon="repeat" title="Simulation runs" subtitle="More runs = smoother probabilities, slower on old phones">
          <View style={styles.wrapRow}>
            {SIMS.map((n) => <Chip key={n} label={n.toLocaleString()} active={s.simulations === n} onPress={() => s.setSimulations(n)} />)}
          </View>
        </Section>

        <Section icon="home" title="Home-field base" subtitle="Win-probability points before crowd size, travel, altitude & night kicks">
          <Stepper label="Base HFA" hint={`Range ${HFA_MIN.toFixed(1)}% – ${HFA_MAX.toFixed(1)}% (college crowds are worth ~2× an NFL one)`} value={s.homeFieldBase} step={0.5} min={HFA_MIN} max={HFA_MAX} format={(v) => `${v.toFixed(1)}%`} onChange={s.setHomeFieldBase} />
        </Section>

        <Section icon="medkit" title="Injury degradation metrics" subtitle="Win-efficiency cost of losing a starter">
          <Row k="Quarterback" v="−20% win efficiency" />
          <Row k="Left tackle" v="−12% pass protection" />
          <Row k="Edge rusher" v="−8% pass-rush win rate" />
          <Row k="WR1 / CB1" v="−7% passing / coverage efficiency" />
          <Row k="Interior OL / DT / nickel / RB" v="−5%" />
          <Row k="TE / LB / S" v="−4%" />
          <Text style={styles.small}>Rotational players carry half the hit, depth players a fifth. "Questionable" applies half of the listed amount.</Text>
          <TouchableOpacity style={styles.danger} onPress={s.clearOverrides}><Text style={styles.dangerText}>Reset {Object.keys(s.overrides).length} manual override{Object.keys(s.overrides).length === 1 ? '' : 's'} to reported statuses</Text></TouchableOpacity>
        </Section>

        <Section icon="cloud-download" title="Live data" subtitle={`${live.source === 'sample' ? 'Sample fallback' : `Source: ${live.source}`} · generated ${live.generatedAt ? timeAgo(Date.parse(live.generatedAt)) : 'n/a'}`}
          right={<TouchableOpacity onPress={live.refresh} style={styles.reset}><Text style={styles.resetText}>{live.refreshing ? 'Refreshing…' : 'Refresh'}</Text></TouchableOpacity>}
        >
          <Row k="Season / phase" v={`${live.season} · ${live.phase} · week ${live.week}`} />
          <Row k="Depth charts" v={live.meta?.depthChartsAsOf ? `ESPN, ${new Date(live.meta.depthChartsAsOf).toLocaleDateString()}` : 'play-by-play usage'} />
          <Row k="Poll" v={live.meta?.poll ?? 'none loaded'} />
          <Row k="Teams" v={`${live.teams.length} FBS`} />
          <Row k="Blend" v={live.meta?.blend ? `${Math.round(live.meta.blend.currentWeightMax * 100)}% ${live.season} / ${Math.round((1 - live.meta.blend.currentWeightMax) * 100)}% ${live.meta.priorSeason}` : 'n/a'} />
          <Row k="Sources OK" v={live.meta ? `${live.meta.sources.filter((x) => x.ok).length} / ${live.meta.sources.length}` : 'n/a'} />
          {live.lastError && <Row k="Last refresh" v={`failed: ${live.lastError}`} />}
          <Text style={styles.about}>
            {'\n'}The dataset is rebuilt automatically by a scheduled GitHub Action (every 3 hours in-season) from the sportsdataverse
            ESPN play-by-play feed (EPA, success, havoc, player ids), CollegeFootballData schedules, results, Elo and rosters, with
            ESPN odds, rankings, injuries and depth charts plus Open-Meteo kickoff forecasts as best-effort extras. The app fetches the
            latest build on launch and caches it.
            {'\n\n'}Team ratings blend the prior season with the current one using w = games played ÷ (games played + 4), then lean on
            each program's Elo-derived talent level while the current-season sample is small — rosters turn over too fast in college
            to trust last year alone. Pass-block / pass-rush win rates are sack-and-hurry proxies; snap shares are role estimates;
            play-action rate, base front and coverage family are curated because no free college feed charts them.
            {'\n\n'}Feed: <Text style={styles.code}>{DATA_URL}</Text>
          </Text>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.row}><Text style={styles.rowKey}>{k}</Text><Text style={styles.rowVal}>{v}</Text></View>
  );
}

function AccountStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.accountLabel}>{label}</Text>
      <Text style={styles.accountValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  accountRow: { flexDirection: 'row', gap: spacing.sm },
  accountLabel: { color: colors.inkFaint, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  accountValue: { color: colors.ink, fontSize: 15, fontWeight: '900', marginTop: 3 },
  accountActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  accountBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  accountBtnGo: { backgroundColor: colors.gold, borderColor: colors.gold },
  accountBtnText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  reset: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  resetText: { color: colors.ink, fontWeight: '800', fontSize: 12 },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.bg, marginBottom: 6, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.gold },
  small: { color: colors.inkFaint, fontSize: 11, lineHeight: 16, marginTop: spacing.sm },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowKey: { color: colors.inkDim, fontSize: 13, fontWeight: '700' },
  rowVal: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  danger: { marginTop: spacing.md, alignItems: 'center', paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.negative },
  dangerText: { color: colors.negative, fontWeight: '800', fontSize: 13 },
  about: { color: colors.inkDim, fontSize: 13, lineHeight: 20 },
  code: { color: colors.gold, fontWeight: '800' },
});

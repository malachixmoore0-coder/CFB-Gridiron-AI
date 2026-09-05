import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTeams } from '@/context/TeamsContext';
import { colors, radius, ratingColor, spacing } from '@/theme';
import { useSettings } from '@/context/SettingsContext';
import { TeamMark } from '@/components/TeamMark';
import { Section } from '@/components/Section';
import { PlayerRow } from '@/components/PlayerRow';
import { ScreenHeader } from '@/components/ScreenHeader';

interface Props { teamId: string; onBack: () => void; }

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function TeamDetailScreen({ teamId, onBack }: Props) {
  const { getTeam } = useTeams();
  const t = getTeam(teamId);
  const { statusOf, cycleStatus, hasOverride } = useSettings();
  const c = t.coaching;
  const o = t.offense;
  const d = t.defense;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader title={`${t.rank ? `#${t.rank} ` : ''}${t.school} ${t.mascot}${t.record ? ` (${t.record})` : ''}`} subtitle={`${t.conference} · ${t.stadium.name}${t.stadium.dome ? ' (indoors)' : ''}${t.stadium.capacity ? ` · ${Math.round(t.stadium.capacity / 1000)}k` : ''}`} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <TeamMark team={t} size={64} />
          <View style={{ flex: 1 }}>
            <Text style={styles.scheme}>{c.offScheme} offense</Text>
            <Text style={styles.schemeSub}>{c.defFront} front · {c.baseCoverage} base{c.headCoach ? ` · HC ${c.headCoach}` : ''}</Text>
            <View style={styles.pills}>
              <Pill label={`${pct(c.passRate)} pass`} />
              {c.qbRunShare !== undefined && <Pill label={`${pct(c.qbRunShare)} QB runs`} />}
              <Pill label={`${c.pace} plays/g`} />
              <Pill label={`Noise ${t.stadium.noise}/10`} />
              {t.elo !== undefined && <Pill label={`Elo ${Math.round(t.elo)}`} />}
              {t.talent !== undefined && <Pill label={`Talent ${t.talent}/10`} />}
            </View>
          </View>
        </View>

        <Section icon="flag" title="Coaching tendencies" subtitle="Node 1 inputs">
          <Bar label="3rd-down conversion (off)" value={c.thirdDownOff} lo={0.3} hi={0.52} fmt={pct} />
          <Bar label="3rd-down stop rate (def)" value={c.thirdDownDef} lo={0.52} hi={0.72} fmt={pct} />
          <Bar label="4th-down go rate" value={c.fourthDownGoRate} lo={0.2} hi={0.8} fmt={pct} />
          <Bar label="Red-zone TD rate" value={c.redZoneTd} lo={0.42} hi={0.72} fmt={pct} />
          <Bar label="Red-zone aggressiveness" value={c.redZoneAggression} lo={1} hi={10} />
          <Bar label="Halftime adjustments" value={c.halftimeAdjust} lo={1} hi={10} />
          <Bar label="Secondary adjustments" value={d.secondaryAdjust} lo={1} hi={10} />
        </Section>

        <Section icon="rocket" title="Offense" subtitle="Node 2 inputs">
          <Bar label="Quarterback" value={o.qb} lo={1} hi={10} />
          <Bar label="Passing efficiency" value={o.passEfficiency} lo={1} hi={10} />
          <Bar label="Rushing efficiency" value={o.rushEfficiency} lo={1} hi={10} />
          <Bar label="Explosiveness" value={o.explosiveness} lo={1} hi={10} />
          <Bar label="Pass-block win rate" value={o.pbwr} lo={0.48} hi={0.72} fmt={pct} />
          <Bar label="Slot receiver efficiency" value={o.slotEfficiency} lo={1} hi={10} />
          <Bar label="TE speed" value={o.teSpeed} lo={1} hi={10} />
          <Text style={styles.small}>
            vs fronts: 4-2-5 {o.vsFront['4-2-5']} · 4-3 {o.vsFront['4-3']} · 3-3-5 {o.vsFront['3-3-5']} · 3-4 {o.vsFront['3-4']} · Multiple {o.vsFront.Multiple}
            {'\n'}vs coverage: C1 {o.vsCoverage['Cover-1']} · C2 {o.vsCoverage['Cover-2']} · C3 {o.vsCoverage['Cover-3']} · Qtrs {o.vsCoverage.Quarters} · C2-man {o.vsCoverage['Cover-2 Man']}
          </Text>
        </Section>

        <Section icon="shield-checkmark" title="Defense" subtitle="Node 2 inputs">
          <Bar label="Pass defense" value={d.passDefense} lo={1} hi={10} />
          <Bar label="Run defense" value={d.rushDefense} lo={1} hi={10} />
          <Bar label="Pass-rush win rate" value={d.prwr} lo={0.32} hi={0.56} fmt={pct} />
          <Bar label="Nickel corner" value={d.nickelCorner} lo={1} hi={10} />
          <Bar label="LB coverage" value={d.lbCoverage} lo={1} hi={10} />
          <Bar label="Takeaways" value={d.takeaways} lo={1} hi={10} />
          <Bar label="Havoc / blitz proxy" value={d.blitzRate} lo={0.15} hi={0.45} fmt={pct} />
        </Section>

        <Section icon="people" title="Depth chart & availability" subtitle="Ordered by play-by-play usage (or ESPN's chart when available) · tap to override (Active → Questionable → Out → reported)">
          {t.players.map((p) => (
            <PlayerRow key={p.id} player={p} status={statusOf(p)} overridden={hasOverride(p.id)} onCycle={() => cycleStatus(p)} />
          ))}
          <Text style={styles.small}>Grades and usage are computed from play-by-play (prior season blended with the current one as games are played; a transfer's production follows him). Snap shares are role estimates — college feeds publish no snap counts. Overrides persist on this device and apply to every matchup this team plays.</Text>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Pill({ label }: { label: string }) {
  return <View style={styles.pill}><Text style={styles.pillText}>{label}</Text></View>;
}

function Bar({ label, value, lo, hi, fmt }: { label: string; value: number; lo: number; hi: number; fmt?: (v: number) => string }) {
  const frac = Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
  const rating = 1 + frac * 9;
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}><View style={[styles.barFill, { width: `${frac * 100}%`, backgroundColor: ratingColor(rating) }]} /></View>
      <Text style={styles.barValue}>{fmt ? fmt(value) : value.toFixed(1)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.lg },
  scheme: { color: colors.ink, fontWeight: '900', fontSize: 16 },
  schemeSub: { color: colors.inkFaint, fontSize: 12, marginTop: 2 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  pillText: { color: colors.inkDim, fontSize: 10, fontWeight: '800' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  barLabel: { color: colors.inkDim, fontSize: 12, fontWeight: '700', width: 150 },
  barTrack: { flex: 1, height: 8, borderRadius: radius.pill, backgroundColor: colors.cardAlt, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.pill },
  barValue: { color: colors.ink, fontSize: 12, fontWeight: '900', width: 40, textAlign: 'right' },
  small: { color: colors.inkFaint, fontSize: 11, lineHeight: 16, marginTop: spacing.sm },
});

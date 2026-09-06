import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTeams } from '@/context/TeamsContext';
import { useSettings } from '@/context/SettingsContext';
import { useRoster } from '@/hooks/useRoster';
import { colors, radius, ratingColor, shadow, spacing } from '@/theme';
import { CONFERENCE_SHORT } from '@/data/teams';
import type { RosterPlayer } from '@/data/liveTypes';
import { groupByString, groupRoster, POSITION_NAME, STRING_LABEL, UNIT_NAME } from '@/utils/roster';
import { TeamMark } from '@/components/TeamMark';
import { Section } from '@/components/Section';
import { RosterRow } from '@/components/RosterRow';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Chip } from '@/components/Chip';

interface Props { teamId: string; onBack: () => void; onOpenPlayer: (teamId: string, playerId: string) => void; onOpenTeam?: (id: string) => void; onOpenGame?: (teamId: string, gameId: string) => void; }

const pct = (v: number) => `${Math.round(v * 100)}%`;
type Tab = 'depth' | 'roster' | 'profile';

/** One scrolling page per team: identity, season schedule, depth chart, full roster and the ratings feeding the engine. */
export function TeamDetailScreen({ teamId, onBack, onOpenPlayer, onOpenTeam, onOpenGame }: Props) {
  const { getTeam, hasTeam } = useTeams();
  const t = getTeam(teamId);
  const { statusOf, hasOverride } = useSettings();
  const { roster: file, loading, error } = useRoster(teamId);
  const [tab, setTab] = useState<Tab>('depth');
  // A full roster is ~90 players with a photo each. Rendering every one at once
  // is enough to exhaust an installed web app's memory budget on a phone, so
  // sections are revealed on demand.
  const [strings, setStrings] = useState(2);
  const [unit, setUnit] = useState<RosterPlayer['unit']>('offense');
  const c = t.coaching;
  const o = t.offense;
  const d = t.defense;

  const roster = file?.roster ?? [];
  const byString = useMemo(() => groupByString(roster), [roster]);
  const byUnit = useMemo(() => groupRoster(roster), [roster]);
  const statusFor = (p: RosterPlayer) => {
    const engine = t.players.find((x) => x.id === p.id);
    return engine ? statusOf(engine) : p.reported ?? 'healthy';
  };
  const flagged = roster.filter((p) => statusFor(p) !== 'healthy').length;
  const openPlayer = (p: RosterPlayer) => onOpenPlayer(teamId, p.id);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader
        title={`${t.rank ? `#${t.rank} ` : ''}${t.school} ${t.mascot}`}
        subtitle={`${t.conference}${file?.record ? ` · ${file.record}` : t.record ? ` · ${t.record}` : ''} · ${t.stadium.name}`}
        onBack={onBack}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <TeamMark team={t} size={68} />
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
              <Pill label={CONFERENCE_SHORT[t.conference]} />
            </View>
          </View>
        </View>

        {!!file?.schedule.length && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.schedBar} contentContainerStyle={styles.sched}>
            {file.schedule.map((g) => {
              const won = g.result === 'W';
              const isNext = g.id === file.nextGameId;
              const played = g.status === 'final';
              return (
                <TouchableOpacity
                  key={g.id}
                  style={[styles.game, isNext && styles.gameNext, g.result ? (won ? styles.gameWin : styles.gameLoss) : null]}
                  activeOpacity={0.7}
                  onPress={() => (onOpenGame ? onOpenGame(teamId, g.id) : g.oppId && hasTeam(g.oppId) && onOpenTeam?.(g.oppId))}
                >
                  <Text style={styles.gameWeek}>Wk {g.week}{isNext ? ' · next' : ''}</Text>
                  <Text style={styles.gameOpp} numberOfLines={1}>{g.neutral ? 'vs' : g.home ? 'vs' : 'at'} {g.oppName}</Text>
                  <Text style={[styles.gameResult, { color: g.result ? (won ? colors.positive : colors.negative) : colors.inkFaint }]}>
                    {g.result ? `${g.result} ${g.teamScore}–${g.oppScore}` : new Date(g.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </Text>
                  <View style={styles.gameHint}>
                    <Ionicons name={played ? 'stats-chart' : 'analytics'} size={10} color={colors.inkFaint} />
                    <Text style={styles.gameHintText}>{played ? 'Box score' : 'Preview'}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        <View style={styles.tabs}>
          <Chip label="Depth chart" active={tab === 'depth'} onPress={() => setTab('depth')} small />
          <Chip label={`Roster${roster.length ? ` · ${roster.length}` : ''}`} active={tab === 'roster'} onPress={() => setTab('roster')} small />
          <Chip label="Team profile" active={tab === 'profile'} onPress={() => setTab('profile')} small />
        </View>

        {tab !== 'profile' && loading && !roster.length && (
          <View style={styles.loading}><ActivityIndicator color={colors.gold} /><Text style={styles.small}>Loading roster…</Text></View>
        )}
        {tab !== 'profile' && !!error && !roster.length && (
          <Text style={styles.small}>Roster unavailable ({error}). The depth chart the engine uses is still shown under Team profile.</Text>
        )}

        {tab === 'depth' && roster.length > 0 && (
          <>
            <Text style={styles.blurb}>
              Ordered by play-by-play usage, then class. {flagged > 0 ? `${flagged} flagged as questionable or out. ` : ''}Tap a player for his profile.
            </Text>
            {byString.slice(0, strings).map((s) => (
              <Section key={s.string} icon={s.string === 1 ? 'star' : 'people'} title={STRING_LABEL(s.string)} subtitle={`${s.players.length} player${s.players.length === 1 ? '' : 's'}`}>
                {s.players.map((p) => (
                  <RosterRow key={p.id} player={p} file={file} team={t} status={statusFor(p)} overridden={hasOverride(p.id)} onPress={() => openPlayer(p)} showPos />
                ))}
              </Section>
            ))}
            {byString.length > strings && (
              <TouchableOpacity style={styles.more} activeOpacity={0.8} onPress={() => setStrings((n) => n + 2)}>
                <Text style={styles.moreText}>Show {STRING_LABEL(strings + 1)}{byString.length > strings + 1 ? ' and deeper' : ''} · {byString.slice(strings).reduce((n, s) => n + s.players.length, 0)} more</Text>
                <Ionicons name="chevron-down" size={15} color={colors.gold} />
              </TouchableOpacity>
            )}
          </>
        )}

        {tab === 'roster' && roster.length > 0 && (
          <View style={styles.tabs}>
            {byUnit.map((u) => (
              <Chip key={u.unit} label={`${UNIT_NAME[u.unit]} · ${u.groups.reduce((n, g) => n + g.players.length, 0)}`} active={unit === u.unit} onPress={() => setUnit(u.unit)} small />
            ))}
          </View>
        )}
        {tab === 'roster' && roster.length > 0 && byUnit.filter((u) => u.unit === unit).map((u) => (
          <Section key={u.unit} icon={u.unit === 'offense' ? 'rocket' : u.unit === 'defense' ? 'shield-checkmark' : 'football'} title={UNIT_NAME[u.unit]} subtitle={`${u.groups.reduce((n, g) => n + g.players.length, 0)} players`}>
            {u.groups.map((g) => (
              <View key={g.pos} style={styles.posGroup}>
                <Text style={styles.posTitle}>{POSITION_NAME[g.pos]} · {g.players.length}</Text>
                {g.players.map((p) => (
                  <RosterRow key={p.id} player={p} file={file} team={t} status={statusFor(p)} overridden={hasOverride(p.id)} onPress={() => openPlayer(p)} />
                ))}
              </View>
            ))}
          </Section>
        ))}

        {tab === 'profile' && (
          <>
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
            <Section icon="people" title="Engine depth chart" subtitle="The players the simulation actually uses">
              {t.players.map((p) => {
                const rp = roster.find((r) => r.id === p.id);
                return (
                  <TouchableOpacity key={p.id} style={styles.engineRow} activeOpacity={0.75} onPress={() => rp && openPlayer(rp)}>
                    <View style={styles.enginePos}><Text style={styles.enginePosText}>{p.pos}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.engineName}>{p.jersey ? `#${p.jersey} ` : ''}{p.name}</Text>
                      <Text style={styles.engineMeta}>{p.role === 'starter' ? 'Starter' : p.role === 'rotational' ? 'Rotational' : 'Depth'} · {Math.round(p.snapPct * 100)}% snaps{p.note ? ` · ${p.note}` : ''}</Text>
                    </View>
                    <Text style={styles.engineRating}>{p.rating}</Text>
                  </TouchableOpacity>
                );
              })}
              <Text style={styles.small}>Grades and usage are computed from play-by-play (prior season blended with the current one; a transfer's production follows him). Snap shares are role estimates. Availability overrides persist on this device and apply to every matchup this team plays.</Text>
            </Section>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Pill({ label }: { label: string }) {
  return <View style={styles.pill}><Text style={styles.pillText}>{label}</Text></View>;
}

function Bar({ label, value, lo, hi, fmt }: { label: string; value: number; lo: number; hi: number; fmt?: (v: number) => string }) {
  const frac = Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}><View style={[styles.barFill, { width: `${frac * 100}%`, backgroundColor: ratingColor(1 + frac * 9) }]} /></View>
      <Text style={styles.barValue}>{fmt ? fmt(value) : value.toFixed(1)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md, ...shadow.card },
  scheme: { color: colors.ink, fontWeight: '900', fontSize: 16 },
  schemeSub: { color: colors.inkFaint, fontSize: 12, marginTop: 2 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  pillText: { color: colors.inkDim, fontSize: 10, fontWeight: '800' },
  schedBar: { flexGrow: 0, flexShrink: 0, marginBottom: spacing.md },
  sched: { gap: spacing.sm },
  game: { width: 116, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm },
  gameNext: { borderColor: colors.gold },
  gameWin: { borderLeftWidth: 3, borderLeftColor: colors.positive },
  gameLoss: { borderLeftWidth: 3, borderLeftColor: colors.negative },
  gameWeek: { color: colors.inkFaint, fontSize: 9, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  gameOpp: { color: colors.ink, fontSize: 12, fontWeight: '800', marginTop: 2 },
  gameResult: { fontSize: 11, fontWeight: '800', marginTop: 2 },
  gameHint: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  gameHintText: { color: colors.inkFaint, fontSize: 9, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, flexWrap: 'wrap' },
  loading: { alignItems: 'center', gap: 8, paddingVertical: spacing.xl },
  blurb: { color: colors.inkFaint, fontSize: 11, lineHeight: 16, marginBottom: spacing.md },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, marginBottom: spacing.md },
  moreText: { color: colors.gold, fontWeight: '800', fontSize: 13 },
  posGroup: { marginBottom: spacing.md },
  posTitle: { color: colors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  barLabel: { color: colors.inkDim, fontSize: 12, fontWeight: '700', width: 150 },
  barTrack: { flex: 1, height: 8, borderRadius: radius.pill, backgroundColor: colors.cardAlt, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.pill },
  barValue: { color: colors.ink, fontSize: 12, fontWeight: '900', width: 40, textAlign: 'right' },
  engineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider },
  enginePos: { width: 40, height: 28, borderRadius: 8, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  enginePosText: { color: colors.inkDim, fontWeight: '900', fontSize: 11 },
  engineName: { color: colors.ink, fontWeight: '800', fontSize: 13 },
  engineMeta: { color: colors.inkFaint, fontSize: 10, marginTop: 1 },
  engineRating: { color: colors.gold, fontWeight: '900', fontSize: 14 },
  small: { color: colors.inkFaint, fontSize: 11, lineHeight: 16, marginTop: spacing.sm },
});

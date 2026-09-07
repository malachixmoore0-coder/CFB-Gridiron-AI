import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RosterPlayer, StatLine, TeamRosterFile } from '@/data/liveTypes';
import { useTeams } from '@/context/TeamsContext';
import { useSettings } from '@/context/SettingsContext';
import { useRoster } from '@/hooks/useRoster';
import { useEntitlements } from '@/context/EntitlementsContext';
import { propsFor } from '@/utils/props';
import { Locked } from '@/components/Pro';
import { colors, radius, ratingColor, shadow, sideColor, spacing } from '@/theme';
import { headshotOf, logColumns, POSITION_NAME, stat, STRING_LABEL } from '@/utils/roster';
import { matchupAngles } from '@/utils/matchup';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { TeamMark } from '@/components/TeamMark';
import { Section } from '@/components/Section';
import { ScreenHeader } from '@/components/ScreenHeader';
import { INJURY_DEGRADATION } from '@/engine/weights';

interface Props { teamId: string; playerId: string; onBack: () => void; onOpenTeam: (id: string) => void; onUpgrade?: () => void; }

/** Full profile for one player: status, traits, season and game-by-game stats, next matchup. */
export function PlayerProfileScreen({ teamId, playerId, onBack, onOpenTeam, onUpgrade }: Props) {
  const { getTeam, hasTeam, findRecord } = useTeams();
  const ent = useEntitlements();
  const { statusOf, cycleStatus, hasOverride } = useSettings();
  const { roster: file, loading } = useRoster(teamId);
  const team = getTeam(teamId);
  const player = file?.roster.find((p) => p.id === playerId || p.athleteId === playerId);

  if (!player) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <ScreenHeader title="Player" onBack={onBack} />
        <Text style={styles.empty}>{loading ? 'Loading roster…' : 'This player is no longer on the published roster.'}</Text>
      </SafeAreaView>
    );
  }

  // The engine tracks availability by depth-chart id; reserves fall back to the reported status.
  const enginePlayer = team.players.find((p) => p.id === player.id);
  const status = enginePlayer ? statusOf(enginePlayer) : player.reported ?? 'healthy';
  const overridden = enginePlayer ? hasOverride(enginePlayer.id) : false;
  const statusColor = status === 'out' ? colors.negative : status === 'questionable' ? colors.warning : colors.positive;
  const statusLabel = status === 'out' ? 'Out' : status === 'questionable' ? 'Questionable' : 'Active';

  const next = file?.schedule.find((g) => g.id === file.nextGameId);
  // Volume scales with the points the model projects for this team in the next game.
  const nextRec = next ? findRecord(next.id) : undefined;
  const projectedPoints = nextRec ? (next!.home ? nextRec.projectedHome : nextRec.projectedAway) : null;
  const props = propsFor(player, projectedPoints);
  const opp = next?.oppId && hasTeam(next.oppId) ? getTeam(next.oppId) : null;
  const angles = opp ? matchupAngles(player, team, opp) : [];
  const cols = logColumns(player.pos);
  const played = [...player.games].sort((a, b) => b.week - a.week);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader title={player.name} subtitle={`${team.school} · ${player.listedPos || player.pos}${player.jersey ? ` · #${player.jersey}` : ''}`} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <PlayerAvatar uri={headshotOf(player, file, 92)} name={player.name} team={team} size={92} />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>{player.jersey ? `#${player.jersey} ` : ''}{player.name}</Text>
            <TouchableOpacity style={styles.teamLink} onPress={() => onOpenTeam(team.id)} activeOpacity={0.7}>
              <TeamMark team={team} size={18} />
              <Text style={styles.teamLinkText}>{team.school} {team.mascot}</Text>
            </TouchableOpacity>
            <View style={styles.pills}>
              <Pill label={player.listedPos || player.pos} gold />
              {!!player.classLabel && <Pill label={player.classLabel} />}
              {!!player.height && <Pill label={player.height} />}
              {!!player.weight && <Pill label={`${player.weight} lb`} />}
            </View>
            {!!player.hometown && <Text style={styles.hometown}>{player.hometown}</Text>}
          </View>
        </View>

        <View style={styles.statusRow}>
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>Depth</Text>
            <Text style={styles.statusValue}>{STRING_LABEL(player.string)}</Text>
            <Text style={styles.statusSub}>{player.role === 'starter' ? 'Engine starter' : player.role === 'rotational' ? 'Rotational' : player.role === 'depth' ? 'Backup' : 'Reserve'} · {POSITION_NAME[player.pos]} #{player.rank}</Text>
          </View>
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>Grade</Text>
            <Text style={[styles.statusValue, { color: player.rating === null ? colors.inkDim : ratingColor(((player.rating - 40) / 57) * 9 + 1) }]}>{player.rating ?? '—'}</Text>
            <Text style={styles.statusSub}>{player.ratingBasis === 'production' ? 'from production' : 'roster estimate'}</Text>
          </View>
          <TouchableOpacity style={styles.statusCard} activeOpacity={enginePlayer ? 0.7 : 1} onPress={() => enginePlayer && cycleStatus(enginePlayer)}>
            <Text style={styles.statusLabel}>Status</Text>
            <Text style={[styles.statusValue, { color: statusColor }]}>{statusLabel}</Text>
            <Text style={styles.statusSub} numberOfLines={2}>
              {player.reportNote ? player.reportNote : overridden ? 'Set by you · tap to change' : enginePlayer ? 'Tap to change' : 'Not on the depth chart'}
            </Text>
          </TouchableOpacity>
        </View>
        {status !== 'healthy' && enginePlayer && (
          <Text style={styles.injuryNote}>
            Absence costs {INJURY_DEGRADATION[enginePlayer.pos].label.replace(/^-/, '')}{status === 'questionable' ? ' (half, questionable)' : ''} in every simulation this team runs.
          </Text>
        )}

        {(player.strengths.length > 0 || player.weaknesses.length > 0) && (
          <Section icon="podium" title="Strengths & weaknesses" subtitle="Percentile against every FBS player at this position">
            {player.strengths.map((t) => <Trait key={`s-${t.label}`} trait={t} good />)}
            {player.weaknesses.map((t) => <Trait key={`w-${t.label}`} trait={t} />)}
            {player.strengths.length === 0 && <Text style={styles.small}>No standout strengths in the current sample.</Text>}
          </Section>
        )}

        {opp && next && (
          <Section
            icon="git-compare"
            title={`Next: ${next.home ? 'vs' : next.neutral ? 'vs' : 'at'} ${opp.school}`}
            subtitle={`Week ${next.week} · ${new Date(next.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}${opp.record ? ` · ${opp.record}` : ''}`}
          >
            {angles.map((a) => (
              <View key={a.label} style={styles.angle}>
                <View style={styles.angleHead}>
                  <Text style={styles.angleLabel}>{a.label} <Text style={styles.angleVs}>vs {a.against}</Text></Text>
                  <Text style={[styles.angleEdge, { color: a.edge > 0.4 ? colors.positive : a.edge < -0.4 ? colors.negative : colors.inkFaint }]}>
                    {a.edge > 0.4 ? 'Edge' : a.edge < -0.4 ? 'Tough' : 'Even'} {a.edge >= 0 ? '+' : ''}{a.edge.toFixed(1)}
                  </Text>
                </View>
                <View style={styles.angleTrack}><View style={[styles.angleFill, { width: `${Math.min(100, Math.max(0, a.oppRating * 10))}%`, backgroundColor: ratingColor(a.oppRating) }]} /></View>
                <Text style={styles.angleNote}>{a.note} Opponent rates {a.oppRating}/10 there.</Text>
              </View>
            ))}
          </Section>
        )}

        {props.length > 0 && (ent.ent.props ? (
          <Section
            icon="speedometer"
            title="Prop projections"
            subtitle={next ? `Next: ${next.home ? 'vs' : 'at'} ${next.oppName}${projectedPoints ? ` · model has the offence at ${projectedPoints.toFixed(0)}` : ''}` : 'Per-game rates'}
          >
            {props.map((pr) => (
              <View key={pr.key} style={styles.propRow}>
                <Text style={styles.propLabel}>{pr.label}</Text>
                <View style={styles.propRight}>
                  <Text style={styles.propValue}>{pr.projection}</Text>
                  <Text style={styles.propRange}>{pr.low}–{pr.high}</Text>
                </View>
              </View>
            ))}
            <Text style={styles.propFoot}>
              Projection with a one-standard-deviation range. Ranges matter more than the middle number: a line inside
              the range is close to a coin flip. Basis: {props[0].basis}.
            </Text>
          </Section>
        ) : (
          <Locked
            title="Prop projections"
            blurb="A projection and a range for every counting stat this player produces, scaled to the game the model is projecting."
            cta="Unlock props"
            onPress={onUpgrade ?? (() => {})}
            style={{ height: 158, marginBottom: 16 }}
          />
        ))}

        <Section icon="stats-chart" title={`${file?.season ?? ''} season`} subtitle={player.season.games ? `${player.season.games} game${player.season.games === 1 ? '' : 's'} played` : 'No game action yet this season'}>
          {player.season.games ? (
            <View style={styles.totals}>
              {cols.map((c) => (
                <View key={c.key} style={styles.total}>
                  <Text style={styles.totalValue}>{fmt(player.season, c.key)}</Text>
                  <Text style={styles.totalLabel}>{c.label}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.small}>He has not recorded a tracked play this season. Grades fall back to his roster listing until he does.</Text>
          )}
          {!!player.prior && (
            <Text style={styles.small}>
              Last season ({player.prior.games} g): {cols.map((c) => `${fmt(player.prior!, c.key)} ${c.label}`).join(' · ')}
            </Text>
          )}
          {!!player.statLine && <Text style={styles.small}>{player.statLine}</Text>}
        </Section>

        {played.length > 0 && (
          <Section icon="calendar" title="Game by game" subtitle="Most recent first">
            <View style={styles.logHead}>
              <Text style={[styles.logCell, styles.logOpp]}>Opponent</Text>
              {cols.map((c) => <Text key={c.key} style={styles.logCell}>{c.label}</Text>)}
            </View>
            {played.map((g) => (
              <View key={g.gameId} style={styles.logRow}>
                <View style={styles.logOpp}>
                  <Text style={styles.logOppText} numberOfLines={1}>{g.home ? 'vs' : 'at'} {g.oppName}</Text>
                  <Text style={styles.logResult}>
                    {g.result ? <Text style={{ color: g.result === 'W' ? colors.positive : colors.negative, fontWeight: '900' }}>{g.result} </Text> : null}
                    {g.teamScore !== null && g.oppScore !== null ? `${g.teamScore}–${g.oppScore}` : `Wk ${g.week}`}
                  </Text>
                </View>
                {cols.map((c) => <Text key={c.key} style={styles.logCell}>{fmt(g.stats, c.key)}</Text>)}
              </View>
            ))}
          </Section>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const fmt = (line: StatLine, key: keyof StatLine) => {
  const v = stat(line, key);
  return key === 'epa' || key === 'sacks' ? (Math.round(v * 10) / 10).toString() : String(Math.round(v));
};

function Pill({ label, gold }: { label: string; gold?: boolean }) {
  return <View style={[styles.pill, gold && { backgroundColor: colors.goldSoft, borderColor: colors.gold }]}><Text style={[styles.pillText, gold && { color: colors.gold }]}>{label}</Text></View>;
}

function Trait({ trait, good }: { trait: { label: string; value: string; percentile: number }; good?: boolean }) {
  const c = good ? colors.positive : colors.negative;
  return (
    <View style={styles.trait}>
      <Ionicons name={good ? 'arrow-up-circle' : 'arrow-down-circle'} size={16} color={c} />
      <View style={{ flex: 1 }}>
        <Text style={styles.traitLabel}>{trait.label}</Text>
        <Text style={styles.traitValue}>{trait.value}</Text>
      </View>
      <View style={styles.traitPct}>
        <Text style={[styles.traitPctText, { color: c }]}>{trait.percentile}</Text>
        <Text style={styles.traitPctLabel}>pctl</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  propRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.divider },
  propLabel: { color: colors.inkDim, fontSize: 13, fontWeight: '700' },
  propRight: { alignItems: 'flex-end' },
  propValue: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  propRange: { color: colors.inkFaint, fontSize: 10, fontWeight: '700', marginTop: 1 },
  propFoot: { color: colors.inkGhost, fontSize: 10, lineHeight: 15, marginTop: 10 },
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  empty: { color: colors.inkFaint, fontSize: 13, padding: spacing.lg },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md, ...shadow.card },
  heroName: { color: colors.ink, fontWeight: '900', fontSize: 19 },
  teamLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  teamLinkText: { color: colors.inkDim, fontSize: 12, fontWeight: '700' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  pillText: { color: colors.inkDim, fontSize: 10, fontWeight: '800' },
  hometown: { color: colors.inkFaint, fontSize: 11, marginTop: 6 },
  statusRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statusCard: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, alignItems: 'center' },
  statusLabel: { color: colors.inkFaint, fontSize: 9, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  statusValue: { color: colors.ink, fontSize: 15, fontWeight: '900', marginTop: 4, textAlign: 'center' },
  statusSub: { color: colors.inkFaint, fontSize: 9, marginTop: 3, textAlign: 'center' },
  injuryNote: { color: colors.warning, fontSize: 11, fontWeight: '700', marginBottom: spacing.md, textAlign: 'center' },
  small: { color: colors.inkFaint, fontSize: 11, lineHeight: 16, marginTop: spacing.sm },
  trait: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.divider },
  traitLabel: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  traitValue: { color: colors.inkFaint, fontSize: 11, marginTop: 1 },
  traitPct: { alignItems: 'center', width: 36 },
  traitPctText: { fontSize: 15, fontWeight: '900' },
  traitPctLabel: { color: colors.inkFaint, fontSize: 8, fontWeight: '800', textTransform: 'uppercase' },
  angle: { marginBottom: spacing.md },
  angleHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  angleLabel: { color: colors.ink, fontSize: 13, fontWeight: '800', flex: 1 },
  angleVs: { color: colors.inkFaint, fontSize: 11, fontWeight: '600' },
  angleEdge: { fontSize: 11, fontWeight: '900' },
  angleTrack: { height: 7, borderRadius: radius.pill, backgroundColor: colors.cardAlt, overflow: 'hidden' },
  angleFill: { height: '100%', borderRadius: radius.pill },
  angleNote: { color: colors.inkFaint, fontSize: 10, marginTop: 4, lineHeight: 14 },
  totals: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  total: { flexGrow: 1, minWidth: 56, backgroundColor: colors.cardAlt, borderRadius: radius.md, paddingVertical: 8, alignItems: 'center' },
  totalValue: { color: colors.gold, fontSize: 17, fontWeight: '900' },
  totalLabel: { color: colors.inkFaint, fontSize: 9, fontWeight: '800', letterSpacing: 0.5, marginTop: 2 },
  logHead: { flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  logRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.divider },
  logOpp: { flex: 2.2 },
  logOppText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  logResult: { color: colors.inkFaint, fontSize: 10, marginTop: 1 },
  logCell: { flex: 1, color: colors.inkDim, fontSize: 12, fontWeight: '700', textAlign: 'right' },
});

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, shadow, sideColor, spacing } from '@/theme';
import { spreadText, oneDp } from '@/utils/format';
import { useSettings } from '@/context/SettingsContext';
import { useTeams } from '@/context/TeamsContext';
import { RunRequest, useAnalysis } from '@/hooks/useAnalysis';
import { TeamMark } from '@/components/TeamMark';
import { ProbBar } from '@/components/ProbBar';
import { MatrixRow } from '@/components/MatrixRow';
import { Histogram } from '@/components/Histogram';
import { Section } from '@/components/Section';
import { NodeCard } from '@/components/NodeCard';
import { SleeperCard } from '@/components/SleeperCard';
import { ScreenHeader } from '@/components/ScreenHeader';

interface Props { request: RunRequest; onBack: () => void; onOpenTeam: (id: string) => void; }

export function ResultScreen({ request, onBack, onOpenTeam }: Props) {
  const { pushRecent } = useSettings();
  const { findGame } = useTeams();
  const [reroll, setReroll] = useState(0);
  const a = useAnalysis(request, reroll);
  const game = findGame(request.awayId, request.homeId);
  const { home, away, simulation: s, matrix, script, sleepers, injuries, nodes } = a;

  useEffect(() => { pushRecent({ awayId: request.awayId, homeId: request.homeId }); }, [request.awayId, request.homeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fav = s.homeWinPct >= s.awayWinPct ? home : away;
  const favPct = Math.max(s.homeWinPct, s.awayWinPct);
  const favColor = fav === home ? colors.home : colors.away;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader
        title={`${away.abbr} @ ${home.abbr}`}
        subtitle={`${s.runs.toLocaleString()} simulations · seed ${a.seed.toString(16).slice(0, 6)}`}
        onBack={onBack}
        right={(
          <TouchableOpacity style={styles.reroll} onPress={() => setReroll((r) => r + 1)} hitSlop={6}>
            <Ionicons name="dice" size={16} color={colors.ink} />
            <Text style={styles.rerollText}>Re-roll</Text>
          </TouchableOpacity>
        )}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 1. Win probability & score metric */}
        <View style={styles.hero}>
          <View style={styles.heroTeams}>
            <TouchableOpacity style={styles.heroTeam} onPress={() => onOpenTeam(away.id)}>
              <TeamMark team={away} size={56} />
              <Text style={styles.heroScore}>{oneDp(s.projectedAway)}</Text>
              <Text style={styles.heroName} numberOfLines={1}>{away.rank ? `#${away.rank} ` : ''}{away.school}</Text>
            </TouchableOpacity>
            <View style={styles.heroMid}>
              <Text style={[styles.heroPct, { color: favColor }]}>{favPct.toFixed(1)}%</Text>
              <Text style={styles.heroPctLabel}>{fav.abbr} win prob.</Text>
            </View>
            <TouchableOpacity style={styles.heroTeam} onPress={() => onOpenTeam(home.id)}>
              <TeamMark team={home} size={56} />
              <Text style={styles.heroScore}>{oneDp(s.projectedHome)}</Text>
              <Text style={styles.heroName} numberOfLines={1}>{home.rank ? `#${home.rank} ` : ''}{home.school}</Text>
            </TouchableOpacity>
          </View>
          <ProbBar awayPct={s.awayWinPct} homePct={s.homeWinPct} awayAbbr={away.abbr} homeAbbr={home.abbr} />
          <View style={styles.lines}>
            <Line label="Spread" value={spreadText(s.spread < 0 ? home.abbr : away.abbr, s.spread)} sub={`${home.abbr} covers ${s.homeCoverPct}%`} />
            <Line label="Total" value={oneDp(s.projectedTotal)} sub={`Over hits ${s.overPct}%`} />
            <Line label="One-score" value={`${s.oneScoreGamePct}%`} sub={`σ ${s.volatility} · OT ${s.overtimePct}%`} />
          </View>
          {game && game.homeSpread !== null && (
            <View style={styles.marketRow}>
              <Ionicons name="pricetag" size={13} color={colors.gold} />
              <Text style={styles.marketText}>
                Market{game.lineSource ? ` (${game.lineSource})` : ''}: {Math.abs(game.homeSpread) < 0.25 ? 'PK' : `${game.homeSpread <= 0 ? home.abbr : away.abbr} -${Math.abs(game.homeSpread)}`}
                {game.totalLine !== null ? ` · O/U ${game.totalLine}` : ''}
                {' · '}model {s.spread - game.homeSpread < 0 ? home.abbr : away.abbr} +{Math.abs(s.spread - game.homeSpread).toFixed(1)} vs the line
                {game.totalLine !== null ? ` · total ${s.projectedTotal - game.totalLine >= 0 ? '+' : ''}${(s.projectedTotal - game.totalLine).toFixed(1)}` : ''}
              </Text>
            </View>
          )}
        </View>

        {/* 2. Advantage matrix */}
        <Section icon="grid" title="Advantage Matrix" subtitle="1-10 · adjusted for the opponent it faces">
          <View style={styles.matrixHead}>
            <Text style={[styles.matrixTeam, { color: colors.away }]}>{away.abbr}</Text>
            <Text style={[styles.matrixTeam, { color: colors.home }]}>{home.abbr}</Text>
          </View>
          <MatrixRow label="Passing" away={matrix.passing.away} home={matrix.passing.home} />
          <MatrixRow label="Rushing" away={matrix.rushing.away} home={matrix.rushing.home} />
          <MatrixRow label="Trenches" away={matrix.trench.away} home={matrix.trench.home} />
          <MatrixRow label="Coaching" away={matrix.coaching.away} home={matrix.coaching.home} />
        </Section>

        {/* Weighted nodes */}
        <Section icon="git-network" title="Weighted Nodes" subtitle={`Model margin ${a.modelMargin > 0 ? home.abbr : away.abbr} +${Math.abs(a.modelMargin).toFixed(1)} before simulation`}>
          {nodes.map((n) => <NodeCard key={n.key} node={n} awayAbbr={away.abbr} homeAbbr={home.abbr} />)}
        </Section>

        {/* 3. Simulation narrative */}
        <Section icon="film" title={`${s.runs.toLocaleString()}-Run Simulation Narrative`} subtitle={`${home.abbr} leads at half ${script.homeLeadsAtHalfPct}% · within one score in Q4 ${script.clutchPct}%`}>
          <Act n="1" title="Early game script" text={script.early} />
          <Act n="2" title="Halftime scheme shifts" text={script.halftime} />
          <Act n="3" title="Late-game clutch factor" text={script.late} />
          <View style={styles.keys}>
            {script.keys.map((k) => (
              <View key={k} style={styles.keyRow}>
                <Ionicons name="flash" size={12} color={colors.gold} />
                <Text style={styles.keyText}>{k}</Text>
              </View>
            ))}
          </View>
        </Section>

        {/* 4. Sleepers */}
        <Section icon="eye" title="X-Factor / Sleeper Report" subtitle="Depth & rotational players who move the spread">
          {sleepers.length === 0 && <Text style={styles.empty}>No sleeper clears the threshold in this matchup.</Text>}
          {sleepers.map((sl) => <SleeperCard key={sl.player.id} sleeper={sl} abbr={sl.team === 'home' ? home.abbr : away.abbr} />)}
        </Section>

        {/* Injuries */}
        <Section icon="medkit" title="Injury Degradation" subtitle={injuries.length ? `${injuries.length} flagged` : 'Both depth charts healthy'}>
          {injuries.length === 0 && <Text style={styles.empty}>Flag players Out / Questionable from a team page to see the win-efficiency hit.</Text>}
          {injuries.map((i) => (
            <View key={i.player.id} style={styles.injRow}>
              <View style={[styles.injDot, { backgroundColor: sideColor(i.team) }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.injName}>{i.player.name} <Text style={styles.injPos}>{i.player.pos} · {i.team === 'home' ? home.abbr : away.abbr} · {i.status.toUpperCase()}</Text></Text>
                <Text style={styles.injMetric}>{i.player.reportNote ? `${i.player.reportNote} · ` : ''}{i.metric}</Text>
              </View>
              <Text style={[styles.injPts, { color: colors.negative }]}>−{i.pointsLost.toFixed(1)} pts</Text>
            </View>
          ))}
        </Section>

        {/* Distribution */}
        <Section icon="stats-chart" title="Margin Distribution" subtitle={`Where the ${s.runs.toLocaleString()} finals landed · 5-point bins`}>
          <Histogram bins={s.marginBins} awayAbbr={away.abbr} homeAbbr={home.abbr} />
          <View style={styles.scores}>
            {s.mostLikelyScores.map((sc) => (
              <View key={`${sc.home}-${sc.away}`} style={styles.scoreChip}>
                <Text style={styles.scoreText}>{away.abbr} {sc.away} – {home.abbr} {sc.home}</Text>
                <Text style={styles.scorePct}>{sc.pct}%</Text>
              </View>
            ))}
          </View>
        </Section>

        <Text style={styles.disclaimer}>
          Ratings and depth charts come from the live dataset (prior-season play-by-play blended with the current season as
          games are played, nudged toward each program's Elo; see Model → About the data). College availability reports are
          sparse, so check injuries yourself. Outputs are model projections for analysis and entertainment — not betting advice.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Line({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>{value}</Text>
      <Text style={styles.lineSub}>{sub}</Text>
    </View>
  );
}

function Act({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <View style={styles.act}>
      <View style={styles.actHead}>
        <View style={styles.actNum}><Text style={styles.actNumText}>{n}</Text></View>
        <Text style={styles.actTitle}>{title}</Text>
      </View>
      <Text style={styles.actText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  reroll: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  rerollText: { color: colors.ink, fontWeight: '800', fontSize: 12 },
  hero: { backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.lg, ...shadow.card },
  heroTeams: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  heroTeam: { flex: 1, alignItems: 'center', gap: 4 },
  heroScore: { color: colors.ink, fontSize: 34, fontWeight: '900', letterSpacing: -1, marginTop: 4 },
  heroName: { color: colors.inkFaint, fontSize: 12, fontWeight: '700' },
  heroMid: { alignItems: 'center', width: 110 },
  heroPct: { fontSize: 30, fontWeight: '900', letterSpacing: -1 },
  heroPctLabel: { color: colors.inkFaint, fontSize: 11, fontWeight: '700' },
  lines: { flexDirection: 'row', marginTop: spacing.lg, gap: spacing.sm },
  marketRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: spacing.md, paddingHorizontal: 4 },
  marketText: { color: colors.inkDim, fontSize: 12, fontWeight: '700', flex: 1, lineHeight: 17 },
  line: { flex: 1, backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  lineLabel: { color: colors.inkFaint, fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  lineValue: { color: colors.gold, fontSize: 18, fontWeight: '900', marginTop: 4 },
  lineSub: { color: colors.inkFaint, fontSize: 10, marginTop: 2, textAlign: 'center' },
  matrixHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm, paddingHorizontal: 4 },
  matrixTeam: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  act: { marginBottom: spacing.lg },
  actHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  actNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  actNumText: { color: colors.bg, fontWeight: '900', fontSize: 12 },
  actTitle: { color: colors.ink, fontWeight: '800', fontSize: 14 },
  actText: { color: colors.inkDim, fontSize: 13, lineHeight: 20 },
  keys: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, gap: 8 },
  keyRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  keyText: { color: colors.inkDim, fontSize: 12, lineHeight: 17, flex: 1 },
  empty: { color: colors.inkFaint, fontSize: 12, lineHeight: 17 },
  injRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider },
  injDot: { width: 8, height: 8, borderRadius: 4 },
  injName: { color: colors.ink, fontWeight: '800', fontSize: 13 },
  injPos: { color: colors.inkFaint, fontSize: 11, fontWeight: '700' },
  injMetric: { color: colors.inkDim, fontSize: 11, marginTop: 1 },
  injPts: { fontWeight: '900', fontSize: 13 },
  scores: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' },
  scoreChip: { flexGrow: 1, backgroundColor: colors.cardAlt, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center' },
  scoreText: { color: colors.ink, fontWeight: '800', fontSize: 12 },
  scorePct: { color: colors.gold, fontWeight: '900', fontSize: 11, marginTop: 2 },
  disclaimer: { color: colors.inkFaint, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.md },
});

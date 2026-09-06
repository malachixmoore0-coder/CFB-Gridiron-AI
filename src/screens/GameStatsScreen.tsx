import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTeams } from '@/context/TeamsContext';
import { useRoster } from '@/hooks/useRoster';
import { colors, radius, shadow, spacing } from '@/theme';
import type { BoxCategory, BoxTotals } from '@/utils/roster';
import { boxScore, headshotOf, stat } from '@/utils/roster';
import type { RosterPlayer, StatLine, TeamRosterFile, TeamScheduleGame } from '@/data/liveTypes';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { TeamMark } from '@/components/TeamMark';
import { Section } from '@/components/Section';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Chip } from '@/components/Chip';
import type { RunRequest } from '@/hooks/useAnalysis';

interface Props {
  teamId: string;
  gameId: string;
  onBack: () => void;
  onOpenPlayer: (teamId: string, playerId: string) => void;
  onOpenTeam: (teamId: string) => void;
  onRun: (req: RunRequest) => void;
}

/**
 * Box score for one game, built from the per-game lines in each team's roster
 * file — so it shows the same numbers that produced the player grades.
 */
export function GameStatsScreen({ teamId, gameId, onBack, onOpenPlayer, onOpenTeam, onRun }: Props) {
  const { getTeam, hasTeam, records } = useTeams();
  const team = getTeam(teamId);
  const { roster: file, loading } = useRoster(teamId);
  const game = file?.schedule.find((g) => g.id === gameId) ?? null;
  const oppId = game?.oppId && hasTeam(game.oppId) ? game.oppId : null;
  // Always call the hook; an empty id simply never resolves.
  const { roster: oppFile, loading: oppLoading } = useRoster(oppId ?? teamId);
  const opp = oppId ? getTeam(oppId) : null;
  const [side, setSide] = useState<'own' | 'opp'>('own');

  const own = useMemo(() => (file ? boxScore(file.roster, gameId) : null), [file, gameId]);
  const other = useMemo(() => (oppId && oppFile && oppFile.teamId === oppId ? boxScore(oppFile.roster, gameId) : null), [oppFile, oppId, gameId]);
  const prediction = records.find((r) => r.id === gameId);

  if (!game) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <ScreenHeader title="Game" onBack={onBack} />
        <View style={styles.center}>
          {loading ? <ActivityIndicator color={colors.gold} /> : <Text style={styles.empty}>This game is not on the published schedule.</Text>}
        </View>
      </SafeAreaView>
    );
  }

  const played = game.status === 'final';
  const oppName = opp ? `${opp.school}` : game.oppName;
  const showing = side === 'own' || !other ? own : other;
  const showingTeam = side === 'own' || !other ? team : opp!;
  const showingFile = side === 'own' || !other ? file : oppFile;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader
        title={`${game.home ? 'vs' : game.neutral ? 'vs' : 'at'} ${oppName}`}
        subtitle={`${game.gameType === 'regular' ? `Week ${game.week}` : 'Postseason'} · ${new Date(game.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}${game.notes ? ` · ${game.notes}` : ''}`}
        onBack={onBack}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <TouchableOpacity style={styles.heroTeam} activeOpacity={0.8} onPress={() => onOpenTeam(team.id)}>
            <TeamMark team={team} size={48} />
            <Text style={styles.heroAbbr}>{team.abbr}</Text>
          </TouchableOpacity>
          <View style={styles.heroMid}>
            {played ? (
              <>
                <Text style={styles.heroScore}>{game.teamScore} – {game.oppScore}</Text>
                <Text style={[styles.heroResult, { color: game.result === 'W' ? colors.positive : colors.negative }]}>
                  {game.result === 'W' ? 'Win' : 'Loss'}{game.home ? '' : game.neutral ? ' · neutral' : ' · away'}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.heroUpcoming}>{new Date(game.date).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</Text>
                <Text style={styles.heroResult}>Not played yet</Text>
              </>
            )}
          </View>
          {opp ? (
            <TouchableOpacity style={styles.heroTeam} activeOpacity={0.8} onPress={() => onOpenTeam(opp.id)}>
              <TeamMark team={opp} size={48} />
              <Text style={styles.heroAbbr}>{opp.abbr}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.heroTeam}><View style={styles.oppBlank}><Text style={styles.oppBlankText}>{game.oppName.slice(0, 3).toUpperCase()}</Text></View><Text style={styles.heroAbbr} numberOfLines={1}>{game.oppName}</Text></View>
          )}
        </View>

        {!played && (
          <TouchableOpacity style={styles.run} activeOpacity={0.85} onPress={() => onRun({ awayId: game.home ? (oppId ?? team.id) : team.id, homeId: game.home ? team.id : (oppId ?? team.id), ctx: { neutralSite: game.neutral, primetime: false, weather: 'auto' } })}>
            <Ionicons name="analytics" size={18} color={colors.bg} />
            <Text style={styles.runText}>Simulate this matchup</Text>
          </TouchableOpacity>
        )}

        {played && prediction?.result && (
          <View style={styles.verdict}>
            <Ionicons name={prediction.result.suCorrect ? 'checkmark-circle' : 'close-circle'} size={16} color={prediction.result.suCorrect ? colors.positive : colors.negative} />
            <Text style={styles.verdictText}>
              Model had {prediction.homeWinPct >= 50 ? 'the home side' : 'the road side'} at {Math.max(prediction.homeWinPct, prediction.awayWinPct).toFixed(1)}% and {prediction.result.suCorrect ? 'called it' : 'missed'}
              {prediction.result.ats ? ` · against the spread ${prediction.result.ats}` : ''} · projected {prediction.total.toFixed(1)}, actual {(game.teamScore ?? 0) + (game.oppScore ?? 0)}
            </Text>
          </View>
        )}

        {played && own && other && (
          <Section icon="stats-chart" title="Team totals" subtitle="Summed from the players who recorded a play">
            <View style={styles.totalsHead}>
              <Text style={[styles.totalsCell, styles.totalsLabel]} />
              <Text style={[styles.totalsCell, { color: colors.home }]}>{team.abbr}</Text>
              <Text style={[styles.totalsCell, { color: colors.away }]}>{opp!.abbr}</Text>
            </View>
            <TotalRow label="Passing yards" a={own.totals.passYds} b={other.totals.passYds} />
            <TotalRow label="Rushing yards" a={own.totals.rushYds} b={other.totals.rushYds} />
            <TotalRow label="Passing TDs" a={own.totals.passTd} b={other.totals.passTd} />
            <TotalRow label="Rushing TDs" a={own.totals.rushTd} b={other.totals.rushTd} />
            <TotalRow label="Sacks" a={own.totals.sacks} b={other.totals.sacks} />
            <TotalRow label="Takeaways" a={own.totals.takeaways} b={other.totals.takeaways} />
            <TotalRow label="Interceptions thrown" a={own.totals.turnovers} b={other.totals.turnovers} invert />
            <TotalRow label="Plays from scrimmage" a={own.totals.plays} b={other.totals.plays} />
          </Section>
        )}

        {played && other && (
          <View style={styles.sideTabs}>
            <Chip label={team.abbr} active={side === 'own'} onPress={() => setSide('own')} small />
            <Chip label={opp!.abbr} active={side === 'opp'} onPress={() => setSide('opp')} small />
          </View>
        )}

        {played && (oppLoading || loading) && !showing && (
          <View style={styles.center}><ActivityIndicator color={colors.gold} /><Text style={styles.empty}>Loading box score…</Text></View>
        )}

        {played && showing && showing.categories.length === 0 && (
          <Text style={styles.empty}>
            No player stats on file for {showingTeam.abbr} in this game. Play-by-play for a finished game usually lands within a few hours of the whistle.
          </Text>
        )}

        {played && showing?.categories.map((c) => (
          <Section key={c.key} icon={iconFor(c.key)} title={`${showingTeam.abbr} ${c.title.toLowerCase()}`} subtitle={`${c.lines.length} player${c.lines.length === 1 ? '' : 's'}`}>
            <View style={styles.tableHead}>
              <Text style={[styles.cell, styles.nameCell]}>Player</Text>
              {c.columns.map((col) => <Text key={col.key} style={styles.cell}>{col.label}</Text>)}
            </View>
            {c.lines.map((l) => (
              <TouchableOpacity key={l.player.id} style={styles.row} activeOpacity={0.75} onPress={() => onOpenPlayer(showingTeam.id, l.player.id)}>
                <View style={styles.nameCell}>
                  <PlayerAvatar uri={headshotOf(l.player, showingFile, 28)} name={l.player.name} team={showingTeam} size={28} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>{l.player.jersey ? `#${l.player.jersey} ` : ''}{l.player.name}</Text>
                    <Text style={styles.pos}>{l.player.listedPos || l.player.pos}</Text>
                  </View>
                </View>
                {c.columns.map((col) => <Text key={col.key} style={styles.cell}>{fmt(l.stats, col.key)}</Text>)}
              </TouchableOpacity>
            ))}
          </Section>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const iconFor = (k: BoxCategory['key']): keyof typeof Ionicons.glyphMap =>
  k === 'passing' ? 'american-football' : k === 'rushing' ? 'walk' : k === 'receiving' ? 'hand-left' : k === 'defense' ? 'shield-checkmark' : 'football';

const fmt = (line: StatLine, key: keyof StatLine) => {
  const v = stat(line, key);
  return key === 'sacks' || key === 'epa' ? (Math.round(v * 10) / 10).toString() : String(Math.round(v));
};

function TotalRow({ label, a, b, invert }: { label: string; a: number; b: number; invert?: boolean }) {
  const aBetter = invert ? a < b : a > b;
  const bBetter = invert ? b < a : b > a;
  return (
    <View style={styles.totalsRow}>
      <Text style={[styles.totalsCell, styles.totalsLabel]}>{label}</Text>
      <Text style={[styles.totalsCell, aBetter && styles.totalsWin]}>{Math.round(a)}</Text>
      <Text style={[styles.totalsCell, bBetter && styles.totalsWin]}>{Math.round(b)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  center: { alignItems: 'center', gap: 8, paddingVertical: spacing.xl },
  empty: { color: colors.inkFaint, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md, ...shadow.card },
  heroTeam: { alignItems: 'center', gap: 6, width: 84 },
  heroAbbr: { color: colors.ink, fontWeight: '900', fontSize: 12 },
  oppBlank: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  oppBlankText: { color: colors.inkDim, fontWeight: '900', fontSize: 13 },
  heroMid: { flex: 1, alignItems: 'center' },
  heroScore: { color: colors.ink, fontSize: 30, fontWeight: '900', letterSpacing: -1 },
  heroUpcoming: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  heroResult: { color: colors.inkFaint, fontSize: 11, fontWeight: '800', marginTop: 3 },
  run: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.gold, borderRadius: radius.lg, paddingVertical: 14, marginBottom: spacing.md },
  runText: { color: colors.bg, fontWeight: '900', fontSize: 15 },
  verdict: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  verdictText: { color: colors.inkDim, fontSize: 11, lineHeight: 16, flex: 1 },
  totalsHead: { flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  totalsRow: { flexDirection: 'row', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.divider },
  totalsCell: { flex: 1, color: colors.inkDim, fontSize: 12, fontWeight: '800', textAlign: 'right' },
  totalsLabel: { flex: 2.4, textAlign: 'left', fontWeight: '700', color: colors.inkFaint },
  totalsWin: { color: colors.ink, fontWeight: '900' },
  sideTabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  tableHead: { flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.divider },
  nameCell: { flex: 2.6, flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  pos: { color: colors.inkFaint, fontSize: 10, marginTop: 1 },
  cell: { flex: 1, color: colors.inkDim, fontSize: 12, fontWeight: '700', textAlign: 'right' },
});

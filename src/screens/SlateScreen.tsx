import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { analyzeMatchup, POWER_CONFERENCES } from '@/engine';
import type { Conference } from '@/engine/types';
import { colors, radius, shadow, spacing } from '@/theme';
import { spreadText, oneDp } from '@/utils/format';
import { useSettings } from '@/context/SettingsContext';
import { useTeams } from '@/context/TeamsContext';
import { buildInput, RunRequest } from '@/hooks/useAnalysis';
import { TeamMark } from '@/components/TeamMark';
import { ProbBar } from '@/components/ProbBar';
import { ScreenHeader } from '@/components/ScreenHeader';
import { DataBanner } from '@/components/DataBanner';
import { Chip } from '@/components/Chip';
import { SAMPLE_SLATE } from '@/data/slate';
import { CONFERENCE_ORDER, CONFERENCE_SHORT } from '@/data/teams';

interface Props { onRun: (req: RunRequest) => void; }

type Filter = 'all' | 'ranked' | 'p4' | 'g5' | Conference;
const QUICK_RUNS = 1000;

/** This week's real FBS slate (from the live schedule), each game quick-simulated and compared with the market line. */
export function SlateScreen({ onRun }: Props) {
  const s = useSettings();
  const { getTeam, hasTeam, weekGames, week, season, phase, generatedAt, poll } = useTeams();
  const [filter, setFilter] = useState<Filter>('all');
  const ov = JSON.stringify(s.overrides);
  const w = JSON.stringify(s.weights);
  const usingSample = weekGames.length === 0;

  const rows = useMemo(() => {
    const games = usingSample
      ? SAMPLE_SLATE.filter((g) => hasTeam(g.awayId) && hasTeam(g.homeId)).map((g) => ({
          id: g.id, awayId: g.awayId, homeId: g.homeId, label: g.label, kickoff: null as string | null, timeTbd: false, neutralSite: !!g.neutralSite, primetime: !!g.primetime,
          weather: g.weather ?? null, homeSpread: null as number | null, totalLine: null as number | null, status: 'scheduled' as const, awayScore: null as number | null, homeScore: null as number | null,
          conferenceGame: false, broadcast: null as string | null, awayRank: null as number | null, homeRank: null as number | null,
        }))
      : weekGames.map((g) => ({
          id: g.id, awayId: g.awayId, homeId: g.homeId, label: g.notes ?? g.stadium, kickoff: g.kickoff, timeTbd: g.timeTbd, neutralSite: g.neutralSite, primetime: g.primetime,
          weather: g.weatherHint && g.weatherHint !== 'dome' ? g.weatherHint : null, homeSpread: g.homeSpread, totalLine: g.totalLine, status: g.status, awayScore: g.awayScore, homeScore: g.homeScore,
          conferenceGame: g.conferenceGame, broadcast: g.broadcast, awayRank: g.awayRank, homeRank: g.homeRank,
        }));
    return games.map((g) => {
      const req: RunRequest = { awayId: g.awayId, homeId: g.homeId, ctx: { neutralSite: g.neutralSite, primetime: g.primetime, weather: g.weather ?? 'auto' } };
      const a = analyzeMatchup(buildInput(req, getTeam(g.homeId), getTeam(g.awayId), s.overrides), { weights: s.weights, simulations: QUICK_RUNS, homeFieldBase: s.homeFieldBase });
      return { g, req, a };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ov, w, s.homeFieldBase, generatedAt, usingSample]);

  const visible = rows.filter(({ g }) => {
    if (filter === 'all') return true;
    const home = getTeam(g.homeId);
    const away = getTeam(g.awayId);
    if (filter === 'ranked') return !!(g.awayRank || g.homeRank || home.rank || away.rank);
    if (filter === 'p4') return POWER_CONFERENCES.includes(home.conference) || POWER_CONFERENCES.includes(away.conference) || home.conference === 'FBS Independents';
    if (filter === 'g5') return !POWER_CONFERENCES.includes(home.conference) && !POWER_CONFERENCES.includes(away.conference);
    return home.conference === filter || away.conference === filter;
  });
  const present = new Set(rows.flatMap(({ g }) => [getTeam(g.homeId).conference, getTeam(g.awayId).conference]));
  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: `All ${rows.length}` }, { key: 'ranked', label: 'Ranked' }, { key: 'p4', label: 'Power 4' }, { key: 'g5', label: 'Group of 5' },
    ...CONFERENCE_ORDER.filter((c) => present.has(c) && c !== 'FBS Independents').map((c) => ({ key: c as Filter, label: CONFERENCE_SHORT[c] })),
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader title={usingSample ? 'Slate' : `Week ${week} slate`} subtitle={usingSample ? `Sample marquee matchups · ${QUICK_RUNS.toLocaleString()} quick sims each` : `${season} ${phase} · model vs market · ${QUICK_RUNS.toLocaleString()} quick sims each`} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} style={styles.filterBar}>
        {filters.map((f) => <Chip key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} small />)}
      </ScrollView>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <DataBanner compact />
        {visible.length === 0 && <Text style={styles.note}>No games match this filter.</Text>}
        {visible.map(({ g, req, a }) => {
          const away = getTeam(g.awayId);
          const home = getTeam(g.homeId);
          const sim = a.simulation;
          const modelFavAbbr = sim.spread < 0 ? home.abbr : away.abbr;
          const marketFavAbbr = g.homeSpread !== null ? (g.homeSpread <= 0 ? home.abbr : away.abbr) : null;
          const marketLine = g.homeSpread !== null ? Math.abs(g.homeSpread) : null;
          // Edge = how many points the model disagrees with the market on the home line.
          const edge = g.homeSpread !== null ? sim.spread - g.homeSpread : null;
          const awayRank = g.awayRank ?? away.rank;
          const homeRank = g.homeRank ?? home.rank;
          const when = g.kickoff
            ? g.timeTbd ? new Date(g.kickoff).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + ' · TBA' : new Date(g.kickoff).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })
            : g.label;
          const tags = [g.broadcast, g.primetime ? 'Primetime' : null, g.weather ? g.weather[0].toUpperCase() + g.weather.slice(1) : null, g.neutralSite ? 'Neutral' : g.conferenceGame ? CONFERENCE_SHORT[home.conference] : null].filter(Boolean).join(' · ');
          return (
            <TouchableOpacity key={g.id} style={styles.card} activeOpacity={0.8} onPress={() => onRun(req)}>
              <View style={styles.top}>
                <View style={styles.team}><TeamMark team={away} size={36} /><Text style={styles.abbr} numberOfLines={1}>{awayRank ? `#${awayRank} ` : ''}{away.abbr}</Text>{!!away.record && <Text style={styles.rec}>{away.record}</Text>}</View>
                <View style={styles.mid}>
                  <Text style={styles.label} numberOfLines={1}>{when}</Text>
                  <Text style={styles.tags} numberOfLines={1}>{tags || g.label}</Text>
                  {g.status === 'final' && <Text style={styles.final}>Final {g.awayScore}–{g.homeScore}</Text>}
                </View>
                <View style={styles.team}><TeamMark team={home} size={36} /><Text style={styles.abbr} numberOfLines={1}>{homeRank ? `#${homeRank} ` : ''}{home.abbr}</Text>{!!home.record && <Text style={styles.rec}>{home.record}</Text>}</View>
              </View>
              <ProbBar awayPct={sim.awayWinPct} homePct={sim.homeWinPct} awayAbbr={away.abbr} homeAbbr={home.abbr} height={10} />
              <View style={styles.bottom}>
                <Text style={styles.stat}><Text style={styles.statKey}>Model </Text>{spreadText(modelFavAbbr, sim.spread)} · {oneDp(sim.projectedTotal)}</Text>
                {marketFavAbbr && marketLine !== null && (
                  <Text style={styles.stat}><Text style={styles.statKey}>Market </Text>{marketLine < 0.25 ? 'PK' : `${marketFavAbbr} -${marketLine}`}{g.totalLine !== null ? ` · ${g.totalLine}` : ''}</Text>
                )}
                {edge !== null && Math.abs(edge) >= 3 && (
                  <Text style={[styles.edge, { color: colors.gold }]}>{edge < 0 ? home.abbr : away.abbr} +{Math.abs(edge).toFixed(1)} vs mkt</Text>
                )}
                <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />
              </View>
            </TouchableOpacity>
          );
        })}
        <Text style={styles.note}>
          {usingSample
            ? 'No live schedule loaded — showing a curated sample board. Tap a game for the full 10,000-run breakdown.'
            : `Games against FCS opponents are not listed (no profile for the FCS side). ${poll ? `Ranks are the ${poll}. ` : ''}Lines are the last refresh's consensus where a book had one. "vs mkt" shows where the model disagrees by three points or more. Tap a game for the full 10,000-run breakdown.`}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  filterBar: { flexGrow: 0, flexShrink: 0, height: 44 },
  filters: { paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: 'center' },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md, ...shadow.card },
  top: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  team: { alignItems: 'center', gap: 2, width: 64 },
  abbr: { color: colors.ink, fontWeight: '900', fontSize: 12 },
  rec: { color: colors.inkFaint, fontSize: 10, fontWeight: '700' },
  mid: { flex: 1, alignItems: 'center' },
  label: { color: colors.ink, fontWeight: '800', fontSize: 13, textAlign: 'center' },
  tags: { color: colors.inkFaint, fontSize: 11, marginTop: 2, textAlign: 'center' },
  final: { color: colors.gold, fontSize: 11, fontWeight: '900', marginTop: 2 },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, gap: 6, flexWrap: 'wrap' },
  stat: { color: colors.ink, fontWeight: '800', fontSize: 12 },
  statKey: { color: colors.inkFaint, fontWeight: '700' },
  edge: { fontWeight: '900', fontSize: 11 },
  note: { color: colors.inkFaint, fontSize: 11, textAlign: 'center', lineHeight: 16, marginTop: spacing.sm },
});

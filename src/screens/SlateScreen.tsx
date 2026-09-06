import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { analyzeMatchup, POWER_CONFERENCES } from '@/engine';
import type { Conference } from '@/engine/types';
import type { GameStatus, LiveGame } from '@/data/liveTypes';
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
const WEEK_TAB_WIDTH = 92;

/** A game that kicked off but has no final score yet is treated as in progress. */
function effectiveStatus(g: { status: GameStatus; kickoff: string }, now: number): GameStatus {
  if (g.status === 'final') return 'final';
  if (g.status === 'in_progress') return 'in_progress';
  const kick = Date.parse(g.kickoff);
  // Games run about four hours; past that with no final on file, leave it scheduled
  // rather than claim it is still being played.
  return Number.isFinite(kick) && kick <= now && now - kick < 5 * 3_600_000 ? 'in_progress' : 'scheduled';
}

const SECTIONS: { key: GameStatus; title: string; icon: keyof typeof Ionicons.glyphMap; blurb: string }[] = [
  { key: 'in_progress', title: 'Playing now', icon: 'radio', blurb: 'Live scores refresh with the data feed' },
  { key: 'scheduled', title: 'Upcoming', icon: 'time', blurb: 'Model vs the market before kickoff' },
  { key: 'final', title: 'Final', icon: 'checkmark-done', blurb: 'How the model did' },
];

/** The season's slate, one tab per week, split into games playing now, still to come, and done. */
export function SlateScreen({ onRun }: Props) {
  const s = useSettings();
  const { getTeam, hasTeam, weeks, gamesForWeek, week, season, phase, generatedAt, poll, records } = useTeams();
  const [filter, setFilter] = useState<Filter>('all');
  const [now, setNow] = useState(() => Date.now());
  const weekBar = useRef<ScrollView>(null);

  // The current week is whichever the feed says, matched against the index.
  const currentIdx = Math.max(0, weeks.findIndex((w) => w.week === week && (phase === 'postseason' ? w.gameType !== 'regular' : w.gameType === 'regular')));
  const [tab, setTab] = useState(currentIdx);
  const selected = weeks[Math.min(tab, weeks.length - 1)];
  const usingSample = weeks.length === 0;

  // Follow the feed when a refresh moves the season on, unless the user has browsed elsewhere.
  const followed = useRef(currentIdx);
  useEffect(() => {
    if (currentIdx !== followed.current) {
      if (tab === followed.current) setTab(currentIdx);
      followed.current = currentIdx;
    }
  }, [currentIdx, tab]);

  // Keep the live/upcoming split honest without a data refresh.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    weekBar.current?.scrollTo({ x: Math.max(0, (tab - 1) * WEEK_TAB_WIDTH), animated: false });
  }, [tab]);

  const ov = JSON.stringify(s.overrides);
  const w = JSON.stringify(s.weights);
  const weekKey = selected ? `${selected.gameType}|${selected.week}` : 'sample';

  const rows = useMemo(() => {
    const games = usingSample
      ? SAMPLE_SLATE.filter((g) => hasTeam(g.awayId) && hasTeam(g.homeId)).map((g) => ({
          id: g.id, awayId: g.awayId, homeId: g.homeId, label: g.label, kickoff: '', timeTbd: false, neutralSite: !!g.neutralSite, primetime: !!g.primetime,
          weather: g.weather ?? null, homeSpread: null as number | null, totalLine: null as number | null, status: 'scheduled' as GameStatus, statusDetail: null as string | null,
          awayScore: null as number | null, homeScore: null as number | null, conferenceGame: false, broadcast: null as string | null, awayRank: null as number | null, homeRank: null as number | null,
        }))
      : gamesForWeek(selected.week, selected.gameType).map((g: LiveGame) => ({
          id: g.id, awayId: g.awayId, homeId: g.homeId, label: g.notes ?? g.stadium, kickoff: g.kickoff, timeTbd: g.timeTbd, neutralSite: g.neutralSite, primetime: g.primetime,
          weather: g.weatherHint && g.weatherHint !== 'dome' ? g.weatherHint : null, homeSpread: g.homeSpread, totalLine: g.totalLine, status: g.status, statusDetail: g.statusDetail ?? null,
          awayScore: g.awayScore, homeScore: g.homeScore, conferenceGame: g.conferenceGame, broadcast: g.broadcast, awayRank: g.awayRank, homeRank: g.homeRank,
        }));
    return games.map((g) => {
      const req: RunRequest = { awayId: g.awayId, homeId: g.homeId, ctx: { neutralSite: g.neutralSite, primetime: g.primetime, weather: g.weather ?? 'auto' } };
      const a = analyzeMatchup(buildInput(req, getTeam(g.homeId), getTeam(g.awayId), s.overrides), { weights: s.weights, simulations: QUICK_RUNS, homeFieldBase: s.homeFieldBase });
      return { g, req, a };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ov, w, s.homeFieldBase, generatedAt, usingSample, weekKey]);

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

  const byStatus = (st: GameStatus) => visible.filter(({ g }) => effectiveStatus(g, now) === st)
    .sort((a, b) => (st === 'final' ? b.g.kickoff.localeCompare(a.g.kickoff) : a.g.kickoff.localeCompare(b.g.kickoff)));
  const graded = new Map(records.map((r) => [r.id, r]));

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader
        title={usingSample ? 'Slate' : selected?.gameType === 'regular' ? `Week ${selected.week} slate` : 'Bowl slate'}
        subtitle={usingSample ? `Sample marquee matchups · ${QUICK_RUNS.toLocaleString()} quick sims each` : `${season} ${phase} · model vs market · ${QUICK_RUNS.toLocaleString()} quick sims each`}
      />
      {weeks.length > 1 && (
        <ScrollView ref={weekBar} horizontal showsHorizontalScrollIndicator={false} style={styles.weekBar} contentContainerStyle={styles.weekTabs}>
          {weeks.map((wk, i) => {
            const active = i === tab;
            const done = wk.games > 0 && wk.final === wk.games;
            return (
              <TouchableOpacity key={`${wk.gameType}-${wk.week}`} style={[styles.weekTab, active && styles.weekTabActive]} activeOpacity={0.8} onPress={() => setTab(i)}>
                <Text style={[styles.weekTabLabel, active && styles.weekTabLabelActive]} numberOfLines={1}>{wk.label}</Text>
                <Text style={[styles.weekTabMeta, active && styles.weekTabMetaActive]} numberOfLines={1}>
                  {wk.live > 0 ? `${wk.live} live` : done ? 'Final' : i === currentIdx ? 'This week' : `${wk.games} games`}
                </Text>
                {wk.live > 0 && <View style={styles.liveDot} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} style={styles.filterBar}>
        {filters.map((f) => <Chip key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} small />)}
      </ScrollView>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <DataBanner compact />
        {visible.length === 0 && <Text style={styles.note}>No games match this filter{weeks.length > 1 ? ' in this week' : ''}.</Text>}

        {SECTIONS.map((section) => {
          const list = byStatus(section.key);
          if (list.length === 0) return null;
          return (
            <View key={section.key}>
              <View style={styles.sectionHead}>
                <Ionicons name={section.icon} size={14} color={section.key === 'in_progress' ? colors.negative : colors.gold} />
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionCount}>{list.length}</Text>
                <Text style={styles.sectionBlurb} numberOfLines={1}>{section.blurb}</Text>
              </View>
              {list.map(({ g, req, a }) => {
                const away = getTeam(g.awayId);
                const home = getTeam(g.homeId);
                const sim = a.simulation;
                const st = effectiveStatus(g, now);
                const modelFavAbbr = sim.spread < 0 ? home.abbr : away.abbr;
                const marketFavAbbr = g.homeSpread !== null ? (g.homeSpread <= 0 ? home.abbr : away.abbr) : null;
                const marketLine = g.homeSpread !== null ? Math.abs(g.homeSpread) : null;
                const edge = g.homeSpread !== null ? sim.spread - g.homeSpread : null;
                const awayRank = g.awayRank ?? away.rank;
                const homeRank = g.homeRank ?? home.rank;
                const rec = graded.get(g.id);
                const when = g.kickoff
                  ? g.timeTbd
                    ? `${new Date(g.kickoff).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · TBA`
                    : new Date(g.kickoff).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })
                  : g.label;
                const tags = [g.broadcast, g.primetime ? 'Primetime' : null, g.weather ? g.weather[0].toUpperCase() + g.weather.slice(1) : null, g.neutralSite ? 'Neutral' : g.conferenceGame ? CONFERENCE_SHORT[home.conference] : null].filter(Boolean).join(' · ');
                return (
                  <TouchableOpacity key={g.id} style={[styles.card, st === 'in_progress' && styles.cardLive]} activeOpacity={0.8} onPress={() => onRun(req)}>
                    <View style={styles.top}>
                      <View style={styles.team}>
                        <TeamMark team={away} size={36} />
                        <Text style={styles.abbr} numberOfLines={1}>{awayRank ? `#${awayRank} ` : ''}{away.abbr}</Text>
                        {st === 'scheduled' ? !!away.record && <Text style={styles.rec}>{away.record}</Text> : <Text style={styles.score}>{g.awayScore ?? '–'}</Text>}
                      </View>
                      <View style={styles.mid}>
                        {st === 'in_progress' ? (
                          <View style={styles.liveRow}><View style={styles.liveDotSm} /><Text style={styles.liveText}>{g.statusDetail || 'In progress'}</Text></View>
                        ) : (
                          <Text style={styles.label} numberOfLines={1}>{st === 'final' ? 'Final' : when}</Text>
                        )}
                        <Text style={styles.tags} numberOfLines={1}>{st === 'final' ? when : tags || g.label}</Text>
                        {st === 'final' && rec?.result && (
                          <Text style={[styles.verdict, { color: rec.result.suCorrect ? colors.positive : colors.negative }]}>
                            Model {rec.result.suCorrect ? 'called it' : 'missed'}{rec.result.ats ? ` · ATS ${rec.result.ats === 'win' ? '✓' : rec.result.ats === 'push' ? 'P' : '✗'}` : ''}
                          </Text>
                        )}
                      </View>
                      <View style={styles.team}>
                        <TeamMark team={home} size={36} />
                        <Text style={styles.abbr} numberOfLines={1}>{homeRank ? `#${homeRank} ` : ''}{home.abbr}</Text>
                        {st === 'scheduled' ? !!home.record && <Text style={styles.rec}>{home.record}</Text> : <Text style={styles.score}>{g.homeScore ?? '–'}</Text>}
                      </View>
                    </View>
                    <ProbBar awayPct={sim.awayWinPct} homePct={sim.homeWinPct} awayAbbr={away.abbr} homeAbbr={home.abbr} height={10} />
                    <View style={styles.bottom}>
                      <Text style={styles.stat}><Text style={styles.statKey}>Model </Text>{spreadText(modelFavAbbr, sim.spread)} · {oneDp(sim.projectedTotal)}</Text>
                      {marketFavAbbr && marketLine !== null && (
                        <Text style={styles.stat}><Text style={styles.statKey}>Market </Text>{marketLine < 0.25 ? 'PK' : `${marketFavAbbr} -${marketLine}`}{g.totalLine !== null ? ` · ${g.totalLine}` : ''}</Text>
                      )}
                      {st === 'scheduled' && edge !== null && Math.abs(edge) >= 3 && (
                        <Text style={[styles.edge, { color: colors.gold }]}>{edge < 0 ? home.abbr : away.abbr} +{Math.abs(edge).toFixed(1)} vs mkt</Text>
                      )}
                      <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
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
  weekBar: { flexGrow: 0, flexShrink: 0, marginBottom: spacing.sm },
  weekTabs: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  weekTab: { width: WEEK_TAB_WIDTH - 8, paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  weekTabActive: { backgroundColor: colors.goldSoft, borderColor: colors.gold },
  weekTabLabel: { color: colors.inkDim, fontWeight: '900', fontSize: 12 },
  weekTabLabelActive: { color: colors.gold },
  weekTabMeta: { color: colors.inkFaint, fontSize: 9, fontWeight: '700', marginTop: 2 },
  weekTabMetaActive: { color: colors.inkDim },
  liveDot: { position: 'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.negative },
  filterBar: { flexGrow: 0, flexShrink: 0, height: 40 },
  filters: { paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: 'center' },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, marginBottom: spacing.sm },
  sectionTitle: { color: colors.ink, fontSize: 12, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  sectionCount: { color: colors.bg, backgroundColor: colors.inkFaint, fontSize: 10, fontWeight: '900', borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
  sectionBlurb: { color: colors.inkFaint, fontSize: 10, flex: 1, textAlign: 'right' },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md, ...shadow.card },
  cardLive: { borderColor: colors.negative },
  top: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  team: { alignItems: 'center', gap: 2, width: 64 },
  abbr: { color: colors.ink, fontWeight: '900', fontSize: 12 },
  rec: { color: colors.inkFaint, fontSize: 10, fontWeight: '700' },
  score: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  mid: { flex: 1, alignItems: 'center' },
  label: { color: colors.ink, fontWeight: '800', fontSize: 13, textAlign: 'center' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDotSm: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.negative },
  liveText: { color: colors.negative, fontWeight: '900', fontSize: 12 },
  tags: { color: colors.inkFaint, fontSize: 11, marginTop: 2, textAlign: 'center' },
  verdict: { fontSize: 10, fontWeight: '900', marginTop: 3 },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, gap: 6, flexWrap: 'wrap' },
  stat: { color: colors.ink, fontWeight: '800', fontSize: 12 },
  statKey: { color: colors.inkFaint, fontWeight: '700' },
  edge: { fontWeight: '900', fontSize: 11 },
  note: { color: colors.inkFaint, fontSize: 11, textAlign: 'center', lineHeight: 16, marginTop: spacing.sm },
});

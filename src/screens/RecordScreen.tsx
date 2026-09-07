import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, shadow, spacing } from '@/theme';
import { useTeams } from '@/context/TeamsContext';
import type { PredictionRecord } from '@/data/liveTypes';
import type { RunRequest } from '@/hooks/useAnalysis';
import { TeamMark } from '@/components/TeamMark';
import { ScreenHeader } from '@/components/ScreenHeader';
import { DataBanner } from '@/components/DataBanner';
import { Section } from '@/components/Section';
import { Chip } from '@/components/Chip';
import { calibration, pctOf, summarize } from '@/utils/record';
import { useEntitlements } from '@/context/EntitlementsContext';
import { Locked } from '@/components/Pro';
import { spreadText, oneDp, timeAgo } from '@/utils/format';

interface Props { onRun: (req: RunRequest) => void; onUpgrade?: () => void; }

type View_ = 'final' | 'locked' | 'open';

/**
 * Model track record: every prediction the data feed made before kickoff,
 * frozen at kickoff and graded once the final score is in.
 */
export function RecordScreen({ onRun, onUpgrade }: Props) {
  const ent = useEntitlements();
  const { records, getTeam, predictions, week } = useTeams();
  const [view, setView] = useState<View_>('final');
  const [weekFilter, setWeekFilter] = useState<number | 'all'>('all');

  const weeks = useMemo(() => [...new Set(records.map((r) => r.week))].sort((a, b) => a - b), [records]);
  // Free accounts see a rolling window; paid accounts see the whole archive.
  const horizon = Date.now() - ent.ent.historyDays * 86_400_000;
  const inWindow = useMemo(() => records.filter((r) => Date.parse(r.kickoff) >= horizon), [records, horizon]);
  const clipped = records.length - inWindow.length;
  const scoped = weekFilter === 'all' ? inWindow : inWindow.filter((r) => r.week === weekFilter);
  const sum = useMemo(() => summarize(scoped), [scoped]);
  const cal = useMemo(() => calibration(scoped), [scoped]);
  const shown = scoped.filter((r) => r.status === view).sort((a, b) => (view === 'final' ? b.kickoff.localeCompare(a.kickoff) : a.kickoff.localeCompare(b.kickoff)));
  const modelText = predictions ? `Scheme ${predictions.model.weights.scheme} · Personnel ${predictions.model.weights.personnel} · Environment ${predictions.model.weights.environment} · X-Factor ${predictions.model.weights.xfactor} · ${predictions.model.simulations.toLocaleString()} runs · HFA ${predictions.model.homeFieldBase}%` : '';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader title="Record" subtitle="Pre-kickoff predictions, frozen at kickoff, graded on the final" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <DataBanner compact />

        <View style={styles.tiles}>
          <Tile label="Straight up" value={pctOf(sum.su, sum.finals)} sub={`${sum.su}-${sum.finals - sum.su} · winner picked`} />
          <Tile label="vs spread" value={pctOf(sum.ats, sum.ats + sum.atsL)} sub={`${sum.ats}-${sum.atsL}${sum.atsP ? `-${sum.atsP}` : ''} · model side vs market`} />
          <Tile label="Over / under" value={pctOf(sum.ou, sum.ou + sum.ouL)} sub={`${sum.ou}-${sum.ouL}${sum.ouP ? `-${sum.ouP}` : ''} · model total vs market`} />
        </View>
        <View style={styles.tiles}>
          <Tile label="Brier score" value={sum.brier === null ? '—' : sum.brier.toFixed(3)} sub="0 = perfect · 0.25 = coin flip" />
          <Tile label="Margin error" value={sum.spreadMae === null ? '—' : `±${sum.spreadMae.toFixed(1)}`} sub="avg pts off the projected margin" />
          <Tile label="Total error" value={sum.totalMae === null ? '—' : `±${sum.totalMae.toFixed(1)}`} sub="avg pts off the projected total" />
        </View>

        {weeks.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filters}>
            <Chip label={`Season · ${records.length}`} active={weekFilter === 'all'} onPress={() => setWeekFilter('all')} small />
            {weeks.map((w) => <Chip key={w} label={`Wk ${w}`} active={weekFilter === w} onPress={() => setWeekFilter(w)} small />)}
          </ScrollView>
        )}

        {sum.finals >= 5 && !ent.ent.calibration && (
          <Locked
            title="Calibration"
            blurb="When the model says 70%, does it win 70% of the time? The calibration curve is how you tell a model that is right from one that is merely confident."
            cta="Unlock calibration"
            onPress={onUpgrade ?? (() => {})}
            style={{ height: 150, marginBottom: 16 }}
          />
        )}

        {!!clipped && (
          <TouchableOpacity style={styles.clipped} activeOpacity={0.85} onPress={onUpgrade}>
            <Text style={styles.clippedText}>{clipped} older prediction{clipped === 1 ? '' : 's'} hidden — free accounts see the last {ent.ent.historyDays} days</Text>
          </TouchableOpacity>
        )}

        {sum.finals >= 5 && ent.ent.calibration && (
          <Section icon="analytics" title="Calibration" subtitle="When the model gives its favourite X%, does it win X% of the time?">
            <View style={styles.calHead}>
              <Text style={[styles.calCell, styles.calLabel]}>Favourite at</Text>
              <Text style={styles.calCell}>Games</Text>
              <Text style={styles.calCell}>Expected</Text>
              <Text style={styles.calCell}>Actual</Text>
            </View>
            {cal.filter((c) => c.games > 0).map((c) => {
              const exp = c.expected / c.games;
              const act = (c.favWins / c.games) * 100;
              const off = act - exp;
              return (
                <View key={c.label} style={styles.calRow}>
                  <Text style={[styles.calCell, styles.calLabel, { color: colors.ink }]}>{c.label}</Text>
                  <Text style={styles.calCell}>{c.games}</Text>
                  <Text style={styles.calCell}>{Math.round(exp)}%</Text>
                  <Text style={[styles.calCell, { color: Math.abs(off) < 8 ? colors.positive : Math.abs(off) < 15 ? colors.warning : colors.negative, fontWeight: '900' }]}>{Math.round(act)}%</Text>
                </View>
              );
            })}
          </Section>
        )}

        <View style={styles.toggle}>
          <Chip label={`Graded · ${scoped.filter((r) => r.status === 'final').length}`} active={view === 'final'} onPress={() => setView('final')} small />
          <Chip label={`Locked · ${scoped.filter((r) => r.status === 'locked').length}`} active={view === 'locked'} onPress={() => setView('locked')} small />
          <Chip label={`Open · ${scoped.filter((r) => r.status === 'open').length}`} active={view === 'open'} onPress={() => setView('open')} small />
        </View>
        {shown.length === 0 && (
          <Text style={styles.empty}>
            {view === 'final'
              ? `Nothing graded yet. Predictions are recorded before kickoff only — grading starts with the first games the feed predicted in advance${records.length ? ` (${records.length} on file, week ${week})` : ''}.`
              : view === 'locked'
                ? 'No games in progress. A prediction locks the moment its kickoff passes and stays here until the final score arrives.'
                : 'No open predictions. Upcoming games appear here and are re-predicted on every data refresh until kickoff.'}
          </Text>
        )}
        {shown.map((r) => <Row key={r.id} r={r} getTeam={getTeam} onRun={onRun} />)}

        <Text style={styles.note}>
          Predictions use the default model{modelText ? ` (${modelText})` : ''} and the reported injury statuses at refresh time, not your local weights or overrides.
          "vs spread" and "over / under" only count games where the model disagreed with the market by at least half a point. Not betting advice.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileSub}>{sub}</Text>
    </View>
  );
}

function Row({ r, getTeam, onRun }: { r: PredictionRecord; getTeam: (id: string) => ReturnType<ReturnType<typeof useTeams>['getTeam']>; onRun: (req: RunRequest) => void }) {
  const home = getTeam(r.homeId);
  const away = getTeam(r.awayId);
  const fav = r.homeWinPct >= 50 ? home : away;
  const favPct = Math.max(r.homeWinPct, r.awayWinPct);
  const res = r.result;
  const mark = (v: 'win' | 'loss' | 'push' | null | boolean) => (v === true || v === 'win' ? '✓' : v === false || v === 'loss' ? '✗' : v === 'push' ? 'P' : '–');
  const markColor = (v: 'win' | 'loss' | 'push' | null | boolean) => (v === true || v === 'win' ? colors.positive : v === false || v === 'loss' ? colors.negative : colors.inkFaint);
  const when = new Date(r.kickoff).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const market = r.marketHomeSpread !== null ? `${r.marketHomeSpread <= 0 ? home.abbr : away.abbr} -${Math.abs(r.marketHomeSpread)}${r.marketTotal !== null ? ` · ${r.marketTotal}` : ''}` : 'no line';
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => onRun({ awayId: r.awayId, homeId: r.homeId, ctx: { neutralSite: r.neutralSite, primetime: false, weather: 'auto' } })}>
      <View style={styles.cardTop}>
        <View style={styles.team}><TeamMark team={away} size={32} /><Text style={styles.abbr}>{away.abbr}</Text></View>
        <View style={styles.mid}>
          <Text style={styles.when}>Wk {r.week} · {when}</Text>
          {res ? (
            <Text style={styles.score}>{away.abbr} {res.awayScore} – {home.abbr} {res.homeScore}</Text>
          ) : (
            <Text style={styles.proj}>proj {away.abbr} {oneDp(r.projectedAway)} – {home.abbr} {oneDp(r.projectedHome)}</Text>
          )}
          <Text style={styles.pick}>{fav.abbr} {favPct.toFixed(1)}% · {spreadText(r.spread < 0 ? home.abbr : away.abbr, r.spread)} · {oneDp(r.total)}</Text>
        </View>
        <View style={styles.team}><TeamMark team={home} size={32} /><Text style={styles.abbr}>{home.abbr}</Text></View>
      </View>
      <View style={styles.cardBottom}>
        <Text style={styles.marketText}>Market {market}</Text>
        {res ? (
          <View style={styles.marks}>
            <Text style={[styles.markLabel]}>SU <Text style={{ color: markColor(res.suCorrect), fontWeight: '900' }}>{mark(res.suCorrect)}</Text></Text>
            <Text style={[styles.markLabel]}>ATS <Text style={{ color: markColor(res.ats), fontWeight: '900' }}>{mark(res.ats)}</Text></Text>
            <Text style={[styles.markLabel]}>O/U <Text style={{ color: markColor(res.ou), fontWeight: '900' }}>{mark(res.ou)}</Text></Text>
          </View>
        ) : (
          <Text style={[styles.status, { color: r.status === 'locked' ? colors.warning : colors.inkFaint }]}>
            {r.status === 'locked' ? 'Locked at kickoff' : `Updates until kickoff · ${r.updates}× · ${timeAgo(Date.parse(r.predictedAt))}`}
          </Text>
        )}
        <Ionicons name="chevron-forward" size={14} color={colors.inkFaint} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  clipped: { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.goldSoft, marginBottom: 16 },
  clippedText: { color: colors.gold, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  tiles: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  tile: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, alignItems: 'center', ...shadow.card },
  tileLabel: { color: colors.inkFaint, fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  tileValue: { color: colors.gold, fontSize: 20, fontWeight: '900', marginTop: 4 },
  tileSub: { color: colors.inkFaint, fontSize: 9, marginTop: 2, textAlign: 'center' },
  filterBar: { flexGrow: 0, flexShrink: 0, height: 40, marginTop: spacing.sm },
  filters: { gap: spacing.sm, alignItems: 'center' },
  calHead: { flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  calRow: { flexDirection: 'row', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.divider },
  calCell: { flex: 1, color: colors.inkDim, fontSize: 12, fontWeight: '700', textAlign: 'right' },
  calLabel: { flex: 1.4, textAlign: 'left' },
  toggle: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.md, flexWrap: 'wrap' },
  empty: { color: colors.inkFaint, fontSize: 12, lineHeight: 17, marginBottom: spacing.md },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  team: { alignItems: 'center', gap: 2, width: 54 },
  abbr: { color: colors.ink, fontWeight: '900', fontSize: 11 },
  mid: { flex: 1, alignItems: 'center' },
  when: { color: colors.inkFaint, fontSize: 11, fontWeight: '700' },
  score: { color: colors.ink, fontWeight: '900', fontSize: 16, marginTop: 2 },
  proj: { color: colors.inkDim, fontWeight: '800', fontSize: 13, marginTop: 2 },
  pick: { color: colors.gold, fontWeight: '800', fontSize: 11, marginTop: 2, textAlign: 'center' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm, gap: 8, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 8 },
  marketText: { color: colors.inkFaint, fontSize: 11, fontWeight: '700', flex: 1 },
  marks: { flexDirection: 'row', gap: 10 },
  markLabel: { color: colors.inkDim, fontSize: 11, fontWeight: '800' },
  status: { fontSize: 11, fontWeight: '700' },
  note: { color: colors.inkFaint, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: spacing.sm },
});

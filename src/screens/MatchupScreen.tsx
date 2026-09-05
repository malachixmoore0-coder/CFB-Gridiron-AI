import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Weather } from '@/engine/types';
import { colors, radius, shadow, spacing } from '@/theme';
import { timeAgo } from '@/utils/format';
import { useSettings } from '@/context/SettingsContext';
import { useTeams } from '@/context/TeamsContext';
import { RunRequest, DEFAULT_CTX } from '@/hooks/useAnalysis';
import { TeamMark } from '@/components/TeamMark';
import { TeamPickerModal } from '@/components/TeamPickerModal';
import { Chip } from '@/components/Chip';
import { ScreenHeader } from '@/components/ScreenHeader';
import { DataBanner } from '@/components/DataBanner';

const WEATHER: { key: Weather | 'auto'; label: string }[] = [
  { key: 'auto', label: 'Auto' }, { key: 'clear', label: 'Clear' }, { key: 'wind', label: 'Wind' }, { key: 'rain', label: 'Rain' },
  { key: 'snow', label: 'Snow' }, { key: 'cold', label: 'Cold' }, { key: 'heat', label: 'Heat' },
];

interface Props { onRun: (req: RunRequest) => void; onOpenTeam: (id: string) => void; }

export function MatchupScreen({ onRun, onOpenTeam }: Props) {
  const { recent, simulations, statusOf } = useSettings();
  const { getTeam, hasTeam, weekGames, findGame, teams } = useTeams();
  // Default to the biggest scheduled game of the week: both ranked, then the best combined Elo.
  const firstGame = useMemo(() => {
    const scheduled = weekGames.filter((g) => g.status === 'scheduled');
    const pool = scheduled.length ? scheduled : weekGames;
    const score = (g: (typeof pool)[number]) => (g.awayRank ? 30 - g.awayRank : 0) + (g.homeRank ? 30 - g.homeRank : 0) + ((getTeam(g.awayId).elo ?? 0) + (getTeam(g.homeId).elo ?? 0)) / 400;
    return [...pool].sort((a, b) => score(b) - score(a))[0];
  }, [weekGames, getTeam]);
  const fallbackAway = hasTeam('michigan') ? 'michigan' : teams[0]?.id;
  const fallbackHome = hasTeam('ohio-state') ? 'ohio-state' : teams[1]?.id;
  const [awayId, setAwayId] = useState(firstGame?.awayId ?? fallbackAway);
  const [homeId, setHomeId] = useState(firstGame?.homeId ?? fallbackHome);
  const [ctx, setCtx] = useState(DEFAULT_CTX);
  const [picking, setPicking] = useState<'away' | 'home' | null>(null);
  const [seeded, setSeeded] = useState(false);

  // When live data arrives after mount, seed the default matchup from this week's slate once.
  useEffect(() => {
    if (!seeded && firstGame) { setAwayId(firstGame.awayId); setHomeId(firstGame.homeId); setSeeded(true); }
  }, [firstGame, seeded]);

  // If a refreshed dataset dropped a team we were showing, fall back gracefully.
  const away = getTeam(hasTeam(awayId) ? awayId : fallbackAway);
  const home = getTeam(hasTeam(homeId) ? homeId : fallbackHome);
  const game = findGame(away.id, home.id);
  const flagged = useMemo(() => [...home.players, ...away.players].filter((p) => statusOf(p) !== 'healthy'), [home, away, statusOf]);
  const isConference = home.conference === away.conference && home.conference !== 'FBS Independents';
  const isRivalry = !!home.rivals?.includes(away.id) || !!away.rivals?.includes(home.id);

  // Scheduled-game context (neutral site, primetime, forecast) applied automatically unless the user changes it.
  useEffect(() => {
    if (game) setCtx((c) => ({ ...c, neutralSite: game.neutralSite, primetime: game.primetime }));
  }, [game?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const swap = () => { setAwayId(homeId); setHomeId(awayId); };
  const weatherAuto = game?.weatherHint && game.weatherHint !== 'dome' ? `· forecast: ${game.weatherHint}` : home.stadium.dome ? '· indoors' : '';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="CFB Gridiron AI" subtitle="College football bias & predictive analytics engine" />
        <DataBanner />

        <View style={styles.hero}>
          <TouchableOpacity style={styles.teamCol} activeOpacity={0.8} onPress={() => setPicking('away')}>
            <TeamMark team={away} size={78} />
            <Text style={styles.teamCity}>{away.rank ? `#${away.rank} · ` : ''}{away.mascot}{away.record ? ` · ${away.record}` : ''}</Text>
            <Text style={styles.teamName} numberOfLines={1}>{away.school}</Text>
            <Text style={[styles.sideTag, { color: colors.away }]}>AWAY</Text>
          </TouchableOpacity>
          <View style={styles.middle}>
            <Text style={styles.at}>@</Text>
            <TouchableOpacity style={styles.swap} onPress={swap} hitSlop={8}>
              <Ionicons name="swap-horizontal" size={18} color={colors.ink} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.teamCol} activeOpacity={0.8} onPress={() => setPicking('home')}>
            <TeamMark team={home} size={78} />
            <Text style={styles.teamCity}>{home.rank ? `#${home.rank} · ` : ''}{home.mascot}{home.record ? ` · ${home.record}` : ''}</Text>
            <Text style={styles.teamName} numberOfLines={1}>{home.school}</Text>
            <Text style={[styles.sideTag, { color: colors.home }]}>HOME</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.venue}>
          {ctx.neutralSite ? (game?.stadium ? `Neutral · ${game.stadium}` : 'Neutral site') : `${home.stadium.name} · ${home.stadium.city}`}
          {isRivalry ? ' · Rivalry' : isConference ? ` · ${home.conference} game` : ''}
        </Text>
        {game && (
          <View style={styles.market}>
            <Ionicons name="calendar" size={14} color={colors.gold} />
            <Text style={styles.marketText}>
              Week {game.week} · {game.timeTbd ? new Date(game.kickoff).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + ' · TBA' : new Date(game.kickoff).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              {game.broadcast ? ` · ${game.broadcast}` : ''}
              {game.notes ? ` · ${game.notes}` : ''}
              {game.homeSpread !== null ? ` · Market ${game.homeSpread <= 0 ? home.abbr : away.abbr} ${game.homeSpread <= 0 ? game.homeSpread : -game.homeSpread}` : ''}
              {game.totalLine !== null ? ` · O/U ${game.totalLine}` : ''}
            </Text>
          </View>
        )}

        <Text style={styles.label}>Game context</Text>
        <View style={styles.wrapRow}>
          <Chip label="Neutral site" active={ctx.neutralSite} onPress={() => setCtx((c) => ({ ...c, neutralSite: !c.neutralSite }))} />
          <Chip label="Primetime" active={ctx.primetime} onPress={() => setCtx((c) => ({ ...c, primetime: !c.primetime }))} />
        </View>
        <Text style={styles.label}>Weather {weatherAuto}</Text>
        <View style={styles.wrapRow}>
          {WEATHER.map((w) => (
            <Chip key={w.key} label={w.label} active={ctx.weather === w.key} onPress={() => setCtx((c) => ({ ...c, weather: w.key }))} small />
          ))}
        </View>

        <View style={styles.injuryCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.injuryTitle}>Injury report</Text>
            <Text style={styles.injuryText}>
              {flagged.length === 0
                ? 'No one flagged on either depth chart. College availability reports are thin — tap a team to mark players Questionable or Out yourself.'
                : flagged.map((p) => `${p.name} (${statusOf(p) === 'out' ? 'OUT' : 'Q'})`).join(' · ')}
            </Text>
          </View>
          <View style={styles.injuryBtns}>
            <TouchableOpacity style={styles.miniBtn} onPress={() => onOpenTeam(away.id)}><Text style={styles.miniBtnText}>{away.abbr}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.miniBtn} onPress={() => onOpenTeam(home.id)}><Text style={styles.miniBtnText}>{home.abbr}</Text></TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.run}
          activeOpacity={0.85}
          onPress={() => onRun({ awayId: away.id, homeId: home.id, ctx: ctx.weather === 'auto' && game?.weatherHint && game.weatherHint !== 'dome' ? { ...ctx, weather: game.weatherHint } : ctx })}
        >
          <Ionicons name="analytics" size={20} color={colors.bg} />
          <Text style={styles.runText}>Run {simulations.toLocaleString()} simulations</Text>
        </TouchableOpacity>
        <Text style={styles.runHint}>Scheme 25% · Personnel 35% · Environment 15% · X-Factor 25% — tune in Model.</Text>

        {recent.length > 0 && (
          <>
            <Text style={styles.label}>Recent</Text>
            {recent.filter((r) => hasTeam(r.awayId) && hasTeam(r.homeId)).map((r) => {
              const a = getTeam(r.awayId);
              const h = getTeam(r.homeId);
              return (
                <TouchableOpacity key={`${r.awayId}-${r.homeId}`} style={styles.recent} activeOpacity={0.75} onPress={() => { setAwayId(r.awayId); setHomeId(r.homeId); onRun({ awayId: r.awayId, homeId: r.homeId, ctx }); }}>
                  <TeamMark team={a} size={28} />
                  <Text style={styles.recentText}>{a.abbr} @ {h.abbr}</Text>
                  <TeamMark team={h} size={28} />
                  <Text style={styles.recentTime}>{timeAgo(r.ts)}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>

      <TeamPickerModal
        visible={picking !== null}
        title={picking === 'away' ? 'Away team' : 'Home team'}
        selectedId={picking === 'away' ? away.id : home.id}
        excludeId={picking === 'away' ? home.id : away.id}
        onSelect={(t) => (picking === 'away' ? setAwayId(t.id) : setHomeId(t.id))}
        onClose={() => setPicking(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  hero: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, ...shadow.card },
  teamCol: { flex: 1, alignItems: 'center', gap: 3 },
  teamCity: { color: colors.inkFaint, fontSize: 11, fontWeight: '700', marginTop: 6 },
  teamName: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  sideTag: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginTop: 2 },
  middle: { alignItems: 'center', gap: 10, width: 56 },
  at: { color: colors.inkFaint, fontSize: 22, fontWeight: '900' },
  swap: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  venue: { color: colors.inkFaint, fontSize: 12, textAlign: 'center', marginTop: spacing.sm, fontWeight: '600' },
  market: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6 },
  marketText: { color: colors.inkDim, fontSize: 12, fontWeight: '700' },
  label: { color: colors.inkFaint, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: spacing.xl, marginBottom: spacing.sm },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  injuryCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginTop: spacing.xl },
  injuryTitle: { color: colors.ink, fontWeight: '800', fontSize: 14 },
  injuryText: { color: colors.inkFaint, fontSize: 12, marginTop: 3, lineHeight: 17 },
  injuryBtns: { gap: 6 },
  miniBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  miniBtnText: { color: colors.ink, fontWeight: '900', fontSize: 12 },
  run: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.gold, borderRadius: radius.lg, paddingVertical: 16, marginTop: spacing.xl },
  runText: { color: colors.bg, fontWeight: '900', fontSize: 16 },
  runHint: { color: colors.inkFaint, fontSize: 11, textAlign: 'center', marginTop: spacing.sm },
  recent: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  recentText: { color: colors.ink, fontWeight: '800', fontSize: 13 },
  recentTime: { color: colors.inkFaint, fontSize: 11, marginLeft: 'auto' },
});

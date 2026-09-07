/**
 * Saturday — CFB Gridiron AI's home.
 *
 * Built like a gameday program, not a terminal. College football's problem is
 * volume: sixty-plus games across four kickoff windows, 134 programs, and a
 * poll that reshuffles every week. So the home screen is organised the way a
 * fan actually experiences the day —
 *
 *   the poll rail (who matters this week)
 *   → now playing (what is on right now)
 *   → the windows: Noon, Afternoon, Prime, After Dark
 *   → Upset Radar (the dogs the model likes outright)
 *
 * Ticket-stub rows, dashed rules and a serif display face keep it deliberately
 * unlike the NFL app, which is the same engine dressed as a trading desk.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, grad, numeric, radius, shadow, spacing, type as T } from '@/theme';
import { useTeams } from '@/context/TeamsContext';
import { useEntitlements } from '@/context/EntitlementsContext';
import { useEngagement } from '@/context/EngagementContext';
import { buildEdges, lockOfDay, upsets, type EdgeRow } from '@/utils/edge';
import { TeamMark } from '@/components/TeamMark';
import { ConvictionBar, Locked, MeterPill, StreakPill, TierPill } from '@/components/Pro';
import type { RunRequest } from '@/hooks/useAnalysis';
import { DEFAULT_CTX } from '@/hooks/useAnalysis';

interface Props {
  onRun: (r: RunRequest) => void;
  onOpenGame: (teamId: string, gameId: string) => void;
  onOpenTeam: (teamId: string) => void;
  onUpgrade: () => void;
  onOpenCard: () => void;
  onOpenParlay: () => void;
  onOpenModel: () => void;
}

/** The four windows a Saturday actually has, in local time. */
const WINDOWS = [
  { key: 'noon', label: 'Noon', blurb: 'The window that sets the day', from: 0, to: 15 },
  { key: 'afternoon', label: 'Afternoon', blurb: 'The best board of the day', from: 15, to: 19 },
  { key: 'prime', label: 'Prime', blurb: 'Where the poll moves', from: 19, to: 22 },
  { key: 'dark', label: 'After Dark', blurb: 'Pac-time chaos', from: 22, to: 24 },
] as const;

export function HomeScreen({ onRun, onOpenGame, onOpenTeam, onUpgrade, onOpenCard, onOpenParlay, onOpenModel }: Props) {
  const { teams, getTeam, hasTeam, weekGames, records, refresh, refreshing, week, phase } = useTeams();
  const ent = useEntitlements();
  const eng = useEngagement();
  const [openWindow, setOpenWindow] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);

  useEffect(() => {
    const finals = new Map(
      weekGames
        .filter((g) => g.status === 'final' && g.awayScore != null && g.homeScore != null)
        .map((g) => [g.id, { awayScore: g.awayScore as number, homeScore: g.homeScore as number }]),
    );
    if (finals.size) eng.settle(finals);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekGames.length, eng.loaded]);

  const rows = useMemo(
    () => buildEdges(weekGames, records, (id) => (hasTeam(id) ? getTeam(id).abbr : id.toUpperCase())),
    [weekGames, records, getTeam, hasTeam],
  );
  const board = useMemo(() => rows.filter((r) => !r.played), [rows]);
  const lock = useMemo(() => lockOfDay(board), [board]);
  const radar = useMemo(() => upsets(board).slice(0, 6), [board]);
  const live = useMemo(() => weekGames.filter((g) => g.status === 'in_progress'), [weekGames, now]);

  const ranked = useMemo(
    () => teams.filter((t) => t.rank && t.rank <= 25).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)),
    [teams],
  );

  const byWindow = useMemo(() => {
    const map = new Map<string, EdgeRow[]>();
    for (const r of board) {
      const h = new Date(r.game.kickoff).getHours();
      const w = WINDOWS.find((x) => h >= x.from && h < x.to) ?? WINDOWS[0];
      (map.get(w.key) ?? map.set(w.key, []).get(w.key)!).push(r);
    }
    for (const list of map.values()) list.sort((a, b) => b.conviction - a.conviction);
    return map;
  }, [board]);

  const s = eng.summary;
  const depth = ent.ent.edgeBoardDepth;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.gold} />}
      >
        {/* ---- program cover ---- */}
        <View style={styles.cover}>
          <View style={styles.rule} />
          <View style={styles.coverRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>CFB GRIDIRON AI</Text>
              <Text style={styles.coverTitle}>Saturday</Text>
              <Text style={styles.coverSub}>
                {phase === 'postseason' ? 'Bowl season' : `Week ${week}`} · {board.length} games on the board
              </Text>
            </View>
            <View style={styles.coverRight}>
              <StreakPill days={eng.streak} onPress={onOpenCard} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TierPill tier={ent.tier} trial={ent.trial.active ? ent.trial.daysLeft : undefined} onPress={onUpgrade} />
                <TouchableOpacity style={styles.gear} activeOpacity={0.8} onPress={onOpenModel} accessibilityRole="button" accessibilityLabel="Model settings">
                  <Ionicons name="options" size={16} color={colors.inkDim} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
          <View style={styles.rule} />
        </View>

        {/* ---- poll rail ---- */}
        {ranked.length > 0 && (
          <View style={styles.rail}>
            <Text style={styles.railLabel}>THE POLL</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railRow}>
              {ranked.map((t) => (
                <TouchableOpacity key={t.id} style={styles.pollChip} activeOpacity={0.8} onPress={() => onOpenTeam(t.id)}>
                  <Text style={[styles.pollRank, numeric]}>{t.rank}</Text>
                  <TeamMark team={t} size={26} />
                  <Text style={styles.pollAbbr}>{t.abbr}</Text>
                  {!!t.record && <Text style={styles.pollRec}>{t.record}</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ---- now playing ---- */}
        {live.length > 0 && (
          <View style={styles.rail}>
            <Text style={[styles.railLabel, { color: colors.live }]}>● NOW PLAYING</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railRow}>
              {live.map((g) => (
                <TouchableOpacity key={g.id} style={styles.liveCard} activeOpacity={0.85} onPress={() => onOpenGame(g.homeId, g.id)}>
                  <Text style={styles.liveClock}>{g.statusDetail ?? 'LIVE'}</Text>
                  <Text style={[styles.liveScore, numeric]}>
                    {hasTeam(g.awayId) ? getTeam(g.awayId).abbr : g.awayId} {g.awayScore ?? 0}
                  </Text>
                  <Text style={[styles.liveScore, numeric]}>
                    {hasTeam(g.homeId) ? getTeam(g.homeId).abbr : g.homeId} {g.homeScore ?? 0}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ---- your programs ---- */}
        {eng.follows.length > 0 && (
          <View style={styles.rail}>
            <Text style={styles.railLabel}>YOUR PROGRAMS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railRow}>
              {eng.follows.filter(hasTeam).map((id) => {
                const t = getTeam(id);
                const next = board.find((r) => r.game.awayId === id || r.game.homeId === id);
                const oppId = next ? (next.game.homeId === id ? next.game.awayId : next.game.homeId) : null;
                return (
                  <TouchableOpacity key={id} style={styles.pollChip} activeOpacity={0.85}
                    onPress={() => (next ? onOpenGame(id, next.gameId) : onOpenTeam(id))}>
                    <TeamMark team={t} size={26} />
                    <Text style={styles.pollAbbr}>{t.abbr}</Text>
                    <Text style={styles.pollRec} numberOfLines={1}>
                      {next && oppId ? `${next.game.homeId === id ? 'vs' : 'at'} ${hasTeam(oppId) ? getTeam(oppId).abbr : ''}` : t.record ?? '—'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ---- lock of the day ---- */}
        {lock && (ent.ent.lockOfDay ? (
          <Ticket row={lock} onOpen={onOpenGame} onRun={onRun} />
        ) : (
          <Locked
            title="Lock of the Day"
            blurb="One play a day, the highest-conviction number on a 60-game board, with the reasoning. Scholarship opens it."
            cta="Unlock the Lock"
            onPress={onUpgrade}
            preview={<Ticket row={lock} onOpen={() => {}} onRun={() => {}} />}
            style={{ height: 208, marginBottom: spacing.lg }}
          />
        ))}

        {/* ---- your card ---- */}
        <TouchableOpacity style={styles.pnl} activeOpacity={0.85} onPress={onOpenCard}>
          <View style={styles.pnlCell}><Text style={styles.pnlLabel}>YOUR CARD</Text><Text style={[styles.pnlBig, numeric]}>{s.won}-{s.lost}{s.push ? `-${s.push}` : ''}</Text></View>
          <View style={styles.pnlDivider} />
          <View style={styles.pnlCell}><Text style={styles.pnlLabel}>HIT RATE</Text><Text style={[styles.pnlBig, numeric, { color: (s.hitRate ?? 0) >= 52.4 ? colors.green : colors.ink }]}>{s.hitRate == null ? '—' : `${s.hitRate.toFixed(0)}%`}</Text></View>
          <View style={styles.pnlDivider} />
          <View style={styles.pnlCell}><Text style={styles.pnlLabel}>UNITS</Text><Text style={[styles.pnlBig, numeric, { color: s.units > 0 ? colors.green : s.units < 0 ? colors.negative : colors.ink }]}>{s.units > 0 ? '+' : ''}{s.units.toFixed(1)}</Text></View>
          <Ionicons name="chevron-forward" size={16} color={colors.inkGhost} />
        </TouchableOpacity>

        {/* ---- kickoff windows ---- */}
        <View style={styles.sectionHead}>
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.sectionTitle}>The windows</Text>
            <Text style={styles.sectionSub}>Every game, sorted by how far the model is from the number</Text>
          </View>
          <MeterPill left={ent.simsLeft} onPress={onUpgrade} />
        </View>

        {WINDOWS.map((w) => {
          const list = byWindow.get(w.key) ?? [];
          if (!list.length) return null;
          const open = openWindow === w.key || openWindow === null;
          const shown = depth === Infinity ? list : list.slice(0, Math.max(1, Math.min(depth, 3)));
          return (
            <View key={w.key} style={styles.window}>
              <TouchableOpacity style={styles.windowHead} activeOpacity={0.8} onPress={() => setOpenWindow(openWindow === w.key ? '' : w.key)}>
                <View style={styles.windowBadge}><Text style={styles.windowBadgeText}>{list.length}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.windowTitle}>{w.label}</Text>
                  <Text style={styles.windowBlurb}>{w.blurb}</Text>
                </View>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color={colors.inkFaint} />
              </TouchableOpacity>
              {open && shown.map((r) => (
                <TicketRow
                  key={r.gameId}
                  row={r}
                  awayAbbr={hasTeam(r.game.awayId) ? getTeam(r.game.awayId).abbr : r.game.awayId.toUpperCase()}
                  homeAbbr={hasTeam(r.game.homeId) ? getTeam(r.game.homeId).abbr : r.game.homeId.toUpperCase()}
                  onOpen={() => onOpenGame(r.game.homeId, r.gameId)}
                  onRun={() => onRun({ awayId: r.game.awayId, homeId: r.game.homeId, ctx: { ...DEFAULT_CTX, neutralSite: r.game.neutralSite } })}
                />
              ))}
              {open && depth !== Infinity && list.length > shown.length && (
                <TouchableOpacity style={styles.moreRow} activeOpacity={0.8} onPress={onUpgrade}>
                  <Ionicons name="lock-closed" size={11} color={colors.gold} />
                  <Text style={styles.moreText}>{list.length - shown.length} more in this window</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* ---- upset radar ---- */}
        <View style={[styles.sectionHead, { marginTop: spacing.md }]}>
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.sectionTitle}>Upset Radar</Text>
            <Text style={styles.sectionSub}>Underdogs the model has winning outright</Text>
          </View>
        </View>
        {ent.can('lineMoves') || ent.atLeast('bluechip') ? (
          radar.length ? radar.map((r) => (
            <TicketRow
              key={`u-${r.gameId}`}
              row={r}
              dog
              awayAbbr={hasTeam(r.game.awayId) ? getTeam(r.game.awayId).abbr : r.game.awayId.toUpperCase()}
              homeAbbr={hasTeam(r.game.homeId) ? getTeam(r.game.homeId).abbr : r.game.homeId.toUpperCase()}
              onOpen={() => onOpenGame(r.game.homeId, r.gameId)}
              onRun={() => onRun({ awayId: r.game.awayId, homeId: r.game.homeId, ctx: { ...DEFAULT_CTX, neutralSite: r.game.neutralSite } })}
            />
          )) : <Text style={styles.emptyText}>No live dogs on this board — the market and the model agree this week.</Text>
        ) : (
          <Locked
            title="Upset Radar"
            blurb="Every underdog the model has winning outright, ranked by how confident it is. This is the module that pays for itself on one Saturday in October."
            cta="Unlock Upset Radar"
            onPress={onUpgrade}
            preview={<View>{radar.slice(0, 3).map((r) => (
              <TicketRow key={`p-${r.gameId}`} row={r} dog awayAbbr="—" homeAbbr="—" onOpen={() => {}} onRun={() => {}} />
            ))}</View>}
            style={{ height: 190, marginBottom: spacing.lg }}
          />
        )}

        <TouchableOpacity style={styles.lab} activeOpacity={0.88} onPress={onOpenParlay}>
          <LinearGradient colors={grad.tier} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.labBg}>
            <View style={styles.labIcon}><Ionicons name="git-merge" size={17} color={colors.gold} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.labTitle}>Parlay Lab</Text>
              <Text style={styles.labBlurb}>Stack a Saturday card and see what it is actually worth.</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.legal}>
          Projections, not predictions. Every number is graded in the open on the Record tab.
          21+. If betting stops being fun, stop — 1-800-GAMBLER.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- the ticket ---------- */

function Ticket({ row, onOpen, onRun }: { row: EdgeRow; onOpen: (teamId: string, gameId: string) => void; onRun: (r: RunRequest) => void }) {
  const { getTeam, hasTeam } = useTeams();
  const eng = useEngagement();
  const ent = useEntitlements();
  const sideId = row.spreadSide === 'home' ? row.game.homeId : row.game.awayId;
  const side = hasTeam(sideId) ? getTeam(sideId) : null;
  const num = row.game.homeSpread == null ? null : row.spreadSide === 'home' ? row.game.homeSpread : -row.game.homeSpread;
  const saved = eng.hasPick(row.gameId, 'spread', row.spreadSide);
  const label = `${side?.abbr ?? sideId.toUpperCase()} ${num == null ? 'ML' : num > 0 ? `+${num}` : num}`;

  return (
    <View style={styles.ticket}>
      <View style={styles.ticketHead}>
        <Text style={styles.ticketKicker}>LOCK OF THE DAY</Text>
        <Text style={styles.ticketConv}>{row.conviction}<Text style={styles.ticketConvSmall}> / 100</Text></Text>
      </View>
      <View style={styles.dashed} />
      <TouchableOpacity style={styles.ticketMain} activeOpacity={0.85} onPress={() => onOpen(row.game.homeId, row.gameId)}>
        {side && <TeamMark team={side} size={44} />}
        <View style={{ flex: 1 }}>
          <Text style={styles.ticketPick}>{label}</Text>
          <Text style={styles.ticketReason} numberOfLines={2}>{row.reason}</Text>
        </View>
      </TouchableOpacity>
      <View style={styles.dashed} />
      <View style={styles.ticketStats}>
        <View><Text style={styles.statLabel}>EDGE</Text><Text style={[styles.statValue, numeric, { color: colors.green }]}>+{row.spreadEdge.toFixed(1)}</Text></View>
        <View><Text style={styles.statLabel}>WIN</Text><Text style={[styles.statValue, numeric]}>{row.sidePct.toFixed(0)}%</Text></View>
        <View><Text style={styles.statLabel}>EV</Text><Text style={[styles.statValue, numeric, { color: (row.ev ?? 0) > 0 ? colors.green : colors.inkDim }]}>{row.ev == null ? '—' : `${(row.ev * 100).toFixed(1)}%`}</Text></View>
      </View>
      <View style={styles.ticketActions}>
        <TouchableOpacity
          style={[styles.ticketBtn, saved && styles.ticketBtnDone]}
          activeOpacity={0.85}
          onPress={() => eng.savePick({
            gameId: row.gameId, awayId: row.game.awayId, homeId: row.game.homeId,
            market: 'spread', side: row.spreadSide, number: row.game.homeSpread,
            modelPct: row.sidePct, edge: row.spreadEdge, label,
          })}
        >
          <Ionicons name={saved ? 'checkmark' : 'bookmark-outline'} size={13} color={saved ? colors.bg : colors.ink} />
          <Text style={[styles.ticketBtnText, saved && { color: colors.bg }]}>{saved ? 'On your card' : 'Save to card'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.ticketBtn, styles.ticketBtnGo]} activeOpacity={0.85}
          onPress={() => onRun({ awayId: row.game.awayId, homeId: row.game.homeId, ctx: { ...DEFAULT_CTX, neutralSite: row.game.neutralSite } })}>
          <Ionicons name="analytics" size={13} color={colors.bg} />
          <Text style={[styles.ticketBtnText, { color: colors.bg }]}>Run {ent.ent.simDepth.toLocaleString()}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function TicketRow({ row, awayAbbr, homeAbbr, onOpen, onRun, dog }: {
  row: EdgeRow; awayAbbr: string; homeAbbr: string; onOpen: () => void; onRun: () => void; dog?: boolean;
}) {
  const num = row.game.homeSpread == null ? null : row.spreadSide === 'home' ? row.game.homeSpread : -row.game.homeSpread;
  const sideAbbr = row.spreadSide === 'home' ? homeAbbr : awayAbbr;
  const kick = new Date(row.game.kickoff);
  return (
    <TouchableOpacity style={styles.stub} activeOpacity={0.85} onPress={onOpen}>
      <View style={styles.stubNotch} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.stubTeams}>{awayAbbr} <Text style={{ color: colors.inkGhost }}>at</Text> {homeAbbr}</Text>
        <Text style={styles.stubPick}>
          <Text style={{ color: dog ? colors.gold : colors.green }}>{sideAbbr} {num == null ? 'ML' : num > 0 ? `+${num}` : num}</Text>
          <Text style={{ color: colors.inkFaint }}>  ·  {kick.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</Text>
        </Text>
        <ConvictionBar value={row.conviction} width={88} />
      </View>
      <View style={styles.stubRight}>
        <Text style={[styles.stubEdge, numeric, dog && { color: colors.gold }]}>+{row.spreadEdge.toFixed(1)}</Text>
        <Text style={styles.stubEdgeLabel}>{dog ? `${Math.max(row.rec.homeWinPct, row.rec.awayWinPct).toFixed(0)}% ML` : 'pts edge'}</Text>
        <TouchableOpacity style={styles.stubRun} onPress={onRun} activeOpacity={0.8}><Ionicons name="play" size={10} color={colors.bg} /></TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, paddingBottom: 40 },

  cover: { marginBottom: spacing.lg },
  rule: { height: 2, backgroundColor: colors.gold, opacity: 0.85 },
  coverRow: { flexDirection: 'row', alignItems: 'flex-end', paddingVertical: spacing.md, gap: spacing.sm },
  kicker: { color: colors.gold, fontSize: 9, fontWeight: '900', letterSpacing: 2.4 },
  coverTitle: { ...T.hero, color: colors.ink, marginTop: 2 },
  coverSub: { color: colors.inkDim, fontSize: 12, fontWeight: '600', marginTop: 2 },
  gear: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  coverRight: { alignItems: 'flex-end', gap: 6 },

  rail: { marginBottom: spacing.lg },
  railLabel: { color: colors.inkFaint, fontSize: 9, fontWeight: '900', letterSpacing: 1.8, marginBottom: spacing.sm },
  railRow: { gap: spacing.sm, paddingRight: spacing.lg },
  pollChip: { alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, minWidth: 62 },
  pollRank: { color: colors.gold, fontSize: 11, fontWeight: '900' },
  pollAbbr: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  pollRec: { color: colors.inkFaint, fontSize: 9, fontWeight: '700' },

  liveCard: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.live, gap: 2, minWidth: 116 },
  liveClock: { color: colors.live, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  liveScore: { color: colors.ink, fontSize: 13, fontWeight: '800' },

  ticket: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.goldGlow, padding: spacing.lg, marginBottom: spacing.lg, ...shadow.card },
  ticketHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  ticketKicker: { color: colors.gold, fontSize: 9, fontWeight: '900', letterSpacing: 2 },
  ticketConv: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  ticketConvSmall: { color: colors.inkFaint, fontSize: 10, fontWeight: '700' },
  dashed: { height: 1, borderBottomWidth: 1, borderStyle: 'dashed', borderColor: colors.border, marginVertical: spacing.sm },
  ticketMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  ticketPick: { ...T.title, color: colors.ink, fontSize: 23 },
  ticketReason: { color: colors.inkDim, fontSize: 12, lineHeight: 16, marginTop: 2 },
  ticketStats: { flexDirection: 'row', gap: spacing.xl, paddingVertical: spacing.xs },
  statLabel: { color: colors.inkFaint, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  statValue: { color: colors.ink, fontSize: 16, fontWeight: '900', marginTop: 2 },
  ticketActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  ticketBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: radius.sm, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  ticketBtnDone: { backgroundColor: colors.green, borderColor: colors.green },
  ticketBtnGo: { backgroundColor: colors.gold, borderColor: colors.gold },
  ticketBtnText: { color: colors.ink, fontSize: 12, fontWeight: '800' },

  pnl: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.lg },
  pnlCell: { flex: 1 },
  pnlDivider: { width: 1, height: 26, backgroundColor: colors.divider },
  pnlLabel: { color: colors.inkFaint, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  pnlBig: { color: colors.ink, fontSize: 18, fontWeight: '900', marginTop: 2 },

  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: spacing.md, gap: spacing.sm },
  sectionTitle: { ...T.section, color: colors.ink, fontSize: 19 },
  sectionSub: { color: colors.inkFaint, fontSize: 11, marginTop: 1 },

  window: { marginBottom: spacing.md },
  windowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider, marginBottom: spacing.sm },
  windowBadge: { minWidth: 26, height: 22, borderRadius: radius.sm, backgroundColor: colors.goldSoft, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  windowBadgeText: { color: colors.gold, fontSize: 11, fontWeight: '900' },
  windowTitle: { ...T.section, color: colors.ink, fontSize: 15 },
  windowBlurb: { color: colors.inkFaint, fontSize: 10, marginTop: 1 },

  stub: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm, overflow: 'hidden' },
  stubNotch: { position: 'absolute', left: -6, top: '50%', width: 12, height: 12, borderRadius: 6, backgroundColor: colors.bg },
  stubTeams: { color: colors.ink, fontSize: 13, fontWeight: '800', marginLeft: 4 },
  stubPick: { fontSize: 11, fontWeight: '800', marginLeft: 4 },
  stubRight: { alignItems: 'flex-end', gap: 2 },
  stubEdge: { color: colors.green, fontSize: 16, fontWeight: '900' },
  stubEdgeLabel: { color: colors.inkFaint, fontSize: 9, fontWeight: '800' },
  stubRun: { marginTop: 3, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },

  moreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: radius.sm, backgroundColor: colors.goldSoft, marginBottom: spacing.sm },
  moreText: { color: colors.gold, fontSize: 11, fontWeight: '800' },

  emptyText: { color: colors.inkFaint, fontSize: 12, lineHeight: 17, marginBottom: spacing.lg },

  lab: { borderRadius: radius.md, overflow: 'hidden', marginTop: spacing.sm, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
  labBg: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  labIcon: { width: 34, height: 34, borderRadius: radius.sm, backgroundColor: colors.goldSoft, alignItems: 'center', justifyContent: 'center' },
  labTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  labBlurb: { color: colors.inkFaint, fontSize: 11, marginTop: 1 },

  legal: { color: colors.inkGhost, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: spacing.sm },
});

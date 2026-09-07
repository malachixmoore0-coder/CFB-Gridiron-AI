/**
 * Parlay Lab.
 *
 * Books make most of their margin on parlays because almost nobody prices one.
 * This does: every leg gets the model's probability, same-game legs get a
 * documented correlation haircut, and the result is shown next to the number
 * the book is offering. When the book is better, it says so.
 *
 * That last part matters. A tool that always says "bet it" is a tout; a tool
 * that tells you the parlay is -EV four times out of five is worth paying for
 * the fifth.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, numeric, radius, spacing, type as T } from '@/theme';
import { useTeams } from '@/context/TeamsContext';
import { useEntitlements } from '@/context/EntitlementsContext';
import { buildEdges, fmtOdds, legsFor, parlay, SAME_GAME_RHO, type ParlayLeg } from '@/utils/edge';
import { Locked, TierPill } from '@/components/Pro';

interface Props { onUpgrade: () => void; onBack: () => void; }

export function ParlayScreen({ onUpgrade, onBack }: Props) {
  const { weekGames, records, getTeam, hasTeam } = useTeams();
  const ent = useEntitlements();
  const [picked, setPicked] = useState<ParlayLeg[]>([]);
  const [openGame, setOpenGame] = useState<string | null>(null);

  const abbr = (id: string) => (hasTeam(id) ? getTeam(id).abbr : id.toUpperCase());
  const rows = useMemo(() => buildEdges(weekGames, records, abbr).filter((r) => !r.played), [weekGames, records, getTeam, hasTeam]);
  const maxLegs = ent.ent.parlayLegs;
  const priced = useMemo(() => parlay(picked), [picked]);

  const toggle = (leg: ParlayLeg) => {
    setPicked((cur) => {
      if (cur.some((l) => l.key === leg.key)) return cur.filter((l) => l.key !== leg.key);
      if (cur.length >= maxLegs) return cur;
      // One side of a market at a time — you cannot have both sides of a game.
      const market = leg.key.split(':').slice(0, 2).join(':');
      return [...cur.filter((l) => !l.key.startsWith(market)), leg];
    });
  };

  if (maxLegs === 0) {
    return (
      <View style={styles.root}>
        <Header onBack={onBack} onUpgrade={onUpgrade} tier={ent.tier} />
        <View style={{ padding: spacing.lg }}>
          <Locked
            title="Parlay Lab"
            blurb="Price any parlay against the model, with a correlation haircut on same-game legs, and see whether the book's number is worth taking. Blue Chip opens it at four legs; Dynasty at eight."
            cta="Unlock the Lab"
            onPress={onUpgrade}
            style={{ height: 210 }}
          />
          <Text style={styles.pitch}>
            Most parlays lose because nobody prices them. The Lab shows the fair number next to the offered one, so a
            +650 ticket that should be +900 is obvious before you take it.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Header onBack={onBack} onUpgrade={onUpgrade} tier={ent.tier} />

      {/* ---- the slip ---- */}
      <View style={styles.slip}>
        <View style={styles.slipHead}>
          <Text style={styles.slipTitle}>{picked.length ? `${picked.length}-leg parlay` : 'Your slip'}</Text>
          <Text style={styles.slipMax}>{picked.length}/{maxLegs === Infinity ? '∞' : maxLegs}</Text>
        </View>
        {picked.length ? (
          <>
            <View style={styles.slipLegs}>
              {picked.map((l) => (
                <TouchableOpacity key={l.key} style={styles.slipLeg} activeOpacity={0.8} onPress={() => toggle(l)}>
                  <Text style={styles.slipLegText}>{l.label}</Text>
                  <Text style={[styles.slipLegProb, numeric]}>{(l.prob * 100).toFixed(0)}%</Text>
                  <Ionicons name="close" size={12} color={colors.inkGhost} />
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.priceRow}>
              <Price label="MODEL" value={`${(priced.prob * 100).toFixed(1)}%`} />
              <Price label="FAIR" value={fmtOdds(priced.fair)} />
              <Price label="BOOK" value={priced.book == null ? '—' : fmtOdds(priced.book)} />
              <Price
                label="EV"
                value={priced.ev == null ? '—' : `${(priced.ev * 100).toFixed(1)}%`}
                tone={(priced.ev ?? 0) > 0 ? colors.green : colors.negative}
              />
            </View>
            <Text style={styles.verdict}>
              {priced.ev == null
                ? 'Add a leg with a posted price to compare against the book.'
                : priced.ev > 0
                  ? `Worth taking: the book is paying ${fmtOdds(priced.book as number)} on something the model prices at ${fmtOdds(priced.fair)}.`
                  : `Pass. Fair value is ${fmtOdds(priced.fair)} and the book is offering ${fmtOdds(priced.book as number)} — that gap is the house's edge.`}
              {priced.correlated ? `  Same-game legs are haircut ${(SAME_GAME_RHO * 100).toFixed(0)}% per pair; the real book will correlate them too.` : ''}
            </Text>
            <TouchableOpacity style={styles.clear} activeOpacity={0.8} onPress={() => setPicked([])}>
              <Text style={styles.clearText}>Clear slip</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.slipEmpty}>Tap legs below to build a Saturday ticket. The model prices it as you go.</Text>
        )}
      </View>

      {/* ---- the board ---- */}
      <ScrollView contentContainerStyle={styles.body}>
        {rows.map((r) => {
          const open = openGame === r.gameId;
          const legs = legsFor(r, abbr(r.game.awayId), abbr(r.game.homeId));
          return (
            <View key={r.gameId} style={styles.game}>
              <TouchableOpacity style={styles.gameHead} activeOpacity={0.85} onPress={() => setOpenGame(open ? null : r.gameId)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.gameTeams}>{abbr(r.game.awayId)} @ {abbr(r.game.homeId)}</Text>
                  <Text style={styles.gameMeta}>
                    {new Date(r.game.kickoff).toLocaleDateString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
                    {' · '}model edge +{r.spreadEdge.toFixed(1)}
                  </Text>
                </View>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color={colors.inkFaint} />
              </TouchableOpacity>
              {open && (
                <View style={styles.legs}>
                  {legs.map((l) => {
                    const on = picked.some((p) => p.key === l.key);
                    const full = !on && picked.length >= maxLegs;
                    return (
                      <TouchableOpacity
                        key={l.key}
                        style={[styles.leg, on && styles.legOn, full && styles.legFull]}
                        activeOpacity={0.85}
                        onPress={() => toggle(l)}
                        disabled={full}
                      >
                        <Text style={[styles.legLabel, on && { color: colors.bg }]}>{l.label}</Text>
                        <Text style={[styles.legProb, numeric, on && { color: colors.bg }]}>{(l.prob * 100).toFixed(0)}%</Text>
                        {l.american != null && <Text style={[styles.legOdds, numeric, on && { color: colors.bg }]}>{fmtOdds(l.american)}</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
        {!rows.length && <Text style={styles.slipEmpty}>No open games to price right now.</Text>}
        <Text style={styles.legal}>
          Probabilities come from the same projections the Record tab grades. Correlation on same-game legs is a flat,
          documented haircut, not a fitted copula — it is deliberately conservative.
        </Text>
      </ScrollView>
    </View>
  );
}

function Header({ onBack, onUpgrade, tier }: { onBack: () => void; onUpgrade: () => void; tier: ReturnType<typeof useEntitlements>['tier'] }) {
  return (
    <SafeAreaView edges={['top']} style={styles.headSafe}>
      <View style={styles.head}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Parlay Lab</Text>
          <Text style={styles.sub}>Fair price vs the book</Text>
        </View>
        <TierPill tier={tier} onPress={onUpgrade} />
      </View>
    </SafeAreaView>
  );
}

function Price({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.priceLabel}>{label}</Text>
      <Text style={[styles.priceValue, numeric, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headSafe: { backgroundColor: colors.bg },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  title: { ...T.title, color: colors.ink, fontSize: 22 },
  sub: { color: colors.inkFaint, fontSize: 11, fontWeight: '700' },

  slip: { margin: spacing.lg, marginTop: 0, padding: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderHi },
  slipHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  slipTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  slipMax: { color: colors.inkFaint, fontSize: 11, fontWeight: '800' },
  slipEmpty: { color: colors.inkFaint, fontSize: 12, lineHeight: 17, marginTop: 6 },
  slipLegs: { gap: 6, marginTop: spacing.sm },
  slipLeg: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.cardAlt, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 7 },
  slipLegText: { color: colors.ink, fontSize: 12, fontWeight: '800', flex: 1 },
  slipLegProb: { color: colors.inkDim, fontSize: 11, fontWeight: '800' },

  priceRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  priceLabel: { color: colors.inkFaint, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  priceValue: { color: colors.ink, fontSize: 16, fontWeight: '900', marginTop: 2 },
  verdict: { color: colors.inkDim, fontSize: 11, lineHeight: 16, marginTop: spacing.sm },
  clear: { alignSelf: 'flex-start', marginTop: spacing.sm },
  clearText: { color: colors.inkGhost, fontSize: 11, fontWeight: '800' },

  body: { padding: spacing.lg, paddingTop: 0, paddingBottom: 40 },
  game: { marginBottom: spacing.sm, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  gameHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  gameTeams: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  gameMeta: { color: colors.inkFaint, fontSize: 10, marginTop: 2 },
  legs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: spacing.md, paddingTop: 0 },
  leg: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.sm, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  legOn: { backgroundColor: colors.green, borderColor: colors.green },
  legFull: { opacity: 0.35 },
  legLabel: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  legProb: { color: colors.green, fontSize: 11, fontWeight: '900' },
  legOdds: { color: colors.inkFaint, fontSize: 10, fontWeight: '700' },

  pitch: { color: colors.inkDim, fontSize: 12, lineHeight: 18, marginTop: spacing.lg },
  legal: { color: colors.inkGhost, fontSize: 10, lineHeight: 15, marginTop: spacing.lg, textAlign: 'center' },
});

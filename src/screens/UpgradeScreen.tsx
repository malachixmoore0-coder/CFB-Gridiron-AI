/**
 * The wall.
 *
 * Three things do the selling here, in this order:
 *   1. Proof. The headline is the model's own graded record, computed live from
 *      the same predictions file the Record tab grades. If the model is having
 *      a bad month the wall says so — a paywall that lies is a refund with a
 *      delay.
 *   2. The trial. Seven days of Blue Chip, no card. The cost of a trial is a
 *      rounding error next to the cost of a user who never sees the good part.
 *   3. The ladder. Priced so the middle tier is the obvious one: Scholarship
 *      removes the meter, Blue Chip is the one with the tools, and Dynasty
 *      exists mostly to make Blue Chip look reasonable.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, grad, numeric, radius, shadow, spacing, type as T } from '@/theme';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useEntitlements } from '@/context/EntitlementsContext';
import { useTeams } from '@/context/TeamsContext';
import { summarize } from '@/utils/record';
import { ANNUAL_LABEL, TIERS, TRIAL_DAYS, annualSaving, price, type Cycle, type Tier } from '@/monetize/tiers';
import { BILLING_PORTAL, openLink, paymentsLive } from '@/monetize/checkout';

const accentOf = (a: Tier['accent']) =>
  a === 'green' ? colors.green : a === 'gold' ? colors.gold : a === 'platinum' ? '#D9E2EC' : colors.inkDim;

export function UpgradeScreen({ onBack }: { onBack: () => void }) {
  const ent = useEntitlements();
  const { records } = useTeams();
  const [cycle, setCycle] = useState<Cycle>(ent.cycle);
  const [code, setCode] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const proof = useMemo(() => summarize(records), [records]);
  const midSaving = annualSaving(TIERS[1]);
  const atsPlays = proof.ats + proof.atsL;
  const atsPct = atsPlays ? (proof.ats / atsPlays) * 100 : null;

  const buy = async (tier: Tier) => {
    if (tier.id === ent.tierId) return;
    const how = await ent.upgrade(tier.id, cycle);
    setNote(how === 'checkout'
      ? 'Checkout opened in a new tab. Your tier unlocks the moment you land back here.'
      : `Noted — ${tier.name} ${cycle === 'annual' ? 'season pass' : 'monthly'}. Card payments switch on the day the Stripe links are set; you are on the list.`);
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Go Pro" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.body}>
        {/* ---- proof ---- */}
        <LinearGradient colors={grad.night} style={styles.hero}>
          <Text style={styles.heroKicker}>THE MODEL, GRADED IN THE OPEN</Text>
          <Text style={styles.heroLine}>
            {proof.finals < 10
              ? `Every projection is locked at kickoff and graded against the final${proof.finals ? ` — ${proof.finals} graded so far` : ''}. Nothing is back-filled.`
              : `${proof.ats}-${proof.atsL}${proof.atsP ? `-${proof.atsP}` : ''} against the spread this season.`}
          </Text>
          <View style={styles.heroStats}>
            <HeroStat label="GAMES GRADED" value={`${proof.finals}`} />
            <HeroStat label="ATS" value={atsPct == null ? '—' : `${atsPct.toFixed(1)}%`} tone={atsPct != null && atsPct >= 52.4 ? colors.green : undefined} />
            <HeroStat label="SU" value={proof.finals ? `${Math.round((proof.su / proof.finals) * 100)}%` : '—'} />
            <HeroStat label="MARGIN MAE" value={proof.spreadMae == null ? '—' : proof.spreadMae.toFixed(1)} />
          </View>
          <Text style={styles.heroFoot}>
            {proof.finals < 10
              ? 'Live from the same predictions file the Record tab grades. Too few games to draw a line through yet — which is exactly why it is shown rather than hidden.'
              : 'Live from the same predictions file the Record tab grades. 52.4% is the break-even number at -110.'}
          </Text>
        </LinearGradient>

        {/* ---- trial ---- */}
        {ent.trial.available && (
          <TouchableOpacity style={styles.trial} activeOpacity={0.88} onPress={() => { ent.startTrial(); setNote(`${TRIAL_DAYS} days of Blue Chip, on the house. No card taken.`); }}>
            <LinearGradient colors={grad.money} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.trialBg}>
              <Ionicons name="gift" size={18} color={colors.bg} />
              <View style={{ flex: 1 }}>
                <Text style={styles.trialTitle}>Take {TRIAL_DAYS} days of Blue Chip free</Text>
                <Text style={styles.trialBlurb}>No card. No auto-charge. It simply ends.</Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={colors.bg} />
            </LinearGradient>
          </TouchableOpacity>
        )}
        {ent.trial.active && (
          <View style={styles.trialActive}>
            <Ionicons name="time" size={14} color={colors.green} />
            <Text style={styles.trialActiveText}>Trial running · {ent.trial.daysLeft} day{ent.trial.daysLeft === 1 ? '' : 's'} of All-Pro left</Text>
          </View>
        )}

        {/* ---- cycle ---- */}
        <View style={styles.cycle}>
          {(['monthly', 'annual'] as Cycle[]).map((c) => (
            <TouchableOpacity key={c} style={[styles.cycleBtn, cycle === c && styles.cycleBtnOn]} activeOpacity={0.85}
              onPress={() => { setCycle(c); ent.setCycle(c); }}>
              <Text style={[styles.cycleText, cycle === c && styles.cycleTextOn]}>{c === 'monthly' ? 'Monthly' : ANNUAL_LABEL}</Text>
              {c === 'annual' && !!midSaving && (
                <View style={styles.cycleTag}><Text style={styles.cycleTagText}>SAVE {midSaving.pct}%</Text></View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* ---- tiers ---- */}
        {TIERS.map((t) => {
          const mine = t.id === ent.tierId;
          const c = accentOf(t.accent);
          const save = annualSaving(t);
          const amount = cycle === 'annual' ? t.annual : t.monthly;
          const per = cycle === 'annual' ? '/season' : '/mo';
          return (
            <View key={t.id} style={[styles.tier, mine && { borderColor: c }, t.id === 'bluechip' && styles.tierFeatured]}>
              {t.id === 'bluechip' && <View style={[styles.ribbon, { backgroundColor: c }]}><Text style={styles.ribbonText}>MOST POPULAR</Text></View>}
              <View style={styles.tierHead}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tierName, { color: c }]}>{t.name}</Text>
                  <Text style={styles.tierTag}>{t.tagline}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.tierPrice, numeric]}>{amount === 0 ? 'Free' : price(amount)}</Text>
                  {amount > 0 && <Text style={styles.tierPer}>{per}{cycle === 'annual' && save ? ` · save ${save.pct}%` : ''}</Text>}
                </View>
              </View>
              <Text style={styles.tierHook}>{t.hook}</Text>
              <View style={styles.bullets}>
                {t.bullets.map((b) => (
                  <View key={b} style={styles.bullet}>
                    <Ionicons name="checkmark-circle" size={13} color={c} />
                    <Text style={styles.bulletText}>{b}</Text>
                  </View>
                ))}
              </View>
              {mine ? (
                <View style={[styles.cta, styles.ctaCurrent]}><Text style={styles.ctaCurrentText}>Your plan</Text></View>
              ) : t.monthly === 0 ? null : (
                <TouchableOpacity style={styles.cta} activeOpacity={0.88} onPress={() => buy(t)}>
                  <LinearGradient colors={t.accent === 'gold' ? grad.lights : grad.money} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaBg}>
                    <Text style={styles.ctaText}>{paymentsLive ? `Get ${t.name}` : `Join the ${t.name} list`}</Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.bg} />
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {!!note && <View style={styles.note}><Ionicons name="information-circle" size={14} color={colors.green} /><Text style={styles.noteText}>{note}</Text></View>}

        {/* ---- codes and housekeeping ---- */}
        <View style={styles.redeem}>
          <Text style={styles.redeemLabel}>Have a code?</Text>
          <View style={styles.redeemRow}>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              placeholder="FOUNDER"
              placeholderTextColor={colors.inkGhost}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.redeemBtn} activeOpacity={0.85} onPress={() => {
              const r = ent.redeem(code);
              setNote(r.message);
              if (r.ok) setCode('');
            }}>
              <Text style={styles.redeemBtnText}>Redeem</Text>
            </TouchableOpacity>
          </View>
        </View>

        {!!BILLING_PORTAL && (
          <TouchableOpacity style={styles.link} activeOpacity={0.8} onPress={() => openLink(BILLING_PORTAL as string)}>
            <Ionicons name="card-outline" size={14} color={colors.inkDim} />
            <Text style={styles.linkText}>Manage billing</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.legal}>
          Cancel any time — a subscription runs to the end of the period you paid for. Prices in USD.
          Projections are information, not advice, and no model beats a book every week. 21+ where betting is legal.
          If it stops being fun, stop: 1-800-GAMBLER.
        </Text>
      </ScrollView>
    </View>
  );
}

function HeroStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatLabel}>{label}</Text>
      <Text style={[styles.heroStatValue, numeric, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, paddingBottom: 60 },

  hero: { borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg, ...shadow.card },
  heroKicker: { color: colors.green, fontSize: 9, fontWeight: '900', letterSpacing: 2 },
  heroLine: { ...T.title, color: colors.ink, fontSize: 22, marginTop: 6, lineHeight: 28 },
  heroStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg, gap: spacing.sm },
  heroStat: { flex: 1 },
  heroStatLabel: { color: colors.inkFaint, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  heroStatValue: { color: colors.ink, fontSize: 17, fontWeight: '900', marginTop: 3 },
  heroFoot: { color: colors.inkGhost, fontSize: 10, lineHeight: 14, marginTop: spacing.md },

  trial: { borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.lg },
  trialBg: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  trialTitle: { color: colors.bg, fontSize: 15, fontWeight: '900' },
  trialBlurb: { color: 'rgba(5,8,12,0.75)', fontSize: 11, fontWeight: '700', marginTop: 1 },
  trialActive: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.greenSoft, marginBottom: spacing.lg },
  trialActiveText: { color: colors.green, fontSize: 12, fontWeight: '800' },

  cycle: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.pill, padding: 4, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  cycleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: radius.pill },
  cycleBtnOn: { backgroundColor: colors.cardAlt },
  cycleText: { color: colors.inkFaint, fontSize: 13, fontWeight: '800' },
  cycleTextOn: { color: colors.ink },
  cycleTag: { backgroundColor: colors.greenSoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  cycleTagText: { color: colors.green, fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },

  tier: { backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md },
  tierFeatured: { borderColor: colors.gold, ...shadow.card },
  ribbon: { position: 'absolute', top: -1, right: spacing.lg, paddingHorizontal: 10, paddingVertical: 3, borderBottomLeftRadius: radius.sm, borderBottomRightRadius: radius.sm },
  ribbonText: { color: colors.bg, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  tierHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  tierName: { fontSize: 19, fontWeight: '900', letterSpacing: -0.3 },
  tierTag: { color: colors.inkFaint, fontSize: 11, fontWeight: '700', marginTop: 1 },
  tierPrice: { color: colors.ink, fontSize: 22, fontWeight: '900' },
  tierPer: { color: colors.inkFaint, fontSize: 10, fontWeight: '700' },
  tierHook: { color: colors.inkDim, fontSize: 13, lineHeight: 18, marginTop: spacing.sm },
  bullets: { gap: 7, marginTop: spacing.md },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bulletText: { color: colors.inkDim, fontSize: 12, lineHeight: 17, flex: 1 },
  cta: { marginTop: spacing.md, borderRadius: radius.pill, overflow: 'hidden' },
  ctaBg: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 12 },
  ctaText: { color: colors.bg, fontSize: 14, fontWeight: '900' },
  ctaCurrent: { alignItems: 'center', paddingVertical: 12, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  ctaCurrentText: { color: colors.inkDim, fontSize: 13, fontWeight: '800' },

  note: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.greenSoft, marginBottom: spacing.md },
  noteText: { color: colors.ink, fontSize: 12, flex: 1, lineHeight: 17 },

  redeem: { marginTop: spacing.sm, marginBottom: spacing.md },
  redeemLabel: { color: colors.inkFaint, fontSize: 11, fontWeight: '800', marginBottom: 6 },
  redeemRow: { flexDirection: 'row', gap: spacing.sm },
  input: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 10, color: colors.ink, fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  redeemBtn: { paddingHorizontal: spacing.lg, justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  redeemBtnText: { color: colors.ink, fontSize: 12, fontWeight: '800' },

  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.sm },
  linkText: { color: colors.inkDim, fontSize: 12, fontWeight: '700' },

  legal: { color: colors.inkGhost, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: spacing.md },
});

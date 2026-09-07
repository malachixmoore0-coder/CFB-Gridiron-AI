/**
 * Your Card.
 *
 * The Record tab grades the model. This grades *you* — every pick you saved,
 * settled off the same final scores, with a flat-unit P&L at -110. It is the
 * single strongest retention surface in the app, because a record in progress
 * is a reason to come back that has nothing to do with whether we shipped
 * anything this week.
 *
 * Nothing here is editable after the fact. A card you can rewrite is a card
 * that means nothing.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, numeric, radius, spacing, type as T } from '@/theme';
import { useEngagement, type SavedPick } from '@/context/EngagementContext';
import { useEntitlements } from '@/context/EntitlementsContext';
import { useTeams } from '@/context/TeamsContext';
import { Section } from '@/components/Section';
import { Locked, TierPill } from '@/components/Pro';
import { cardText, shareCard } from '@/utils/share';

interface Props { onUpgrade: () => void; onOpenGame: (teamId: string, gameId: string) => void; }

const STATUS_TONE = { won: colors.green, lost: colors.negative, push: colors.inkDim, open: colors.gold } as const;

export function CardScreen({ onUpgrade, onOpenGame }: Props) {
  const eng = useEngagement();
  const ent = useEntitlements();
  const { hasTeam, getTeam } = useTeams();
  const [tab, setTab] = useState<'open' | 'settled'>('open');
  const [note, setNote] = useState<string | null>(null);

  const open = useMemo(() => eng.picks.filter((p) => p.status === 'open'), [eng.picks]);
  const settled = useMemo(() => eng.picks.filter((p) => p.status !== 'open'), [eng.picks]);
  const s = eng.summary;
  const list = tab === 'open' ? open : settled;

  const share = async () => {
    const spec = {
      title: 'My card',
      subtitle: `${s.graded} graded · ${eng.streak}-day streak`,
      headline: `${s.won}-${s.lost}${s.push ? `-${s.push}` : ''}`,
      stats: [
        { label: 'Hit rate', value: s.hitRate == null ? '—' : `${s.hitRate.toFixed(0)}%`, tone: (s.hitRate ?? 0) >= 52.4 ? 'money' as const : 'plain' as const },
        { label: 'Units', value: `${s.units > 0 ? '+' : ''}${s.units.toFixed(1)}`, tone: s.units > 0 ? 'money' as const : 'plain' as const },
        { label: 'Open', value: `${s.open}` },
      ],
      footer: 'Every pick graded off the final score. Nothing back-filled.',
      branded: ent.ent.shareCards === 'branded',
    };
    const ok = await shareCard(spec, 'my-card.png');
    setNote(ok ? 'Card saved to your downloads.' : cardText(spec));
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Your Card</Text>
          <Text style={styles.sub}>{eng.streak}-day streak · best {eng.best}</Text>
        </View>
        <TierPill tier={ent.tier} onPress={onUpgrade} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.summary}>
          <Cell label="RECORD" value={`${s.won}-${s.lost}${s.push ? `-${s.push}` : ''}`} />
          <Cell label="HIT RATE" value={s.hitRate == null ? '—' : `${s.hitRate.toFixed(1)}%`} tone={(s.hitRate ?? 0) >= 52.4 ? colors.green : undefined} />
          <Cell label="UNITS" value={`${s.units > 0 ? '+' : ''}${s.units.toFixed(2)}`} tone={s.units > 0 ? colors.green : s.units < 0 ? colors.negative : undefined} />
          <Cell label="OPEN" value={`${s.open}`} />
        </View>
        <Text style={styles.summaryFoot}>Flat 1 unit a play at -110. Break-even is 52.4%.</Text>

        {/* ---- badges ---- */}
        <Section icon="ribbon" title="Badges" subtitle="Earned by showing up and being right">
          <View style={styles.badges}>
            {eng.badges.map((b) => (
              <View key={b.id} style={[styles.badge, b.earned && styles.badgeOn]}>
                <Ionicons name={b.icon as never} size={15} color={b.earned ? colors.gold : colors.inkGhost} />
                <Text style={[styles.badgeName, b.earned && { color: colors.ink }]}>{b.name}</Text>
                <Text style={styles.badgeBlurb}>{b.earned ? 'Earned' : `${b.progress}/${b.goal}`}</Text>
              </View>
            ))}
          </View>
        </Section>

        {/* ---- share ---- */}
        {ent.ent.shareCards === 'off' ? (
          <Locked
            title="Share cards"
            blurb="Turn your card into an image built for a group chat — the pick, the model's number, your record. Scholarship turns it on."
            cta="Unlock share cards"
            onPress={onUpgrade}
            style={{ height: 150, marginBottom: spacing.lg }}
          />
        ) : (
          <TouchableOpacity style={styles.share} activeOpacity={0.85} onPress={share}>
            <Ionicons name="share-social" size={16} color={colors.bg} />
            <Text style={styles.shareText}>Share my card</Text>
          </TouchableOpacity>
        )}
        {!!note && <Text style={styles.note}>{note}</Text>}

        {/* ---- picks ---- */}
        <View style={styles.tabs}>
          {(['open', 'settled'] as const).map((t) => (
            <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabOn]} activeOpacity={0.85} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>
                {t === 'open' ? `Open (${open.length})` : `Settled (${settled.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {list.map((p) => (
          <PickRow key={p.id} pick={p} onOpen={() => onOpenGame(p.homeId, p.gameId)} onRemove={() => eng.removePick(p.id)}
            abbr={(id) => (hasTeam(id) ? getTeam(id).abbr : id.toUpperCase())} />
        ))}

        {!list.length && (
          <View style={styles.empty}>
            <Ionicons name={tab === 'open' ? 'bookmark-outline' : 'trophy-outline'} size={22} color={colors.inkGhost} />
            <Text style={styles.emptyText}>
              {tab === 'open'
                ? 'Nothing on the card yet. Save a pick from the Edge Board and it lands here, graded automatically when the game ends.'
                : 'No settled picks yet. They move here the moment a final lands.'}
            </Text>
          </View>
        )}

        {!!settled.length && tab === 'settled' && (
          <TouchableOpacity style={styles.clear} activeOpacity={0.8} onPress={eng.clearSettled}>
            <Text style={styles.clearText}>Clear settled picks</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={[styles.cellValue, numeric, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

function PickRow({ pick, onOpen, onRemove, abbr }: { pick: SavedPick; onOpen: () => void; onRemove: () => void; abbr: (id: string) => string }) {
  const tone = STATUS_TONE[pick.status];
  return (
    <TouchableOpacity style={styles.pick} activeOpacity={0.85} onPress={onOpen}>
      <View style={[styles.pickDot, { backgroundColor: tone }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.pickLabel}>{pick.label}</Text>
        <Text style={styles.pickMeta}>
          {abbr(pick.awayId)} @ {abbr(pick.homeId)} · model {pick.modelPct.toFixed(0)}% · edge +{pick.edge.toFixed(1)}
        </Text>
      </View>
      {pick.status === 'open' ? (
        <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={16} color={colors.inkGhost} />
        </TouchableOpacity>
      ) : (
        <Text style={[styles.pickStatus, { color: tone }]}>{pick.status.toUpperCase()}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
  title: { ...T.title, color: colors.ink },
  sub: { color: colors.inkFaint, fontSize: 11, fontWeight: '700', marginTop: 1 },
  body: { padding: spacing.lg, paddingTop: 0, paddingBottom: 40 },

  summary: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  cell: { flex: 1 },
  cellLabel: { color: colors.inkFaint, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  cellValue: { color: colors.ink, fontSize: 17, fontWeight: '900', marginTop: 3 },
  summaryFoot: { color: colors.inkGhost, fontSize: 10, marginTop: 6, marginBottom: spacing.lg, textAlign: 'center' },

  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badge: { alignItems: 'center', gap: 3, width: '30%', paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  badgeOn: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  badgeName: { color: colors.inkFaint, fontSize: 11, fontWeight: '800' },
  badgeBlurb: { color: colors.inkGhost, fontSize: 9, fontWeight: '700' },

  share: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: radius.pill, backgroundColor: colors.green, marginBottom: spacing.md },
  shareText: { color: colors.bg, fontSize: 14, fontWeight: '900' },
  note: { color: colors.inkDim, fontSize: 11, lineHeight: 16, textAlign: 'center', marginBottom: spacing.md },

  tabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tabOn: { backgroundColor: colors.cardAlt, borderColor: colors.borderHi },
  tabText: { color: colors.inkFaint, fontSize: 12, fontWeight: '800' },
  tabTextOn: { color: colors.ink },

  pick: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  pickDot: { width: 8, height: 8, borderRadius: 4 },
  pickLabel: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  pickMeta: { color: colors.inkFaint, fontSize: 11, marginTop: 2 },
  pickStatus: { fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },

  empty: { alignItems: 'center', gap: 8, padding: spacing.xl, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  emptyText: { color: colors.inkFaint, fontSize: 12, textAlign: 'center', lineHeight: 17, maxWidth: 300 },

  clear: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
  clearText: { color: colors.inkGhost, fontSize: 12, fontWeight: '700' },
});

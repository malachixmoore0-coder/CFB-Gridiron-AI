import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/theme';
import { useSettings } from '@/context/SettingsContext';

const NODES: { icon: keyof typeof Ionicons.glyphMap; title: string; weight: string; text: string }[] = [
  { icon: 'flag', title: 'Scheme & Tactical Bias', weight: '25%', text: 'Offense vs the specific front and coverage it will see, play-action leverage, 3rd-down and red-zone tendencies, in-game adjustments.' },
  { icon: 'people', title: 'Personnel & Matchup Edge', weight: '35%', text: 'Quarterback, roster talent, pass-block vs pass-rush win rates, slot vs nickel, TE speed vs linebackers, and an injury degradation metric.' },
  { icon: 'home', title: 'Environmental & Rivalry', weight: '15%', text: 'Home field scaled by crowd, travel, altitude and night kicks, weather effects on totals, and rivalry-game variance.' },
  { icon: 'eye', title: 'Sleeper & X-Factor', weight: '25%', text: 'Target share and TPRR projections, rotational pass-rusher snap rates, and the mismatches that swing a spread.' },
];

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { setOnboarded } = useSettings();
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.badge}><Ionicons name="american-football" size={30} color={colors.bg} /></View>
        <Text style={styles.title}>CFB Gridiron AI</Text>
        <Text style={styles.subtitle}>
          Pick any two of the 130+ FBS programs. The engine grades the matchup through four weighted nodes, simulates
          the game 10,000 times, and hands you win probability, a projected score, an advantage matrix, a three-act game
          script and a sleeper report.
        </Text>
        {NODES.map((n) => (
          <View key={n.title} style={styles.node}>
            <View style={styles.nodeIcon}><Ionicons name={n.icon} size={16} color={colors.gold} /></View>
            <View style={{ flex: 1 }}>
              <View style={styles.nodeHead}>
                <Text style={styles.nodeTitle}>{n.title}</Text>
                <Text style={styles.nodeWeight}>{n.weight}</Text>
              </View>
              <Text style={styles.nodeText}>{n.text}</Text>
            </View>
          </View>
        ))}
        <View style={styles.note}>
          <Ionicons name="information-circle" size={16} color={colors.inkDim} />
          <Text style={styles.noteText}>Ratings rebuild from public play-by-play, Elo and rosters every few hours in-season. Not betting advice.</Text>
        </View>
        <TouchableOpacity style={styles.cta} activeOpacity={0.85} onPress={() => { setOnboarded(true); onDone(); }}>
          <Text style={styles.ctaText}>Start simulating</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.bg} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl },
  badge: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  title: { color: colors.ink, fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { color: colors.inkDim, fontSize: 14, lineHeight: 21, marginTop: spacing.sm, marginBottom: spacing.xl },
  node: { flexDirection: 'row', gap: 12, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.sm },
  nodeIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.goldSoft, alignItems: 'center', justifyContent: 'center' },
  nodeHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nodeTitle: { color: colors.ink, fontWeight: '800', fontSize: 14 },
  nodeWeight: { color: colors.gold, fontWeight: '900', fontSize: 13 },
  nodeText: { color: colors.inkFaint, fontSize: 12, lineHeight: 17, marginTop: 3 },
  note: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.xl },
  noteText: { color: colors.inkDim, fontSize: 12, flex: 1 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.gold, borderRadius: radius.lg, paddingVertical: 16 },
  ctaText: { color: colors.bg, fontWeight: '900', fontSize: 16 },
});

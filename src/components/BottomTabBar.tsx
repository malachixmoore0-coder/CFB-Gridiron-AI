/**
 * The dock.
 *
 * Four destinations and one action. The action — Simulate — is raised, lit gold
 * and in the middle because it is the thing the product does; every other app
 * in this category buries its own verb behind two taps.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, grad, radius, spacing } from '@/theme';

export type TabKey = 'home' | 'slate' | 'matchup' | 'record' | 'teams';

const LEFT: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'home', label: 'Saturday', icon: 'newspaper-outline', iconActive: 'newspaper' },
  { key: 'slate', label: 'Slate', icon: 'list-outline', iconActive: 'list' },
];
const RIGHT: typeof LEFT = [
  { key: 'record', label: 'Record', icon: 'ribbon-outline', iconActive: 'ribbon' },
  { key: 'teams', label: 'Teams', icon: 'shield-outline', iconActive: 'shield' },
];

interface Props { active: TabKey; onChange: (t: TabKey) => void; badge?: number; }

export function BottomTabBar({ active, onChange, badge }: Props) {
  const Tab = ({ tab }: { tab: (typeof LEFT)[number] }) => {
    const on = tab.key === active;
    return (
      <TouchableOpacity style={styles.tab} activeOpacity={0.7} onPress={() => onChange(tab.key)} accessibilityRole="tab" accessibilityLabel={tab.label}>
        <View>
          <Ionicons name={on ? tab.iconActive : tab.icon} size={21} color={on ? colors.gold : colors.inkFaint} />
          {tab.key === 'teams' && !!badge && <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>}
        </View>
        <Text style={[styles.label, on && styles.labelOn]}>{tab.label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <View style={styles.bar}>
        {LEFT.map((t) => <Tab key={t.key} tab={t} />)}

        <TouchableOpacity style={styles.fabWrap} activeOpacity={0.85} onPress={() => onChange('matchup')} accessibilityRole="button" accessibilityLabel="Simulate a matchup">
          <LinearGradient colors={grad.lights} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.fab, active === 'matchup' && styles.fabOn]}>
            <Ionicons name="flash" size={22} color={colors.bg} />
          </LinearGradient>
          <Text style={[styles.label, active === 'matchup' && styles.labelOn]}>Simulate</Text>
        </TouchableOpacity>

        {RIGHT.map((t) => <Tab key={t.key} tab={t} />)}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.bgAlt, borderTopWidth: 1, borderTopColor: colors.border },
  bar: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: spacing.sm, paddingBottom: spacing.xs, paddingHorizontal: spacing.sm },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4 },
  label: { color: colors.inkFaint, fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  labelOn: { color: colors.gold },
  fabWrap: { flex: 1, alignItems: 'center', gap: 3 },
  fab: { width: 50, height: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginTop: -20, borderWidth: 3, borderColor: colors.bgAlt },
  fabOn: { borderColor: colors.gold },
  badge: { position: 'absolute', top: -5, right: -9, minWidth: 15, height: 15, borderRadius: 8, paddingHorizontal: 4, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.bg, fontSize: 9, fontWeight: '900' },
});

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/theme';

export type TabKey = 'matchup' | 'slate' | 'record' | 'teams' | 'settings';

const TABS: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'matchup', label: 'Matchup', icon: 'american-football-outline', iconActive: 'american-football' },
  { key: 'slate', label: 'Slate', icon: 'list-outline', iconActive: 'list' },
  { key: 'record', label: 'Record', icon: 'ribbon-outline', iconActive: 'ribbon' },
  { key: 'teams', label: 'Teams', icon: 'shield-outline', iconActive: 'shield' },
  { key: 'settings', label: 'Model', icon: 'options-outline', iconActive: 'options' },
];

interface Props { active: TabKey; onChange: (t: TabKey) => void; badge?: number; }

export function BottomTabBar({ active, onChange, badge }: Props) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <View style={styles.bar}>
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          return (
            <TouchableOpacity key={tab.key} style={styles.tab} activeOpacity={0.7} onPress={() => onChange(tab.key)}>
              <View>
                <Ionicons name={isActive ? tab.iconActive : tab.icon} size={22} color={isActive ? colors.gold : colors.inkFaint} />
                {tab.key === 'teams' && !!badge && (
                  <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>
                )}
              </View>
              <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.bgAlt, borderTopWidth: 1, borderTopColor: colors.border },
  bar: { flexDirection: 'row', paddingTop: spacing.sm, paddingBottom: 4 },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  label: { fontSize: 11, fontWeight: '700', color: colors.inkFaint },
  labelActive: { color: colors.gold },
  badge: { position: 'absolute', top: -4, right: -10, backgroundColor: colors.negative, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: colors.white, fontSize: 9, fontWeight: '900' },
});

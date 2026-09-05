import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing } from '@/theme';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}

export function Section({ icon, title, subtitle, right, children }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconWrap}><Ionicons name={icon} size={15} color={colors.gold} /></View>
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.title}>{title}</Text>
            {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
        </View>
        {right}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.lg, ...shadow.card },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md, gap: spacing.sm },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  iconWrap: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.goldSoft, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.ink, fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  subtitle: { color: colors.inkFaint, fontSize: 11, marginTop: 1 },
  body: {},
});

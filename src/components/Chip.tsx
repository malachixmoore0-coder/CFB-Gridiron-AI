import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '@/theme';

interface Props { label: string; active?: boolean; onPress?: () => void; color?: string; small?: boolean; }

export function Chip({ label, active, onPress, color = colors.gold, small }: Props) {
  return (
    <TouchableOpacity
      style={[styles.chip, small && styles.small, active && { backgroundColor: color, borderColor: color }]}
      onPress={onPress}
      activeOpacity={0.75}
      disabled={!onPress}
    >
      <Text style={[styles.label, small && styles.smallLabel, active && styles.labelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  small: { paddingHorizontal: 10, paddingVertical: 5 },
  label: { color: colors.inkDim, fontSize: 13, fontWeight: '700' },
  smallLabel: { fontSize: 11 },
  labelActive: { color: colors.bg },
});

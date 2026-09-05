import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/theme';

interface Props { title: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode; }

export function ScreenHeader({ title, subtitle, onBack, right }: Props) {
  return (
    <View style={styles.wrap}>
      {onBack && (
        <TouchableOpacity onPress={onBack} style={styles.back} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </TouchableOpacity>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: spacing.md },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.ink, fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  subtitle: { color: colors.inkFaint, fontSize: 12, marginTop: 2 },
});

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';

interface Props {
  label: string;
  hint?: string;
  value: number;
  step: number;
  min: number;
  max: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}

export function Stepper({ label, hint, value, step, min, max, format = (v) => String(v), onChange }: Props) {
  const dec = () => onChange(Math.max(min, Math.round((value - step) * 100) / 100));
  const inc = () => onChange(Math.min(max, Math.round((value + step) * 100) / 100));
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        {!!hint && <Text style={styles.hint}>{hint}</Text>}
      </View>
      <View style={styles.controls}>
        <TouchableOpacity style={styles.btn} onPress={dec} disabled={value <= min} hitSlop={6}>
          <Ionicons name="remove" size={16} color={value <= min ? colors.inkFaint : colors.ink} />
        </TouchableOpacity>
        <Text style={styles.value}>{format(value)}</Text>
        <TouchableOpacity style={styles.btn} onPress={inc} disabled={value >= max} hitSlop={6}>
          <Ionicons name="add" size={16} color={value >= max ? colors.inkFaint : colors.ink} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: spacing.md },
  label: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  hint: { color: colors.inkFaint, fontSize: 11, marginTop: 2 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  value: { color: colors.gold, fontWeight: '900', fontSize: 14, minWidth: 48, textAlign: 'center' },
});

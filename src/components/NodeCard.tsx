import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NodeResult } from '@/engine/types';
import { colors, radius, sideColor, spacing } from '@/theme';

interface Props { node: NodeResult; awayAbbr: string; homeAbbr: string; }

/** One weighted node: its edge, its point contribution, and the factors behind it. */
export function NodeCard({ node, awayAbbr, homeAbbr }: Props) {
  const [open, setOpen] = useState(false);
  const side = node.points > 0.15 ? 'home' : node.points < -0.15 ? 'away' : 'even';
  const width = Math.min(Math.abs(node.edge) / 10, 1) * 50;
  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.head} activeOpacity={0.7} onPress={() => setOpen((o) => !o)}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{node.label}</Text>
            <Text style={styles.weight}>{Math.round(node.weight)}%</Text>
          </View>
          <View style={styles.track}>
            <View style={styles.mid} />
            {side !== 'even' && (
              <View style={[styles.fill, side === 'home' ? { left: '50%' } : { right: '50%' }, { width: `${width}%`, backgroundColor: sideColor(side) }]} />
            )}
          </View>
          <Text style={[styles.points, { color: sideColor(side) }]}>
            {side === 'even' ? 'Even' : `${side === 'home' ? homeAbbr : awayAbbr} +${Math.abs(node.points).toFixed(1)} pts`}
          </Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.inkFaint} />
      </TouchableOpacity>
      {open && (
        <View style={styles.factors}>
          {node.factors.map((f) => (
            <View key={f.label} style={styles.factor}>
              <View style={[styles.dot, { backgroundColor: sideColor(f.favors) }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.factorLabel}>{f.label}</Text>
                <Text style={styles.factorValue}>{f.value}</Text>
              </View>
              <Text style={[styles.favors, { color: sideColor(f.favors) }]}>{f.favors === 'even' ? '—' : f.favors === 'home' ? homeAbbr : awayAbbr}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.ink, fontSize: 13, fontWeight: '800', flex: 1 },
  weight: { color: colors.gold, fontSize: 11, fontWeight: '900' },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.bg, marginTop: 8, position: 'relative', overflow: 'hidden' },
  mid: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, backgroundColor: colors.inkFaint },
  fill: { position: 'absolute', top: 0, bottom: 0, borderRadius: radius.pill },
  points: { fontSize: 11, fontWeight: '800', marginTop: 6 },
  factors: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  factor: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  factorLabel: { color: colors.inkDim, fontSize: 11, fontWeight: '700' },
  factorValue: { color: colors.inkFaint, fontSize: 11, marginTop: 1 },
  favors: { fontSize: 11, fontWeight: '900', width: 36, textAlign: 'right' },
});

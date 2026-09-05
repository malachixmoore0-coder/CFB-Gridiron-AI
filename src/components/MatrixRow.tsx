import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '@/theme';

interface Props { label: string; away: number; home: number; }

/** Mirrored 1-10 bars for one advantage-matrix axis. */
export function MatrixRow({ label, away, home }: Props) {
  const lead = home - away;
  return (
    <View style={styles.row}>
      <View style={styles.side}>
        <Text style={[styles.num, { color: colors.away }]}>{away.toFixed(1)}</Text>
        <View style={[styles.track, { flexDirection: 'row-reverse' }]}>
          <View style={[styles.fill, { width: `${away * 10}%`, backgroundColor: colors.away }]} />
        </View>
      </View>
      <View style={styles.center}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.delta, { color: Math.abs(lead) < 0.5 ? colors.inkFaint : lead > 0 ? colors.home : colors.away }]}>
          {Math.abs(lead) < 0.5 ? 'even' : `${lead > 0 ? '+' : ''}${lead.toFixed(1)}`}
        </Text>
      </View>
      <View style={styles.side}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${home * 10}%`, backgroundColor: colors.home }]} />
        </View>
        <Text style={[styles.num, { color: colors.home }]}>{home.toFixed(1)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, gap: spacing.sm },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  track: { flex: 1, height: 10, borderRadius: radius.pill, backgroundColor: colors.cardAlt, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  num: { width: 30, textAlign: 'center', fontSize: 13, fontWeight: '900' },
  center: { width: 78, alignItems: 'center' },
  label: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  delta: { fontSize: 10, fontWeight: '700', marginTop: 1 },
});

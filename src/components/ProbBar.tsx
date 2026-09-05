import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '@/theme';

interface Props { awayPct: number; homePct: number; awayAbbr: string; homeAbbr: string; height?: number; }

/** Two-tone win-probability bar: away on the left, home on the right. */
export function ProbBar({ awayPct, homePct, awayAbbr, homeAbbr, height = 14 }: Props) {
  const total = Math.max(awayPct + homePct, 1);
  return (
    <View>
      <View style={[styles.track, { height }]}>
        <View style={[styles.away, { flex: awayPct / total }]} />
        <View style={[styles.home, { flex: homePct / total }]} />
      </View>
      <View style={styles.labels}>
        <Text style={[styles.label, { color: colors.away }]}>{awayAbbr} {awayPct.toFixed(1)}%</Text>
        <Text style={[styles.label, { color: colors.home }]}>{homePct.toFixed(1)}% {homeAbbr}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: radius.pill, overflow: 'hidden', backgroundColor: colors.cardAlt },
  away: { backgroundColor: colors.away },
  home: { backgroundColor: colors.home },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  label: { fontSize: 12, fontWeight: '800' },
});

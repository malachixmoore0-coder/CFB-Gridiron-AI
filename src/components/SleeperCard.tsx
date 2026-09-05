import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { SleeperReport } from '@/engine/types';
import { colors, radius, sideColor, spacing } from '@/theme';

interface Props { sleeper: SleeperReport; abbr: string; }

export function SleeperCard({ sleeper, abbr }: Props) {
  const c = sideColor(sleeper.team);
  return (
    <View style={[styles.card, { borderLeftColor: c }]}>
      <View style={styles.top}>
        <View style={[styles.pos, { backgroundColor: c }]}><Text style={styles.posText}>{sleeper.player.pos}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{sleeper.player.name} <Text style={[styles.team, { color: c }]}>{abbr}</Text></Text>
          <Text style={styles.headline}>{sleeper.headline}</Text>
        </View>
        <View style={styles.impact}>
          <Text style={[styles.impactNum, { color: c }]}>±{sleeper.spreadImpact.toFixed(1)}</Text>
          <Text style={styles.impactLabel}>pts · {Math.round(sleeper.hitRate * 100)}% hit</Text>
        </View>
      </View>
      <Text style={styles.reason}>{sleeper.reason}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderLeftWidth: 3 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pos: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  posText: { color: colors.bg, fontWeight: '900', fontSize: 12 },
  name: { color: colors.ink, fontWeight: '800', fontSize: 14 },
  team: { fontSize: 11, fontWeight: '900' },
  headline: { color: colors.inkDim, fontSize: 12, marginTop: 1 },
  impact: { alignItems: 'flex-end' },
  impactNum: { fontSize: 17, fontWeight: '900' },
  impactLabel: { color: colors.inkFaint, fontSize: 10, fontWeight: '700' },
  reason: { color: colors.inkFaint, fontSize: 11, lineHeight: 16, marginTop: spacing.sm },
});

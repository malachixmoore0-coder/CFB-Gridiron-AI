import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { InjuryStatus, Player } from '@/engine/types';
import { INJURY_DEGRADATION } from '@/engine/weights';
import { colors, radius } from '@/theme';

interface Props { player: Player; status: InjuryStatus; overridden: boolean; onCycle: () => void; }

const STATUS: Record<InjuryStatus, { label: string; color: string }> = {
  healthy: { label: 'Active', color: colors.positive },
  questionable: { label: 'Quest.', color: colors.warning },
  out: { label: 'OUT', color: colors.negative },
};

/** Depth-chart row. Status comes from the live report; tapping cycles a manual override (Active → Questionable → Out → back to reported). */
export function PlayerRow({ player, status, overridden, onCycle }: Props) {
  const s = STATUS[status];
  const metric = player.tprr !== undefined
    ? `${Math.round((player.targetShare ?? 0) * 100)}% tgt · ${Math.round(player.tprr * 100)}% TPRR`
    : player.prwr !== undefined
      ? `${Math.round(player.prwr * 100)}% PRWR · ${Math.round(player.snapPct * 100)}% snaps`
      : player.pbwr !== undefined
        ? `${Math.round(player.pbwr * 100)}% PBWR`
        : `${Math.round(player.snapPct * 100)}% snaps`;
  return (
    <View style={[styles.row, status === 'out' && { opacity: 0.6 }]}>
      <View style={styles.pos}><Text style={styles.posText}>{player.pos}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{player.name} <Text style={styles.rating}>{player.rating}</Text></Text>
        <Text style={styles.meta}>{player.role === 'starter' ? 'Starter' : player.role === 'rotational' ? 'Rotational' : 'Depth'} · {metric}</Text>
        {!!player.note && <Text style={styles.note}>{player.note}</Text>}
        {status !== 'healthy' && (
          <Text style={[styles.impact, { color: s.color }]}>
            {player.reported && !overridden && player.reportNote ? `${player.reportNote} · ` : overridden ? 'Manual · ' : ''}
            {INJURY_DEGRADATION[player.pos].label}{status === 'questionable' ? ' (½)' : ''}
          </Text>
        )}
        {status === 'healthy' && overridden && player.reported && <Text style={[styles.impact, { color: colors.inkFaint }]}>Manually cleared (reported {player.reported})</Text>}
      </View>
      <TouchableOpacity onPress={onCycle} style={[styles.status, { borderColor: s.color }, overridden && { backgroundColor: s.color }]} activeOpacity={0.7}>
        <Text style={[styles.statusText, { color: overridden ? colors.bg : s.color }]}>{s.label}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider },
  pos: { width: 40, height: 30, borderRadius: 8, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  posText: { color: colors.inkDim, fontWeight: '900', fontSize: 11 },
  name: { color: colors.ink, fontWeight: '800', fontSize: 14 },
  rating: { color: colors.gold, fontSize: 12, fontWeight: '900' },
  meta: { color: colors.inkFaint, fontSize: 11, marginTop: 1 },
  note: { color: colors.inkDim, fontSize: 11, marginTop: 1 },
  impact: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  status: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1.5, minWidth: 64, alignItems: 'center' },
  statusText: { fontSize: 11, fontWeight: '900' },
});

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RosterPlayer, TeamRosterFile } from '@/data/liveTypes';
import type { InjuryStatus, Team } from '@/engine/types';
import { colors, radius, spacing } from '@/theme';
import { headshotOf, seasonLine } from '@/utils/roster';
import { PlayerAvatar } from './PlayerAvatar';

interface Props {
  player: RosterPlayer;
  file: TeamRosterFile | null;
  team: Team;
  status: InjuryStatus;
  overridden?: boolean;
  onPress: () => void;
  showPos?: boolean;
}

const STATUS: Record<InjuryStatus, { label: string; color: string }> = {
  healthy: { label: '', color: colors.positive },
  questionable: { label: 'Q', color: colors.warning },
  out: { label: 'OUT', color: colors.negative },
};

/** One player in a roster or depth-chart list: photo, jersey, name, grade, season line. */
export function RosterRow({ player, file, team, status, overridden, onPress, showPos }: Props) {
  const s = STATUS[status];
  const line = seasonLine(player);
  return (
    <TouchableOpacity style={[styles.row, status === 'out' && styles.dim]} activeOpacity={0.75} onPress={onPress}>
      <PlayerAvatar uri={headshotOf(player, file)} name={player.name} team={team} size={40} />
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          {player.jersey ? <Text style={styles.jersey}>#{player.jersey} </Text> : null}
          {player.name}
          {s.label ? <Text style={{ color: s.color, fontWeight: '900' }}>  {s.label}</Text> : null}
          {overridden ? <Text style={styles.manual}>  manual</Text> : null}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {showPos ? `${player.listedPos || player.pos} · ` : ''}
          {player.classLabel ? `${player.classLabel} · ` : ''}
          {line ?? (player.role === 'reserve' ? 'no stats this season' : 'no production yet')}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.rating, player.ratingBasis === 'roster' && styles.ratingSoft]}>{player.rating ?? '—'}</Text>
        <Text style={styles.ratingLabel}>grade</Text>
      </View>
      <Ionicons name="chevron-forward" size={15} color={colors.inkFaint} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  dim: { opacity: 0.55 },
  name: { color: colors.ink, fontWeight: '800', fontSize: 14 },
  jersey: { color: colors.inkFaint, fontWeight: '900', fontSize: 12 },
  manual: { color: colors.inkFaint, fontSize: 10, fontWeight: '700' },
  meta: { color: colors.inkFaint, fontSize: 11, marginTop: 2 },
  right: { alignItems: 'center', width: 34 },
  rating: { color: colors.gold, fontWeight: '900', fontSize: 15 },
  ratingSoft: { color: colors.inkDim },
  ratingLabel: { color: colors.inkFaint, fontSize: 8, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
});

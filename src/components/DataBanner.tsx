import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { timeAgo } from '@/utils/format';
import { useTeams } from '@/context/TeamsContext';

/** Freshness strip: where the data came from, when it was generated, and a manual refresh. */
export function DataBanner({ compact }: { compact?: boolean }) {
  const { source, generatedAt, season, week, phase, refreshing, lastError, refresh, meta } = useTeams();
  const live = source === 'remote' || source === 'cache' || source === 'bundled';
  const stamp = generatedAt ? timeAgo(Date.parse(generatedAt)) : 'n/a';
  const label = source === 'sample' ? 'Sample data' : source === 'bundled' ? 'Live data (bundled)' : source === 'cache' ? 'Live data (cached)' : 'Live data';
  const gp = meta?.blend ? `${meta.blend.gamesPlayedMax} gp` : '';
  return (
    <View style={[styles.wrap, !live && styles.warn]}>
      <View style={[styles.dot, { backgroundColor: live ? colors.positive : colors.warning }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{label} · updated {stamp}</Text>
        {!compact && (
          <Text style={styles.sub}>
            {season} {phase} · week {week}{gp ? ` · ${gp}` : ''}
            {meta?.blend ? ` · ${Math.round(meta.blend.currentWeightMax * 100)}% current season / ${Math.round((1 - meta.blend.currentWeightMax) * 100)}% ${meta.priorSeason} priors` : ''}
            {lastError ? ` · refresh failed: ${lastError}` : ''}
          </Text>
        )}
      </View>
      <TouchableOpacity onPress={refresh} disabled={refreshing} style={styles.btn} hitSlop={6}>
        {refreshing ? <ActivityIndicator size="small" color={colors.ink} /> : <Ionicons name="refresh" size={16} color={colors.ink} />}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 10, marginBottom: spacing.md },
  warn: { borderColor: colors.warning },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  sub: { color: colors.inkFaint, fontSize: 11, marginTop: 1 },
  btn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
});

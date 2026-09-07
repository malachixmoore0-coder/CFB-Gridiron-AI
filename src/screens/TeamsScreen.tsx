import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTeams } from '@/context/TeamsContext';
import { DataBanner } from '@/components/DataBanner';
import { colors, radius, spacing } from '@/theme';
import { useSettings } from '@/context/SettingsContext';
import { TeamMark } from '@/components/TeamMark';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useEngagement } from '@/context/EngagementContext';
import { useEntitlements } from '@/context/EntitlementsContext';
import { Chip } from '@/components/Chip';
import { CONFERENCE_SHORT } from '@/data/teams';
import type { Team } from '@/engine/types';

interface Props { onOpenTeam: (id: string) => void; onUpgrade?: () => void; }

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function TeamsScreen({ onOpenTeam, onUpgrade }: Props) {
  const eng = useEngagement();
  const ent = useEntitlements();
  const { overrides, clearOverrides, statusOf } = useSettings();
  const { conferences, ranked, teams, poll } = useTeams();
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'conference' | 'ranked'>('conference');
  const flaggedCount = Object.keys(overrides).length;
  const q = norm(query.trim());
  const matches = useMemo(() => (q ? teams.filter((t) => norm(`${t.school} ${t.mascot} ${t.abbr} ${t.conference}`).includes(q)).sort((a, b) => a.school.localeCompare(b.school)) : null), [q, teams]);

  const row = (t: Team, i?: number) => {
    const flags = t.players.filter((p) => statusOf(p) !== 'healthy').length;
    return (
      <TouchableOpacity key={t.id} style={styles.row} activeOpacity={0.75} onPress={() => onOpenTeam(t.id)}>
        {i !== undefined && <Text style={styles.rankNum}>{t.rank ? `#${t.rank}` : i + 1}</Text>}
        <TeamMark team={t} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{i === undefined && t.rank ? `#${t.rank} ` : ''}{t.school} <Text style={styles.mascot}>{t.mascot}</Text>{t.record ? <Text style={styles.record}>  {t.record}</Text> : null}</Text>
          <Text style={styles.meta} numberOfLines={1}>{t.coaching.offScheme} · {t.coaching.defFront} / {t.coaching.baseCoverage}{i !== undefined || q ? ` · ${CONFERENCE_SHORT[t.conference]}` : ''}{t.elo ? ` · Elo ${Math.round(t.elo)}` : ''}</Text>
        </View>
        {flags > 0 && <View style={styles.flag}><Text style={styles.flagText}>{flags}</Text></View>}
        <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader
        title="Teams"
        subtitle={`${teams.length} FBS programs · live scheme profiles, unit grades & depth charts`}
        right={flaggedCount > 0 ? (
          <TouchableOpacity style={styles.clear} onPress={clearOverrides}>
            <Text style={styles.clearText}>Reset {flaggedCount} override{flaggedCount === 1 ? '' : 's'}</Text>
          </TouchableOpacity>
        ) : undefined}
      />
      <View style={styles.search}>
        <Ionicons name="search" size={16} color={colors.inkFaint} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search school, mascot or conference" placeholderTextColor={colors.inkFaint} style={styles.input} autoCorrect={false} autoCapitalize="none" />
        {!!query && <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}><Ionicons name="close-circle" size={16} color={colors.inkFaint} /></TouchableOpacity>}
      </View>
      {!q && (
        <View style={styles.toggle}>
          <Chip label="By conference" active={view === 'conference'} onPress={() => setView('conference')} small />
          <Chip label={poll ? `${poll} / Elo` : 'By Elo'} active={view === 'ranked'} onPress={() => setView('ranked')} small />
        </View>
      )}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <DataBanner compact />
        {matches ? (
          <View style={styles.conference}>
            <Text style={styles.conferenceTitle}>{matches.length} match{matches.length === 1 ? '' : 'es'}</Text>
            {matches.map((t) => row(t))}
          </View>
        ) : view === 'ranked' ? (
          <View style={styles.conference}>
            <Text style={styles.conferenceTitle}>{poll ? `${poll}, then Elo` : 'Ordered by Elo'}</Text>
            {ranked.slice(0, 40).map((t, i) => row(t, i))}
          </View>
        ) : (
          conferences.map((c) => (
            <View key={c.conference} style={styles.conference}>
              <Text style={styles.conferenceTitle}>{c.conference} · {c.teams.length}</Text>
              {c.teams.map((t) => row(t))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  clear: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.negative },
  clearText: { color: colors.negative, fontWeight: '800', fontSize: 12 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: spacing.lg, marginBottom: spacing.sm, paddingHorizontal: spacing.md, height: 42, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  input: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: '600', paddingVertical: 0 },
  toggle: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  conference: { marginBottom: spacing.lg },
  conferenceTitle: { color: colors.inkFaint, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  rankNum: { color: colors.gold, fontWeight: '900', fontSize: 12, width: 28, textAlign: 'center' },
  name: { color: colors.ink, fontWeight: '800', fontSize: 14 },
  mascot: { color: colors.inkDim, fontWeight: '600', fontSize: 12 },
  record: { color: colors.inkFaint, fontWeight: '700', fontSize: 12 },
  meta: { color: colors.inkFaint, fontSize: 11, marginTop: 2 },
  flag: { backgroundColor: colors.negative, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  flagText: { color: colors.white, fontWeight: '900', fontSize: 10 },
});

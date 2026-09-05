import React, { useMemo, useState } from 'react';
import { Modal, View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Team } from '@/engine/types';
import { useTeams } from '@/context/TeamsContext';
import { CONFERENCE_SHORT } from '@/data/teams';
import { colors, radius, spacing } from '@/theme';
import { TeamMark } from './TeamMark';

interface Props {
  visible: boolean;
  title: string;
  selectedId?: string;
  excludeId?: string;
  onSelect: (team: Team) => void;
  onClose: () => void;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Full-screen picker: search box on top, then every FBS team grouped by conference. */
export function TeamPickerModal({ visible, title, selectedId, excludeId, onSelect, onClose }: Props) {
  const { conferences, teams } = useTeams();
  const [query, setQuery] = useState('');
  const q = norm(query.trim());
  const matches = useMemo(() => {
    if (!q) return null;
    return teams
      .filter((t) => norm(`${t.school} ${t.mascot} ${t.abbr} ${t.conference}`).includes(q))
      .sort((a, b) => (norm(a.school).startsWith(q) ? 0 : 1) - (norm(b.school).startsWith(q) ? 0 : 1) || a.school.localeCompare(b.school));
  }, [q, teams]);
  const close = () => { setQuery(''); onClose(); };
  const pick = (t: Team) => { onSelect(t); close(); };

  const cell = (t: Team) => {
    const disabled = t.id === excludeId;
    const selected = t.id === selectedId;
    return (
      <TouchableOpacity key={t.id} style={[styles.cell, selected && styles.cellSelected, disabled && styles.cellDisabled]} disabled={disabled} activeOpacity={0.7} onPress={() => pick(t)}>
        <TeamMark team={t} size={40} />
        <Text style={styles.cellText} numberOfLines={1}>{t.rank ? `#${t.rank} ` : ''}{t.school}</Text>
        <Text style={styles.cellSub} numberOfLines={1}>{t.record ? `${t.record} · ` : ''}{CONFERENCE_SHORT[t.conference]}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} presentationStyle="pageSheet">
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={close} style={styles.close} hitSlop={8}>
            <Ionicons name="close" size={20} color={colors.ink} />
          </TouchableOpacity>
        </View>
        <View style={styles.search}>
          <Ionicons name="search" size={16} color={colors.inkFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search 130+ FBS teams"
            placeholderTextColor={colors.inkFaint}
            style={styles.input}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => { if (matches?.length && matches[0].id !== excludeId) pick(matches[0]); }}
          />
          {!!query && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}><Ionicons name="close-circle" size={16} color={colors.inkFaint} /></TouchableOpacity>
          )}
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {matches ? (
            <View style={styles.grid}>
              {matches.length === 0 && <Text style={styles.empty}>No team matches “{query}”.</Text>}
              {matches.map(cell)}
            </View>
          ) : (
            conferences.map((c) => (
              <View key={c.conference} style={styles.conference}>
                <Text style={styles.conferenceTitle}>{c.conference} · {c.teams.length}</Text>
                <View style={styles.grid}>{c.teams.map(cell)}</View>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: spacing.lg, marginBottom: spacing.md, paddingHorizontal: spacing.md, height: 42, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  input: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: '600', paddingVertical: 0 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  conference: { marginBottom: spacing.lg },
  conferenceTitle: { color: colors.inkFaint, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { width: '31%', flexGrow: 1, alignItems: 'center', gap: 4, paddingVertical: spacing.md, paddingHorizontal: 4, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  cellSelected: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  cellDisabled: { opacity: 0.3 },
  cellText: { color: colors.ink, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  cellSub: { color: colors.inkFaint, fontSize: 10, fontWeight: '700' },
  empty: { color: colors.inkFaint, fontSize: 13, padding: spacing.md },
});

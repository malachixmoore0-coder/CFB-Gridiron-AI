import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '@/theme';
import { useSettings } from '@/context/SettingsContext';
import type { RunRequest } from '@/hooks/useAnalysis';
import { BottomTabBar, TabKey } from '@/components/BottomTabBar';
import { MatchupScreen } from '@/screens/MatchupScreen';
import { ResultScreen } from '@/screens/ResultScreen';
import { SlateScreen } from '@/screens/SlateScreen';
import { TeamsScreen } from '@/screens/TeamsScreen';
import { TeamDetailScreen } from '@/screens/TeamDetailScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { OnboardingScreen } from '@/screens/OnboardingScreen';

type Overlay = { kind: 'result'; request: RunRequest } | { kind: 'team'; teamId: string };

/** Hand-rolled navigation: four tabs plus a small overlay stack (result / team detail). */
export function RootNavigator() {
  const { loaded, onboarded, overrides } = useSettings();
  const [tab, setTab] = useState<TabKey>('matchup');
  const [stack, setStack] = useState<Overlay[]>([]);

  if (!loaded) return <View style={styles.root} />;
  if (!onboarded) return <OnboardingScreen onDone={() => {}} />;

  const push = (o: Overlay) => setStack((s) => [...s, o]);
  const pop = () => setStack((s) => s.slice(0, -1));
  const openTeam = (teamId: string) => push({ kind: 'team', teamId });
  const run = (request: RunRequest) => push({ kind: 'result', request });

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        {tab === 'matchup' && <MatchupScreen onRun={run} onOpenTeam={openTeam} />}
        {tab === 'slate' && <SlateScreen onRun={run} />}
        {tab === 'teams' && <TeamsScreen onOpenTeam={openTeam} />}
        {tab === 'settings' && <SettingsScreen />}
      </View>
      <BottomTabBar active={tab} onChange={(t) => { setStack([]); setTab(t); }} badge={Object.keys(overrides).length} />

      {stack.map((o, i) => (
        <View key={`${o.kind}-${i}`} style={[StyleSheet.absoluteFill, styles.overlay]}>
          {o.kind === 'result'
            ? <ResultScreen request={o.request} onBack={pop} onOpenTeam={openTeam} />
            : <TeamDetailScreen teamId={o.teamId} onBack={pop} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1 },
  overlay: { backgroundColor: colors.bg },
});

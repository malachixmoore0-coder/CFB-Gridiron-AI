import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '@/theme';
import { useSettings } from '@/context/SettingsContext';
import { useEntitlements } from '@/context/EntitlementsContext';
import type { RunRequest } from '@/hooks/useAnalysis';
import { BottomTabBar, TabKey } from '@/components/BottomTabBar';
import { MatchupScreen } from '@/screens/MatchupScreen';
import { ResultScreen } from '@/screens/ResultScreen';
import { SlateScreen } from '@/screens/SlateScreen';
import { RecordScreen } from '@/screens/RecordScreen';
import { TeamsScreen } from '@/screens/TeamsScreen';
import { TeamDetailScreen } from '@/screens/TeamDetailScreen';
import { PlayerProfileScreen } from '@/screens/PlayerProfileScreen';
import { GameStatsScreen } from '@/screens/GameStatsScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { CardScreen } from '@/screens/CardScreen';
import { ParlayScreen } from '@/screens/ParlayScreen';
import { UpgradeScreen } from '@/screens/UpgradeScreen';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { OnboardingScreen } from '@/screens/OnboardingScreen';

type Overlay =
  | { kind: 'result'; request: RunRequest }
  | { kind: 'team'; teamId: string }
  | { kind: 'player'; teamId: string; playerId: string }
  | { kind: 'game'; teamId: string; gameId: string }
  | { kind: 'card' }
  | { kind: 'parlay' }
  | { kind: 'upgrade' }
  | { kind: 'model' };

/**
 * Hand-rolled navigation: four tabs, one raised action, and an overlay stack.
 * The paid surfaces (Card, Parlay Lab, Upgrade) are overlays rather than tabs
 * so the dock stays about football and the upsell stays contextual.
 */
export function RootNavigator() {
  const { loaded, onboarded, overrides } = useSettings();
  const ent = useEntitlements();
  const [tab, setTab] = useState<TabKey>('home');
  const [stack, setStack] = useState<Overlay[]>([]);

  if (!loaded || !ent.loaded) return <View style={styles.root} />;
  if (!onboarded) return <OnboardingScreen onDone={() => {}} />;

  const push = (o: Overlay) => setStack((s) => [...s, o]);
  const pop = () => setStack((s) => s.slice(0, -1));
  const openTeam = (teamId: string) => push({ kind: 'team', teamId });
  const openPlayer = (teamId: string, playerId: string) => push({ kind: 'player', teamId, playerId });
  const openGame = (teamId: string, gameId: string) => push({ kind: 'game', teamId, gameId });
  const openUpgrade = () => push({ kind: 'upgrade' });
  const run = (request: RunRequest) => {
    // The free meter is spent here, at the one door every simulation goes through.
    if (!ent.spendSim()) { openUpgrade(); return; }
    push({ kind: 'result', request });
  };

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        {tab === 'home' && (
          <HomeScreen
            onRun={run}
            onOpenGame={openGame}
            onOpenTeam={openTeam}
            onUpgrade={openUpgrade}
            onOpenCard={() => push({ kind: 'card' })}
            onOpenParlay={() => push({ kind: 'parlay' })}
            onOpenModel={() => push({ kind: 'model' })}
          />
        )}
        {tab === 'matchup' && <MatchupScreen onRun={run} onOpenTeam={openTeam} />}
        {tab === 'slate' && <SlateScreen onRun={run} />}
        {tab === 'record' && <RecordScreen onRun={run} onUpgrade={openUpgrade} />}
        {tab === 'teams' && <TeamsScreen onOpenTeam={openTeam} onUpgrade={openUpgrade} />}
      </View>

      <BottomTabBar active={tab} onChange={(t) => { setStack([]); setTab(t); }} badge={Object.keys(overrides).length} />

      {stack.map((o, i) => (
        <View key={`${o.kind}-${i}`} style={[StyleSheet.absoluteFill, styles.overlay]}>
          <ErrorBoundary onBack={pop}>
            {o.kind === 'result' ? (
              <ResultScreen request={o.request} onBack={pop} onOpenTeam={openTeam} />
            ) : o.kind === 'team' ? (
              <TeamDetailScreen teamId={o.teamId} onBack={pop} onOpenPlayer={openPlayer} onOpenTeam={openTeam} onOpenGame={openGame} />
            ) : o.kind === 'game' ? (
              <GameStatsScreen teamId={o.teamId} gameId={o.gameId} onBack={pop} onOpenPlayer={openPlayer} onOpenTeam={openTeam} onRun={run} />
            ) : o.kind === 'card' ? (
              <CardScreen onUpgrade={openUpgrade} onOpenGame={openGame} />
            ) : o.kind === 'parlay' ? (
              <ParlayScreen onBack={pop} onUpgrade={openUpgrade} />
            ) : o.kind === 'upgrade' ? (
              <UpgradeScreen onBack={pop} />
            ) : o.kind === 'model' ? (
              <SettingsScreen onBack={pop} onUpgrade={openUpgrade} onOpenCard={() => push({ kind: 'card' })} />
            ) : (
              <PlayerProfileScreen teamId={o.teamId} playerId={o.playerId} onBack={pop} onOpenTeam={openTeam} onUpgrade={openUpgrade} />
            )}
          </ErrorBoundary>
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

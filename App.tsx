import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SettingsProvider } from '@/context/SettingsContext';
import { TeamsProvider } from '@/context/TeamsContext';
import { EntitlementsProvider } from '@/context/EntitlementsContext';
import { EngagementProvider } from '@/context/EngagementContext';
import { RootNavigator } from '@/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <TeamsProvider>
          <EntitlementsProvider>
            <EngagementProvider>
              <StatusBar style="light" />
              <RootNavigator />
            </EngagementProvider>
          </EntitlementsProvider>
        </TeamsProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

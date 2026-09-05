import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SettingsProvider } from '@/context/SettingsContext';
import { TeamsProvider } from '@/context/TeamsContext';
import { RootNavigator } from '@/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <TeamsProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </TeamsProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

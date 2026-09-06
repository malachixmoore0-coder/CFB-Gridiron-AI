import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';

interface Props { children: React.ReactNode; onBack?: () => void; }
interface State { error: Error | null; }

/**
 * Keeps one bad screen from taking the whole app down. Without this a render
 * error anywhere in an overlay leaves the user staring at a blank app with no
 * way back.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Screen error:', error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <View style={styles.root}>
        <Ionicons name="warning" size={30} color={colors.warning} />
        <Text style={styles.title}>This screen hit a problem</Text>
        <Text style={styles.detail}>{error.message || 'Unknown error'}</Text>
        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} onPress={() => this.setState({ error: null })}>
            <Text style={styles.btnText}>Try again</Text>
          </TouchableOpacity>
          {!!this.props.onBack && (
            <TouchableOpacity style={styles.btn} onPress={() => { this.setState({ error: null }); this.props.onBack?.(); }}>
              <Text style={styles.btnText}>Go back</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.bg },
  title: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  detail: { color: colors.inkFaint, fontSize: 12, textAlign: 'center', lineHeight: 17 },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  btn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  btnText: { color: colors.ink, fontWeight: '800', fontSize: 13 },
});

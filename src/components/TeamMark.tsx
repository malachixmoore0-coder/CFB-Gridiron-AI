import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import type { Team } from '@/engine/types';
import { colors } from '@/theme';

interface Props { team: Team; size?: number; }

/** School logo when the dataset supplies one, otherwise a colour-block badge with the abbreviation. Logos sit on a white disc so dark marks stay legible. */
export function TeamMark({ team, size = 44 }: Props) {
  const [failed, setFailed] = useState(false);
  if (team.logoUrl && !failed) {
    return (
      <View style={[styles.logoWrap, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.white, borderColor: team.colors.primary }]}>
        <Image source={{ uri: team.logoUrl }} style={{ width: size * 0.74, height: size * 0.74 }} resizeMode="contain" onError={() => setFailed(true)} />
      </View>
    );
  }
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2, backgroundColor: team.colors.primary, borderColor: team.colors.secondary }]}>
      <Text style={[styles.abbr, { fontSize: size * 0.32 }]}>{team.abbr}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', borderWidth: 2.5 },
  logoWrap: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2 },
  abbr: { color: colors.white, fontWeight: '900', letterSpacing: 0.5, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3 },
});

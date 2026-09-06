import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import type { Team } from '@/engine/types';
import { colors } from '@/theme';
import { initialsOf } from '@/utils/roster';

interface Props { uri: string | null; name: string; team?: Team; size?: number; }

/**
 * Player headshot. Many college athletes have no photo on file, so a missing
 * or broken image falls back to initials on the team's colour rather than a
 * placeholder face.
 */
export function PlayerAvatar({ uri, name, team, size = 44 }: Props) {
  const [failed, setFailed] = useState(false);
  const bg = team?.colors.primary ?? colors.cardAlt;
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, borderColor: team?.colors.secondary ?? colors.border }]}>
      {uri && !failed ? (
        <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" onError={() => setFailed(true)} />
      ) : (
        <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{initialsOf(name)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1.5 },
  initials: { color: colors.white, fontWeight: '900', letterSpacing: 0.5, textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 3 },
});

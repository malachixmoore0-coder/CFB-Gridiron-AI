/**
 * The tape. A continuously scrolling strip of what the model is looking at
 * right now — live scores first, then the biggest edges on the board.
 *
 * It exists for one reason: an app that is visibly *doing something* the moment
 * it opens gets a second look. The animation is a single translateX loop, so it
 * costs one driver and nothing per item.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, numeric, radius, spacing } from '@/theme';

export interface TickerItem { key: string; left: string; right: string; tone: 'live' | 'money' | 'flat'; onPress?: () => void }

const SPEED = 42; // px per second — slow enough to read at a glance

export function Ticker({ items }: { items: TickerItem[] }) {
  const x = useRef(new Animated.Value(0)).current;
  const [w, setW] = useState(0);
  const doubled = useMemo(() => [...items, ...items], [items]);

  useEffect(() => {
    if (!w) return;
    x.setValue(0);
    const anim = Animated.loop(
      Animated.timing(x, { toValue: -w, duration: (w / SPEED) * 1000, easing: Easing.linear, useNativeDriver: true }),
    );
    anim.start();
    return () => anim.stop();
  }, [w, x]);

  if (!items.length) return null;

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.row, { transform: [{ translateX: x }] }]}>
        <View style={styles.row} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
          {items.map((it) => <Cell key={it.key} item={it} />)}
        </View>
        <View style={styles.row}>
          {items.map((it) => <Cell key={`${it.key}-b`} item={it} />)}
        </View>
      </Animated.View>
    </View>
  );
}

function Cell({ item }: { item: TickerItem }) {
  const tone = item.tone === 'live' ? colors.live : item.tone === 'money' ? colors.green : colors.inkDim;
  return (
    <TouchableOpacity style={styles.cell} activeOpacity={0.75} onPress={item.onPress} disabled={!item.onPress}>
      {item.tone === 'live' && <View style={styles.dot} />}
      <Text style={styles.left}>{item.left}</Text>
      <Text style={[styles.right, numeric, { color: tone }]}>{item.right}</Text>
      <Ionicons name="ellipse" size={3} color={colors.inkGhost} style={{ marginHorizontal: 6 }} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 30, overflow: 'hidden', borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: colors.bgAlt, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  cell: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xs, gap: 6 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.live },
  left: { color: colors.inkFaint, fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  right: { fontSize: 11, fontWeight: '900' },
});

/**
 * The furniture of the paid product: tier pills, the free meter, streaks, the
 * conviction read-out, and the lock that sits on top of a premium surface.
 *
 * The lock is deliberately not a blank wall. It shows the shape of what is
 * behind it — the row heights, the number of items, a blurred hint of the value
 * — because a wall people can see through converts, and a wall they cannot
 * just reads as a broken screen.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, grad, radius, spacing, numeric } from '@/theme';
import type { Tier } from '@/monetize/tiers';

const accentOf = (a: Tier['accent']) =>
  a === 'green' ? colors.green : a === 'gold' ? colors.gold : a === 'platinum' ? '#D9E2EC' : colors.inkDim;

export function TierPill({ tier, trial, onPress }: { tier: Tier; trial?: number; onPress?: () => void }) {
  const c = accentOf(tier.accent);
  return (
    <TouchableOpacity style={[styles.tierPill, { borderColor: c }]} activeOpacity={0.8} onPress={onPress} disabled={!onPress}>
      <Ionicons name={tier.accent === 'ink' ? 'person-outline' : 'flash'} size={11} color={c} />
      <Text style={[styles.tierText, { color: c }]}>{trial ? `${tier.name} · ${trial}d left` : tier.name}</Text>
    </TouchableOpacity>
  );
}

export function LockChip({ label = 'PRO', onPress }: { label?: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.lockChip} activeOpacity={0.8} onPress={onPress} disabled={!onPress}>
      <Ionicons name="lock-closed" size={9} color={colors.gold} />
      <Text style={styles.lockChipText}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Sims left on the free meter. Disappears entirely once the meter is gone. */
export function MeterPill({ left, onPress }: { left: number; onPress?: () => void }) {
  if (left === Infinity) return null;
  const out = left <= 0;
  return (
    <TouchableOpacity style={[styles.meter, out && styles.meterOut]} activeOpacity={0.8} onPress={onPress}>
      <Ionicons name={out ? 'battery-dead' : 'flash-outline'} size={11} color={out ? colors.negative : colors.inkDim} />
      <Text style={[styles.meterText, out && { color: colors.negative }]}>
        {out ? 'Out of sims' : `${left} sim${left === 1 ? '' : 's'} left today`}
      </Text>
    </TouchableOpacity>
  );
}

export function StreakPill({ days, onPress }: { days: number; onPress?: () => void }) {
  if (days <= 0) return null;
  return (
    <TouchableOpacity style={styles.streak} activeOpacity={0.8} onPress={onPress} disabled={!onPress}>
      <Ionicons name="flame" size={12} color={colors.gold} />
      <Text style={styles.streakText}>{days}</Text>
    </TouchableOpacity>
  );
}

/**
 * Conviction, 0-100, as ten segments. A ring would need SVG; ten blocks read
 * faster on a phone anyway and degrade gracefully at any width.
 */
export function ConvictionBar({ value, width = 84 }: { value: number; width?: number }) {
  const lit = Math.round((Math.max(0, Math.min(100, value)) / 100) * 10);
  const c = value >= 70 ? colors.green : value >= 45 ? colors.gold : colors.inkGhost;
  return (
    <View style={[styles.conv, { width }]}>
      {Array.from({ length: 10 }, (_, i) => (
        <View key={i} style={[styles.convSeg, { backgroundColor: i < lit ? c : colors.cardAlt }]} />
      ))}
    </View>
  );
}

/** A number that should read as money. */
export function Money({ value, suffix = '', size = 15 }: { value: number; suffix?: string; size?: number }) {
  const good = value > 0;
  return (
    <Text style={[numeric, { fontSize: size, fontWeight: '800', color: good ? colors.green : value < 0 ? colors.negative : colors.inkDim }]}>
      {good ? '+' : ''}{value.toFixed(1)}{suffix}
    </Text>
  );
}

interface LockedProps {
  title: string;
  blurb: string;
  cta: string;
  onPress: () => void;
  /** Rendered behind the lock at low opacity so the value is visible. */
  preview?: React.ReactNode;
  style?: ViewStyle;
}

export function Locked({ title, blurb, cta, onPress, preview, style }: LockedProps) {
  return (
    <View style={[styles.lockedWrap, style]}>
      {!!preview && <View style={styles.lockedPreview} pointerEvents="none">{preview}</View>}
      <LinearGradient colors={grad.fade} style={StyleSheet.absoluteFill as ViewStyle} pointerEvents="none" />
      <View style={styles.lockedBody}>
        <View style={styles.lockedIcon}><Ionicons name="lock-closed" size={16} color={colors.gold} /></View>
        <Text style={styles.lockedTitle}>{title}</Text>
        <Text style={styles.lockedBlurb}>{blurb}</Text>
        <TouchableOpacity style={styles.lockedCta} activeOpacity={0.85} onPress={onPress}>
          <LinearGradient colors={grad.lights} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.lockedCtaBg}>
            <Text style={styles.lockedCtaText}>{cta}</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.bg} />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tierPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, backgroundColor: colors.cardAlt },
  tierText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' },

  lockChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: radius.sm, backgroundColor: colors.goldSoft },
  lockChipText: { color: colors.gold, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },

  meter: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  meterOut: { borderColor: colors.negative, backgroundColor: colors.negativeSoft },
  meterText: { color: colors.inkDim, fontSize: 10, fontWeight: '800' },

  streak: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.goldSoft },
  streakText: { color: colors.gold, fontSize: 11, fontWeight: '900' },

  conv: { flexDirection: 'row', gap: 2 },
  convSeg: { flex: 1, height: 5, borderRadius: 2 },

  lockedWrap: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  lockedPreview: { opacity: 0.16 },
  lockedBody: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: 6 },
  lockedIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.goldSoft, alignItems: 'center', justifyContent: 'center' },
  lockedTitle: { color: colors.ink, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  lockedBlurb: { color: colors.inkDim, fontSize: 12, textAlign: 'center', lineHeight: 17, maxWidth: 300 },
  lockedCta: { marginTop: 6, borderRadius: radius.pill, overflow: 'hidden' },
  lockedCtaBg: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.lg, paddingVertical: 9 },
  lockedCtaText: { color: colors.bg, fontSize: 13, fontWeight: '900' },
});

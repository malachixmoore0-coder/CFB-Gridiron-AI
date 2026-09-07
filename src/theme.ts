/**
 * CFB Gridiron AI — "Blackout Saturday" design system.
 *
 * Deliberately not the NFL app. College football is 12 hours of noise, 134
 * programs and a poll that moves every week, so this one is built like a
 * gameday program printed on black stock:
 *
 * 1. Warm black ground (#0A0806). A stadium under lights is warm, not blue.
 *    The warm ground also separates the two products at a glance on a home
 *    screen — nobody should confuse which app they opened.
 * 2. Amber is the house colour. Stadium light, brass, the trophy. It carries
 *    identity, headings and the poll.
 * 3. Emerald is money — and only money. Edge, profit, wins. Keeping green
 *    meaning the same thing in both apps is the one shared law, because green
 *    is the colour a bettor's brain has already been trained on.
 *
 * Geometry differs too: ticket-stub cards with tight corners and rules instead
 * of the NFL app's soft trading-card radii, and a serif display face on web so
 * headlines read like a program cover rather than a terminal.
 */
import { Platform } from 'react-native';

export const colors = {
  /* ground — warm blacks */
  bg: '#0A0806',
  bgAlt: '#0F0C08',
  bgLift: '#14100A',
  card: '#17120B',
  cardAlt: '#1E1710',
  cardHi: '#241C12',
  border: '#2A2116',
  borderHi: '#3B2F1E',
  divider: '#1F1810',

  /* ink — warm paper */
  ink: '#F6EFE2',
  inkDim: '#B5A68A',
  inkFaint: '#7A6C56',
  inkGhost: '#4E4436',

  /* house */
  gold: '#FFB020',
  goldBright: '#FFD166',
  goldDim: '#C98914',
  goldSoft: 'rgba(255, 176, 32, 0.14)',
  goldGlow: 'rgba(255, 176, 32, 0.32)',

  /* money */
  green: '#2FD37A',
  greenDim: '#1FA65D',
  greenSoft: 'rgba(47, 211, 122, 0.14)',
  greenGlow: 'rgba(47, 211, 122, 0.28)',

  /* sides */
  home: '#2FD37A',
  homeSoft: 'rgba(47, 211, 122, 0.14)',
  away: '#FF8A3D',
  awaySoft: 'rgba(255, 138, 61, 0.14)',

  /* signal */
  positive: '#2FD37A',
  negative: '#E5484D',
  negativeSoft: 'rgba(229, 72, 77, 0.14)',
  warning: '#FFB020',
  live: '#FF4A4A',
  liveSoft: 'rgba(255, 74, 74, 0.16)',

  turf: '#1C5B36',
  white: '#FFFFFF',
  overlay: 'rgba(8, 6, 4, 0.84)',
  scrim: 'rgba(8, 6, 4, 0.55)',
};

/** Gradients for the hero surfaces — lamp-light falloff, not neon. */
export const grad = {
  night: ['#1A140C', '#100C07', '#0A0806'] as const,
  lights: ['#FFD166', '#FFB020', '#C98914'] as const,
  money: ['#2FD37A', '#1FA65D'] as const,
  edge: ['rgba(47,211,122,0.20)', 'rgba(47,211,122,0.02)'] as const,
  fade: ['rgba(10,8,6,0)', '#0A0806'] as const,
  tier: ['#1E1710', '#12100A'] as const,
};

/**
 * Serif display on web: a program cover, not a terminal. Numbers still get a
 * tabular stack so a scoreboard never jitters.
 */
export const fonts = {
  display: Platform.select({
    web: '"Playfair Display", Georgia, "Times New Roman", "Iowan Old Style", serif',
    default: Platform.OS === 'ios' ? 'Georgia' : undefined,
  }),
  mono: Platform.select({
    web: '"SF Mono", "JetBrains Mono", "Roboto Mono", ui-monospace, monospace',
    default: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  }),
};

export const numeric = {
  fontFamily: fonts.mono,
  fontVariant: ['tabular-nums'] as ('tabular-nums')[],
};

export const type = {
  hero: { fontSize: 42, fontWeight: '700' as const, letterSpacing: -0.8, fontFamily: fonts.display },
  title: { fontSize: 25, fontWeight: '700' as const, letterSpacing: -0.3, fontFamily: fonts.display },
  section: { fontSize: 17, fontWeight: '700' as const, letterSpacing: -0.1, fontFamily: fonts.display },
  body: { fontSize: 14, fontWeight: '600' as const },
  small: { fontSize: 12, fontWeight: '600' as const },
  micro: { fontSize: 10, fontWeight: '800' as const, letterSpacing: 1.4, textTransform: 'uppercase' as const },
};

/* Ticket-stub geometry: tighter than the NFL app on purpose. */
export const radius = { sm: 6, md: 9, lg: 13, xl: 18, xxl: 22, pill: 999 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const shadow = {
  card: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 18, elevation: 6 },
  lift: { shadowColor: '#000', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.6, shadowRadius: 32, elevation: 12 },
  money: { shadowColor: '#2FD37A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 },
};

export const sideColor = (side: 'home' | 'away' | 'even') =>
  side === 'home' ? colors.home : side === 'away' ? colors.away : colors.inkFaint;

/** Rating 1-10 → colour band. */
export function ratingColor(v: number): string {
  if (v >= 7.5) return colors.positive;
  if (v >= 5.5) return colors.gold;
  if (v >= 4) return colors.away;
  return colors.negative;
}

/** Edge in points → the colour it earns. Only a real edge gets to be green. */
export function edgeColor(pts: number): string {
  const a = Math.abs(pts);
  if (a >= 3.5) return colors.green;
  if (a >= 1.75) return colors.gold;
  return colors.inkDim;
}

/**
 * Gridiron AI design tokens — a dark "broadcast graphics" palette: deep navy
 * field, chalk-white ink, turf green for the home side, ember orange for the
 * road side and a gold accent for headline numbers.
 */
export const colors = {
  bg: '#0B1220',
  bgAlt: '#0F1729',
  card: '#141E33',
  cardAlt: '#1A2540',
  border: '#22304D',
  divider: '#1B2640',

  ink: '#F2F5FA',
  inkDim: '#A3B0C9',
  inkFaint: '#6C7A96',

  gold: '#F5B700',
  goldSoft: 'rgba(245, 183, 0, 0.16)',

  home: '#2ED47A',
  homeSoft: 'rgba(46, 212, 122, 0.16)',
  away: '#FF7A45',
  awaySoft: 'rgba(255, 122, 69, 0.16)',

  turf: '#1F7A4D',
  positive: '#2ED47A',
  negative: '#FF5C5C',
  warning: '#F5B700',

  white: '#FFFFFF',
  overlay: 'rgba(5, 9, 18, 0.7)',
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 26, pill: 999 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 4,
  },
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

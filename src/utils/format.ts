export const pct1 = (v: number) => `${v.toFixed(1)}%`;
export const pct0 = (v: number) => `${Math.round(v)}%`;
/** Sportsbook-style line for the favourite: callers pass the favourite's abbreviation. */
export const spreadText = (favAbbr: string, spread: number) => {
  // spread is away - home; negative means home favoured. Either way the favourite lays points.
  if (Math.abs(spread) < 0.25) return 'PK';
  return `${favAbbr} -${Math.abs(spread).toFixed(1).replace(/\.0$/, '')}`;
};
export const signed1 = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`;
export const oneDp = (v: number) => v.toFixed(1).replace(/\.0$/, '');
export const timeAgo = (epochMs: number) => {
  const m = Math.round((Date.now() - epochMs) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

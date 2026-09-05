export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const clamp10 = (v: number) => clamp(v, 1, 10);
export const round = (v: number, d = 1) => {
  const k = 10 ** d;
  return Math.round(v * k) / k;
};
/** Map a 0-1 rate into the 1-10 rating space given a plausible league range. */
export const rateTo10 = (rate: number, lo: number, hi: number) => clamp10(1 + ((rate - lo) / (hi - lo)) * 9);
export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
export const pct = (v: number) => `${Math.round(v * 100)}%`;
export const signed = (v: number, d = 1) => `${v >= 0 ? '+' : ''}${round(v, d)}`;

/** Great-circle distance in miles between two lat/lng points. */
export function distanceMiles(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

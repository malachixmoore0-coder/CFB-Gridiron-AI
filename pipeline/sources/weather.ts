/**
 * Open-Meteo forecast (free, keyless) for outdoor games inside the forecast
 * window. Best-effort: returns null on any failure.
 */
import { fetchJson } from '../lib/fetch';
import type { Weather } from '../../src/engine/types';
import type { GameWeather } from '../../src/data/liveTypes';
export type { GameWeather };

export async function forecastAt(lat: number, lng: number, kickoffIso: string): Promise<GameWeather | null> {
  const kickoff = new Date(kickoffIso);
  const hoursOut = (kickoff.getTime() - Date.now()) / 3_600_000;
  if (!Number.isFinite(hoursOut) || hoursOut < -3 || hoursOut > 15 * 24) return null;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,precipitation_probability,wind_speed_10m,snowfall&forecast_days=16&wind_speed_unit=mph&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=UTC`;
  const data = await fetchJson<any>(url, `Open-Meteo forecast ${lat.toFixed(2)},${lng.toFixed(2)}`, 10_000);
  try {
    const times: string[] = data.hourly.time;
    const target = kickoff.toISOString().slice(0, 13);
    let i = times.findIndex((t) => t.startsWith(target));
    if (i < 0) i = times.length - 1;
    const pick = (k: string) => Number(data.hourly[k][i]);
    const tempF = pick('temperature_2m');
    const windMph = pick('wind_speed_10m');
    const precipPct = pick('precipitation_probability');
    const snowIn = pick('snowfall');
    let summary: Weather = 'clear';
    if (snowIn > 0.05) summary = 'snow';
    else if (windMph >= 15) summary = 'wind';
    else if (precipPct >= 50) summary = 'rain';
    else if (tempF <= 32) summary = 'cold';
    else if (tempF >= 88) summary = 'heat';
    return { tempF, windMph, precipPct, snowIn, summary };
  } catch {
    return null;
  }
}

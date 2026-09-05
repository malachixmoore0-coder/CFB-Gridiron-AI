/**
 * Download + cache + stream helpers for the data pipeline.
 * Files are cached under .cache/ (gitignored) so repeated local runs are fast.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { parse } from 'csv-parse';

const CACHE_DIR = path.resolve(__dirname, '../../.cache');

export interface SourceLog {
  name: string;
  url: string;
  ok: boolean;
  fetchedAt: string;
  note?: string;
}

export const sourceLog: SourceLog[] = [];

function cachePath(url: string) {
  const safe = url.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9._-]+/g, '_');
  return path.join(CACHE_DIR, safe);
}

/**
 * Download a URL to the cache and return the local path. Returns null (and
 * logs) when the fetch fails and `optional` is set; throws otherwise.
 */
export async function download(url: string, name: string, opts: { optional?: boolean; ttlMinutes?: number; timeoutMs?: number } = {}): Promise<string | null> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = cachePath(url);
  const ttl = (opts.ttlMinutes ?? 60) * 60_000;
  if (fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < ttl && fs.statSync(file).size > 0) {
    sourceLog.push({ name, url, ok: true, fetchedAt: new Date(fs.statSync(file).mtimeMs).toISOString(), note: 'cache' });
    return file;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 180_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(file, buf);
    sourceLog.push({ name, url, ok: true, fetchedAt: new Date().toISOString() });
    return file;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    sourceLog.push({ name, url, ok: false, fetchedAt: new Date().toISOString(), note: msg });
    if (opts.optional) {
      console.warn(`  (optional) ${name}: ${msg}`);
      return null;
    }
    throw new Error(`${name}: ${msg}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch JSON with a short timeout; null on any failure (best-effort enrichers). */
export async function fetchJson<T = unknown>(url: string, name: string, timeoutMs = 15_000): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json', 'user-agent': 'gridiron-ai-pipeline' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as T;
    sourceLog.push({ name, url, ok: true, fetchedAt: new Date().toISOString() });
    return json;
  } catch (e) {
    sourceLog.push({ name, url, ok: false, fetchedAt: new Date().toISOString(), note: e instanceof Error ? e.message : String(e) });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type RowGetter = (col: string) => string;

/**
 * Stream a (possibly gzipped) CSV row by row. The callback receives a getter
 * bound to the header so wide files (play-by-play has 370+ columns) never get
 * materialised as objects.
 */
export async function forEachRow(file: string, onRow: (get: RowGetter, raw: string[]) => void): Promise<number> {
  const src = fs.createReadStream(file);
  const input = file.endsWith('.gz') ? src.pipe(zlib.createGunzip()) : src;
  const parser = input.pipe(parse({ bom: true, relax_column_count: true, relax_quotes: true, skip_empty_lines: true }));
  let header: Record<string, number> | null = null;
  let n = 0;
  for await (const record of parser as AsyncIterable<string[]>) {
    if (!header) {
      header = {};
      record.forEach((c, i) => { header![c] = i; });
      continue;
    }
    const row = record;
    const get: RowGetter = (col) => {
      const i = header![col];
      return i === undefined ? '' : (row[i] ?? '');
    };
    onRow(get, row);
    n++;
  }
  return n;
}

/** Load a small CSV fully into objects keyed by header. */
export async function readCsv(file: string): Promise<Record<string, string>[]> {
  const src = fs.createReadStream(file);
  const input = file.endsWith('.gz') ? src.pipe(zlib.createGunzip()) : src;
  const parser = input.pipe(parse({ bom: true, columns: true, relax_column_count: true, relax_quotes: true, skip_empty_lines: true }));
  const out: Record<string, string>[] = [];
  for await (const rec of parser as AsyncIterable<Record<string, string>>) out.push(rec);
  return out;
}

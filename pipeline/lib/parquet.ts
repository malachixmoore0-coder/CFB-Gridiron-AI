/**
 * Tiny wrapper around hyparquet (pure-JS parquet reader, ESM-only) so the
 * CommonJS pipeline can read the sportsdataverse parquet releases. Loaded
 * lazily via dynamic import; zstd/snappy pages need hyparquet-compressors.
 */
import type { AsyncBuffer } from 'hyparquet';

// TS resolves hyparquet's browser typings (no file helper); Node resolves ./src/node.js at runtime, which has it.
type Hyparquet = typeof import('hyparquet') & { asyncBufferFromFile(filename: string): Promise<AsyncBuffer> };
type Compressors = typeof import('hyparquet-compressors');

let libs: Promise<{ hp: Hyparquet; compressors: Compressors['compressors'] }> | null = null;
const load = () => (libs ??= Promise.all([import('hyparquet'), import('hyparquet-compressors')]).then(([hp, c]) => ({ hp: hp as unknown as Hyparquet, compressors: c.compressors })));

export interface ParquetHandle { file: AsyncBuffer; rows: number; columns: string[]; }

export async function openParquet(path: string): Promise<ParquetHandle> {
  const { hp } = await load();
  const file = await hp.asyncBufferFromFile(path);
  const meta = await hp.parquetMetadataAsync(file);
  const columns = meta.schema.filter((s) => !s.num_children).map((s) => s.name);
  return { file, rows: Number(meta.num_rows), columns };
}

/** Read `columns` (silently dropping ones the file lacks) as plain row objects, in slices to bound memory. */
export async function forEachParquetRow(
  h: ParquetHandle,
  columns: string[],
  onRow: (row: Record<string, unknown>) => void,
  sliceRows = 25_000,
): Promise<string[]> {
  const { hp, compressors } = await load();
  const have = new Set(h.columns);
  const cols = columns.filter((c) => have.has(c));
  for (let start = 0; start < h.rows; start += sliceRows) {
    const rows = await hp.parquetReadObjects({ file: h.file, compressors, columns: cols, rowStart: start, rowEnd: Math.min(h.rows, start + sliceRows) });
    for (const r of rows) onRow(r as Record<string, unknown>);
  }
  return columns.filter((c) => !have.has(c));
}

export async function readParquetObjects(path: string, columns?: string[]): Promise<Record<string, unknown>[]> {
  const { hp, compressors } = await load();
  const file = await hp.asyncBufferFromFile(path);
  return (await hp.parquetReadObjects({ file, compressors, columns })) as Record<string, unknown>[];
}

/** Coerce a parquet cell (bigint / boolean / string / null) into a number, NaN when absent. */
export const pnum = (v: unknown): number => {
  if (v === null || v === undefined) return NaN;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = Number(v);
  return Number.isNaN(n) ? NaN : n;
};
export const pbool = (v: unknown): boolean => v === true || v === 1 || v === 1n || v === 'TRUE' || v === 'true';
export const pstr = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

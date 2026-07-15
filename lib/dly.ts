import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Variable } from "./types";

const BASE_URL = "https://www.ncei.noaa.gov/pub/data/ghcn/daily/all";
const CACHE_DIR = path.join(os.tmpdir(), "ghcndgaps-data-cache", "dly");
const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const RECENT_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — how often "recent" queries force a re-check
const DOWNLOAD_TIMEOUT_MS = 10_000;
const DOWNLOAD_RETRIES = 2;
const CONCURRENCY = 16;

function cachePath(stationId: string): string {
  return path.join(CACHE_DIR, `${stationId}.dly`);
}

async function statMtime(filePath: string): Promise<number | null> {
  try {
    const stat = await fs.stat(filePath);
    return stat.mtimeMs;
  } catch {
    return null;
  }
}

/** A cached file is stale if the query touches recent days and the cache is older than the recent-data TTL. */
function isStale(mtimeMs: number, endDate: Date): boolean {
  const isRecentQuery = Date.now() - endDate.getTime() < RECENT_WINDOW_MS;
  if (!isRecentQuery) return false;
  return Date.now() - mtimeMs > RECENT_CACHE_TTL_MS;
}

async function downloadDly(stationId: string, dest: string): Promise<boolean> {
  const url = `${BASE_URL}/${stationId}.dly`;
  for (let attempt = 1; attempt <= DOWNLOAD_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const text = await res.text();
        await fs.writeFile(dest, text, "utf-8");
        return true;
      }
      if (res.status === 404) return false; // station has no data file; don't retry
    } catch {
      clearTimeout(timeout);
    }
  }
  return false;
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  async function next(): Promise<void> {
    while (index < items.length) {
      const item = items[index++];
      await worker(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next));
}

/** Ensures cached, reasonably fresh .dly files exist locally for the given stations. */
export async function ensureDlyFilesCached(
  stationIds: string[],
  endDate: Date,
): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const toDownload: string[] = [];
  for (const id of stationIds) {
    const dest = cachePath(id);
    const mtime = await statMtime(dest);
    if (mtime === null || isStale(mtime, endDate)) {
      toDownload.push(id);
    }
  }
  await runWithConcurrency(toDownload, CONCURRENCY, async (id) => {
    await downloadDly(id, cachePath(id));
  });
}

/** Parses a cached .dly file for one variable across a date range. Returns date (ISO yyyy-mm-dd) -> value. */
export async function parseDly(
  stationId: string,
  variable: Variable,
  startDate: Date,
  endDate: Date,
): Promise<Map<string, number>> {
  const values = new Map<string, number>();
  let raw: string;
  try {
    raw = await fs.readFile(cachePath(stationId), "utf-8");
  } catch {
    return values; // no file downloaded (station missing or download failed)
  }

  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  for (const line of raw.split("\n")) {
    if (line.length < 21) continue;
    if (line.slice(17, 21) !== variable) continue;
    const year = parseInt(line.slice(11, 15), 10);
    const month = parseInt(line.slice(15, 17), 10);
    if (Number.isNaN(year) || Number.isNaN(month)) continue;

    for (let day = 1; day <= 31; day++) {
      const offset = 21 + (day - 1) * 8;
      const valueStr = line.slice(offset, offset + 5);
      const value = parseInt(valueStr, 10);
      if (Number.isNaN(value) || value === -9999) continue;

      const date = new Date(Date.UTC(year, month - 1, day));
      if (date.getUTCMonth() !== month - 1) continue; // invalid day (e.g. Feb 30)
      const dateMs = date.getTime();
      if (dateMs < startMs || dateMs > endMs) continue;

      values.set(date.toISOString().slice(0, 10), value);
    }
  }

  return values;
}

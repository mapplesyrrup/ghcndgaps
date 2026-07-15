import fs from "node:fs/promises";
import path from "node:path";
import type { InventoryRow, StationRef } from "./types";

const BASE_URL = "https://www.ncei.noaa.gov/pub/data/ghcn/daily";
const CACHE_DIR = path.join(process.cwd(), ".data-cache");
const STATIONS_CACHE = path.join(CACHE_DIR, "ghcnd-stations.txt");
const INVENTORY_CACHE = path.join(CACHE_DIR, "ghcnd-inventory.txt");
const REFERENCE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

async function isFresh(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return Date.now() - stat.mtimeMs < REFERENCE_TTL_MS;
  } catch {
    return false;
  }
}

async function downloadToCache(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${res.status}`);
  }
  const text = await res.text();
  await fs.writeFile(dest, text, "utf-8");
}

async function loadRawFile(url: string, dest: string): Promise<string> {
  await ensureCacheDir();
  if (!(await isFresh(dest))) {
    await downloadToCache(url, dest);
  }
  return fs.readFile(dest, "utf-8");
}

function parseStations(raw: string): StationRef[] {
  const stations: StationRef[] = [];
  for (const line of raw.split("\n")) {
    if (line.length < 71) continue;
    const id = line.slice(0, 11).trim();
    const lat = parseFloat(line.slice(12, 20));
    const lon = parseFloat(line.slice(21, 30));
    const name = line.slice(41, 71).trim();
    if (!id || Number.isNaN(lat) || Number.isNaN(lon)) continue;
    stations.push({ id, lat, lon, name });
  }
  return stations;
}

function parseInventory(raw: string): InventoryRow[] {
  const rows: InventoryRow[] = [];
  for (const line of raw.split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 6) continue;
    const [id, , , element, firstYear, lastYear] = parts;
    rows.push({
      id,
      element,
      firstYear: parseInt(firstYear, 10),
      lastYear: parseInt(lastYear, 10),
    });
  }
  return rows;
}

interface ReferenceData {
  stations: StationRef[];
  inventory: InventoryRow[];
  stationsById: Map<string, StationRef>;
}

let cached: ReferenceData | null = null;
let cachedAt = 0;
let loadingPromise: Promise<ReferenceData> | null = null;

async function loadReferenceData(): Promise<ReferenceData> {
  const [stationsRaw, inventoryRaw] = await Promise.all([
    loadRawFile(`${BASE_URL}/ghcnd-stations.txt`, STATIONS_CACHE),
    loadRawFile(`${BASE_URL}/ghcnd-inventory.txt`, INVENTORY_CACHE),
  ]);
  const stations = parseStations(stationsRaw);
  const inventory = parseInventory(inventoryRaw);
  const stationsById = new Map(stations.map((s) => [s.id, s]));
  return { stations, inventory, stationsById };
}

export async function getReferenceData(): Promise<ReferenceData> {
  if (cached && Date.now() - cachedAt < REFERENCE_TTL_MS) {
    return cached;
  }
  if (!loadingPromise) {
    loadingPromise = loadReferenceData()
      .then((data) => {
        cached = data;
        cachedAt = Date.now();
        return data;
      })
      .finally(() => {
        loadingPromise = null;
      });
  }
  return loadingPromise;
}

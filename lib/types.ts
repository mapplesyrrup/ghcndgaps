export const VARIABLES = ["TMAX", "TMIN", "PRCP", "TAVG", "SNOW"] as const;
export type Variable = (typeof VARIABLES)[number];

export interface BoundingBox {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
}

export interface StationRef {
  id: string;
  lat: number;
  lon: number;
  name: string;
}

export interface InventoryRow {
  id: string;
  element: string;
  firstYear: number;
  lastYear: number;
}

export interface StationResult {
  id: string;
  lat: number;
  lon: number;
  name: string;
  totalDays: number;
  missingDays: number;
  missingPct: number;
}

export interface DailySummary {
  date: string;
  reporting: number;
  missing: number;
  total: number;
  missingPct: number;
}

export interface StationsResponse {
  variable: Variable;
  start: string;
  end: string;
  bbox: BoundingBox;
  stationCount: number;
  stations: StationResult[];
  daily: DailySummary[];
}

export interface Preset {
  name: string;
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
  start: string;
  end: string;
}

export const PRESETS: Preset[] = [
  {
    name: "Hurricane Sandy (2012)",
    latMin: 39.5,
    latMax: 42.5,
    lonMin: -75.5,
    lonMax: -72.0,
    start: "2012-10-25",
    end: "2012-11-05",
  },
  {
    name: "Hurricane Ian (2022)",
    latMin: 26.0,
    latMax: 34.0,
    lonMin: -84.0,
    lonMax: -78.5,
    start: "2022-09-25",
    end: "2022-10-05",
  },
  {
    name: "Hurricane Harvey (2017)",
    latMin: 27.0,
    latMax: 31.5,
    lonMin: -96.5,
    lonMax: -91.0,
    start: "2017-08-23",
    end: "2017-09-05",
  },
  {
    name: "Hurricane Rita (2005)",
    latMin: 26.0,
    latMax: 33.5,
    lonMin: -98.5,
    lonMax: -87.0,
    start: "2005-09-18",
    end: "2005-09-26",
  },
  {
    name: "Hurricane Michael (2018)",
    latMin: 29.0,
    latMax: 33.0,
    lonMin: -86.5,
    lonMax: -83.0,
    start: "2018-10-07",
    end: "2018-10-12",
  },
];

export const MAX_STATIONS = 400;

interface LatLonPoint {
  lat: number;
  lon: number;
}

const METERS_PER_DEG_LAT = 111_320;

// Flat-top hexagon vertices (6 points, 60° apart) around a center, sized by center-to-vertex
// radius in meters. Used to render grid cells as hexagons via PolygonLayer — deck.gl's
// GridCellLayer (a thin wrapper over ColumnLayer's disk geometry) rendered badly distorted
// shapes for this use case, so this draws the hexagon explicitly in lon/lat space instead.
export function hexagonPolygon(center: LatLonPoint, radiusMeters: number): [number, number][] {
  const metersPerDegLon = METERS_PER_DEG_LAT * Math.cos((center.lat * Math.PI) / 180);
  const points: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    const dx = radiusMeters * Math.cos(angle);
    const dy = radiusMeters * Math.sin(angle);
    points.push([center.lon + dx / metersPerDegLon, center.lat + dy / METERS_PER_DEG_LAT]);
  }
  return points;
}

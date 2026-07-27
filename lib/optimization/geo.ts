export interface LatLon {
  lat: number;
  lon: number;
}

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

// GHCN-D has many stations a few hundred meters to a couple km apart (co-located
// COOP/ASOS gauges, renamed/relocated station records, etc). Rows that close together are
// nearly linearly dependent in the kriging covariance matrix — with a correlation range of
// tens to hundreds of km, two stations 1km apart have almost identical covariance to every
// other point — which makes the system ill-conditioned and produces wildly unstable
// variance estimates. Thinning to one representative per cluster keeps the solve stable and
// is the same intuition as Amorim et al. (2012)'s "redundant station" reduction step: two
// nearly-coincident stations aren't really independent samples of the field.
//
// Uses a spatial hash grid so it stays roughly O(n) instead of the O(n^2) of checking every
// pair directly.
export function thinByMinSpacing(points: LatLon[], minSpacingKm: number): LatLon[] {
  if (points.length === 0 || minSpacingKm <= 0) return points;

  const avgLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const latBucketDeg = minSpacingKm / 111;
  const lonBucketDeg = minSpacingKm / (111 * Math.max(Math.cos(toRad(avgLat)), 0.1));

  const buckets = new Map<string, LatLon[]>();
  const kept: LatLon[] = [];

  function bucketKey(lat: number, lon: number): string {
    return `${Math.floor(lat / latBucketDeg)},${Math.floor(lon / lonBucketDeg)}`;
  }

  for (const point of points) {
    const bi = Math.floor(point.lat / latBucketDeg);
    const bj = Math.floor(point.lon / lonBucketDeg);

    let tooClose = false;
    for (let di = -1; di <= 1 && !tooClose; di++) {
      for (let dj = -1; dj <= 1 && !tooClose; dj++) {
        const neighbors = buckets.get(`${bi + di},${bj + dj}`);
        if (!neighbors) continue;
        for (const other of neighbors) {
          if (haversineKm(point, other) < minSpacingKm) {
            tooClose = true;
            break;
          }
        }
      }
    }

    if (tooClose) continue;

    kept.push(point);
    const key = bucketKey(point.lat, point.lon);
    const list = buckets.get(key);
    if (list) list.push(point);
    else buckets.set(key, [point]);
  }

  return kept;
}

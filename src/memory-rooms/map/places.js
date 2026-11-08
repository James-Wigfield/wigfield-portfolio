/* Offline gazetteer for the trip (no network needed at capture time).
   r = rough radius in metres, stored as locAccuracyM when a place is typed.
   Add a place: one line, keep `label` in the same "Town, ST" form. */

export const PLACES = [
  { label: 'New York, NY', lat: 40.7128, lng: -74.006, r: 8000, aka: ['nyc', 'manhattan', 'new york city'] },
  { label: 'Brooklyn, NY', lat: 40.6782, lng: -73.9442, r: 6000 },
  { label: 'Calgary, AB', lat: 51.0447, lng: -114.0719, r: 8000, aka: ['yyc'] },
  { label: 'Banff, AB', lat: 51.1784, lng: -115.5708, r: 3000 },
  { label: 'Lake Louise, AB', lat: 51.4254, lng: -116.1773, r: 3000, aka: ['moraine lake'] },
  { label: 'Jasper, AB', lat: 52.8737, lng: -118.0814, r: 3000 },
  { label: 'Vancouver, BC', lat: 49.2827, lng: -123.1207, r: 8000 },
  { label: 'Seattle, WA', lat: 47.6062, lng: -122.3321, r: 8000 },
  { label: 'San Diego, CA', lat: 32.7157, lng: -117.1611, r: 8000 },
  { label: 'Los Angeles, CA', lat: 34.0522, lng: -118.2437, r: 15000, aka: ['la', 'hollywood', 'santa monica'] },
  { label: 'Santa Barbara, CA', lat: 34.4208, lng: -119.6982, r: 4000 },
  { label: 'Big Sur, CA', lat: 36.2704, lng: -121.8081, r: 15000 },
  { label: 'Monterey, CA', lat: 36.6002, lng: -121.8947, r: 4000 },
  { label: 'Carmel, CA', lat: 36.5552, lng: -121.9233, r: 2500, aka: ['carmel-by-the-sea'] },
  { label: 'San Francisco, CA', lat: 37.7749, lng: -122.4194, r: 7000, aka: ['sf', 'frisco'] },
  { label: 'Las Vegas, NV', lat: 36.1699, lng: -115.1398, r: 8000, aka: ['vegas'] },
  { label: 'New Orleans, LA', lat: 29.9511, lng: -90.0715, r: 7000, aka: ['nola'] },
  { label: 'Biloxi, MS', lat: 30.396, lng: -88.8853, r: 4000 },
  { label: 'Mobile, AL', lat: 30.6954, lng: -88.0399, r: 5000 },
  { label: 'Gulf Shores, AL', lat: 30.246, lng: -87.7008, r: 4000 },
  { label: 'Pensacola, FL', lat: 30.4213, lng: -87.2169, r: 5000 },
  { label: 'Destin, FL', lat: 30.3935, lng: -86.4958, r: 4000 },
  { label: 'Panama City Beach, FL', lat: 30.1766, lng: -85.8055, r: 5000, aka: ['pcb'] },
  { label: 'Tampa, FL', lat: 27.9506, lng: -82.4572, r: 8000 },
  { label: 'Orlando, FL', lat: 28.5383, lng: -81.3792, r: 10000 },
  { label: 'Miami, FL', lat: 25.7617, lng: -80.1918, r: 8000 },
  { label: 'Miami Beach, FL', lat: 25.7907, lng: -80.13, r: 4000, aka: ['south beach'] },
  { label: 'Key West, FL', lat: 24.5551, lng: -81.78, r: 3000 },
  { label: 'Perth, WA', lat: -31.9523, lng: 115.8613, r: 10000, aka: ['perth australia', 'home'] },
];

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Best matches for a typed query, prefix matches first. */
export function searchPlaces(query, limit = 6) {
  const q = norm(query);
  if (!q) return [];
  const scored = [];
  for (const p of PLACES) {
    const names = [p.label, ...(p.aka || [])].map(norm);
    let score = 0;
    for (const n of names) {
      if (n === q) score = Math.max(score, 4);
      else if (n.startsWith(q)) score = Math.max(score, 3);
      else if (n.split(' ').some((w) => w.startsWith(q))) score = Math.max(score, 2);
      else if (q.length > 2 && n.includes(q)) score = Math.max(score, 1);
    }
    if (score) scored.push({ p, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.p.label.localeCompare(b.p.label))
    .slice(0, limit)
    .map((s) => s.p);
}

/** "51.18, -115.57" (or "51.18 -115.57") → { lat, lng } or null. */
export function parseLatLng(text) {
  const m = String(text || '').match(/^\s*(-?\d{1,3}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** Great-circle distance in metres. */
export function distanceM(a, b) {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The closest gazetteer place within maxM, or null (used to label a GPS fix or a pin). */
export function nearestPlace(lat, lng, maxM = 60000) {
  let best = null;
  let bestD = Infinity;
  for (const p of PLACES) {
    const d = distanceM({ lat, lng }, p);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return bestD <= maxM ? best : null;
}

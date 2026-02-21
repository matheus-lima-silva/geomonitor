export function buildGoogleMapsMultiStopUrl(points, opts = {}) {
  const list = Array.isArray(points) ? points : [];
  if (list.length < 2) return '';

  const origin = opts.origin || '';
  const destination = list[list.length - 1];
  const waypoints = list.slice(0, -1).map((p) => `${p.latitude},${p.longitude}`).join('|');

  const params = new URLSearchParams();
  params.set('api', '1');
  params.set('travelmode', 'driving');
  if (origin) params.set('origin', origin);
  params.set('destination', `${destination.latitude},${destination.longitude}`);
  if (waypoints) params.set('waypoints', waypoints);

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function chunkRoutePoints(points, maxWaypointsPerUrl = 8) {
  const list = Array.isArray(points) ? points : [];
  if (list.length <= maxWaypointsPerUrl + 1) return [list];

  const maxStopsPerChunk = maxWaypointsPerUrl + 1;
  const chunks = [];
  for (let i = 0; i < list.length; i += maxStopsPerChunk) {
    chunks.push(list.slice(i, i + maxStopsPerChunk));
  }

  return chunks;
}

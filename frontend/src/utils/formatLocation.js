/**
 * Safely formats project location which can be:
 * - A string: "Ahmedabad, Gujarat"
 * - A coordinate object: { latitude: 23.012018, longitude: 72.681409 }
 * - An address object: { address: "..." }
 * - null or undefined
 *
 * Always returns a clean string, NEVER an object (preventing React crash "Objects are not valid as a React child").
 */
export function formatLocation(loc, fallback = '') {
  if (!loc) return fallback;
  if (typeof loc === 'string') return loc.trim();
  if (typeof loc === 'object') {
    if (loc.address) return String(loc.address).trim();
    if (loc.city && loc.state) return `${loc.city}, ${loc.state}`;
    if (loc.city) return String(loc.city);
    if (loc.name) return String(loc.name);
    const hasLat = loc.latitude !== undefined && loc.latitude !== null;
    const hasLng = loc.longitude !== undefined && loc.longitude !== null;
    if (hasLat && hasLng) {
      const latNum = Number(loc.latitude);
      const lngNum = Number(loc.longitude);
      if (!isNaN(latNum) && !isNaN(lngNum)) {
        return `${latNum.toFixed(4)}, ${lngNum.toFixed(4)}`;
      }
      return `${loc.latitude}, ${loc.longitude}`;
    }
    return fallback;
  }
  return String(loc);
}

/**
 * Geofence Verification Engine
 * Supports Circular Haversine distance checks and Ray-Casting Point-in-Polygon (PIP) checks.
 */

export interface ILocationCoordinate {
  latitude: number;
  longitude: number;
}

export interface IGeofenceDefinition {
  id?: string;
  name: string;
  boundaryType: 'circle' | 'polygon';
  center?: {
    latitude: number;
    longitude: number;
  };
  radius?: number; // in meters
  coordinates?: [number, number][]; // [longitude, latitude] array
  isActive?: boolean;
}

export interface IGeofenceVerificationResult {
  isInside: boolean;
  matchedGeofenceName?: string;
  matchedGeofenceId?: string;
  distanceToCenterMeters?: number;
  reason?: string;
}

/**
 * Calculates distance in meters between two coordinates using the Haversine formula.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // Earth's mean radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

/**
 * Tests if a point [longitude, latitude] is inside a polygon using the Ray-Casting algorithm.
 * Even-odd crossing rule: odd number of edge crossings means the point is inside.
 */
export function isPointInPolygon(
  point: [number, number], // [lon, lat]
  polygon: [number, number][], // array of [lon, lat]
): boolean {
  if (!polygon || polygon.length < 3) return false;

  const [x, y] = point;
  let isInside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    // Check if ray crosses the line segment between vertex i and vertex j
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) {
      isInside = !isInside;
    }
  }

  return isInside;
}

/**
 * Validates whether a device location is inside any of the active geofences configured for a project.
 */
export function verifyLocationInGeofences(
  location: ILocationCoordinate,
  geofences: IGeofenceDefinition[],
): IGeofenceVerificationResult {
  if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
    return { isInside: false, reason: 'Invalid or missing user location coordinates' };
  }

  const activeGeofences = (geofences || []).filter(g => g.isActive !== false);
  if (activeGeofences.length === 0) {
    // If no geofences configured on project, default to site allowed
    return { isInside: true, reason: 'No active geofences configured on project' };
  }

  for (const gf of activeGeofences) {
    if (gf.boundaryType === 'circle' && gf.center && typeof gf.radius === 'number') {
      const distance = calculateHaversineDistance(
        location.latitude,
        location.longitude,
        gf.center.latitude,
        gf.center.longitude,
      );

      if (distance <= gf.radius) {
        return {
          isInside: true,
          matchedGeofenceName: gf.name,
          matchedGeofenceId: gf.id,
          distanceToCenterMeters: distance,
        };
      }
    } else if (gf.boundaryType === 'polygon' && Array.isArray(gf.coordinates) && gf.coordinates.length >= 3) {
      // Coordinates format: [longitude, latitude]
      const insidePoly = isPointInPolygon(
        [location.longitude, location.latitude],
        gf.coordinates,
      );

      if (insidePoly) {
        return {
          isInside: true,
          matchedGeofenceName: gf.name,
          matchedGeofenceId: gf.id,
        };
      }
    }
  }

  return {
    isInside: false,
    reason: 'Location is outside all project geofence boundaries',
  };
}

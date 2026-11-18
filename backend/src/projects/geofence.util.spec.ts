import {
  calculateHaversineDistance,
  isPointInPolygon,
  verifyLocationInGeofences,
  IGeofenceDefinition,
} from './geofence.util';

describe('Geofence Utility - Haversine & Point-In-Polygon Verification', () => {
  describe('calculateHaversineDistance', () => {
    it('should return 0 for identical coordinates', () => {
      const distance = calculateHaversineDistance(23.0338, 72.585, 23.0338, 72.585);
      expect(distance).toBe(0);
    });

    it('should accurately calculate distance in meters between known coordinates', () => {
      // Ahmedabad (23.0225, 72.5714) to Gandhinagar (23.2156, 72.6369) ~ 22.5 km
      const distance = calculateHaversineDistance(23.0225, 72.5714, 23.2156, 72.6369);
      expect(distance).toBeGreaterThan(21000);
      expect(distance).toBeLessThan(23000);
    });
  });

  describe('isPointInPolygon (Ray-Casting Algorithm)', () => {
    // Square polygon bounded by longitudes [72.0, 73.0] and latitudes [23.0, 24.0]
    const squarePolygon: [number, number][] = [
      [72.0, 23.0],
      [73.0, 23.0],
      [73.0, 24.0],
      [72.0, 24.0],
    ];

    it('should return true for a coordinate inside the polygon', () => {
      expect(isPointInPolygon([72.5, 23.5], squarePolygon)).toBe(true);
    });

    it('should return false for a coordinate outside the polygon', () => {
      expect(isPointInPolygon([71.5, 23.5], squarePolygon)).toBe(false); // West of polygon
      expect(isPointInPolygon([73.5, 23.5], squarePolygon)).toBe(false); // East of polygon
      expect(isPointInPolygon([72.5, 24.5], squarePolygon)).toBe(false); // North of polygon
      expect(isPointInPolygon([72.5, 22.5], squarePolygon)).toBe(false); // South of polygon
    });

    it('should handle complex L-shaped polygons', () => {
      const lPolygon: [number, number][] = [
        [0, 0],
        [4, 0],
        [4, 2],
        [2, 2],
        [2, 4],
        [0, 4],
      ];

      expect(isPointInPolygon([1, 1], lPolygon)).toBe(true); // Inside base
      expect(isPointInPolygon([1, 3], lPolygon)).toBe(true); // Inside upright
      expect(isPointInPolygon([3, 3], lPolygon)).toBe(false); // In the cut-out corner
    });
  });

  describe('verifyLocationInGeofences', () => {
    const geofences: IGeofenceDefinition[] = [
      {
        id: 'gf-circle-1',
        name: 'Main Site Gate Circle',
        boundaryType: 'circle',
        center: { latitude: 23.0338, longitude: 72.585 },
        radius: 200, // 200 meters
        isActive: true,
      },
      {
        id: 'gf-poly-1',
        name: 'Tower B Polygon Boundary',
        boundaryType: 'polygon',
        coordinates: [
          [72.580, 23.030],
          [72.584, 23.030],
          [72.584, 23.034],
          [72.580, 23.034],
        ],
        isActive: true,
      },
      {
        id: 'gf-inactive',
        name: 'Old Quarry Site',
        boundaryType: 'circle',
        center: { latitude: 23.100, longitude: 72.600 },
        radius: 500,
        isActive: false, // Inactive
      },
    ];

    it('should match circular geofence when within radius', () => {
      // 50 meters from center
      const userLocation = { latitude: 23.0339, longitude: 72.5851 };
      const res = verifyLocationInGeofences(userLocation, geofences);

      expect(res.isInside).toBe(true);
      expect(res.matchedGeofenceId).toBe('gf-circle-1');
      expect(res.matchedGeofenceName).toBe('Main Site Gate Circle');
    });

    it('should match polygon geofence when inside polygon coordinates', () => {
      // Inside [72.580, 23.030] to [72.584, 23.034]
      const userLocation = { latitude: 23.032, longitude: 72.582 };
      const res = verifyLocationInGeofences(userLocation, geofences);

      expect(res.isInside).toBe(true);
      expect(res.matchedGeofenceId).toBe('gf-poly-1');
      expect(res.matchedGeofenceName).toBe('Tower B Polygon Boundary');
    });

    it('should reject location when outside all active geofences', () => {
      const userLocation = { latitude: 23.050, longitude: 72.590 };
      const res = verifyLocationInGeofences(userLocation, geofences);

      expect(res.isInside).toBe(false);
      expect(res.reason).toContain('outside all project geofence boundaries');
    });

    it('should ignore inactive geofences even if user is within their radius', () => {
      const userLocation = { latitude: 23.100, longitude: 72.600 };
      const res = verifyLocationInGeofences(userLocation, geofences);

      expect(res.isInside).toBe(false);
    });
  });
});

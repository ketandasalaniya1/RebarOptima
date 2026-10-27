import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { X, MapPin, Navigation, AlertTriangle, CheckCircle, Loader2, Circle, Pentagon, RefreshCw } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { projectsApi } from '../../utils/api';
import { addProject, updateProjectInList, closeCreateModal } from '../../store/slices/projectSlice';
import { setView } from '../../store/slices/routingSlice';
import './ProjectFormModal.css';

// Fix Leaflet default icon URLs in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const PROJECT_TYPES = ['Residential', 'Mixed-use', 'Commercial', 'Villa', 'Other'];

export default function ProjectFormModal() {
  const dispatch = useDispatch();
  const editingProject = useSelector((state) => state.project.editingProject);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [projectType, setProjectType] = useState('Residential');
  const [status, setStatus] = useState('active');

  // Geofence configuration state within project creation
  const [enableGeofence, setEnableGeofence] = useState(false);
  const [geofenceName, setGeofenceName] = useState('Site Perimeter');
  const [boundaryType, setBoundaryType] = useState('circle');
  const [radius, setRadius] = useState(250);
  const [polygonPoints, setPolygonPoints] = useState([]); // Array of [lng, lat]

  // UI state
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [locationSuccess, setLocationSuccess] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');

  // Leaflet map refs
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const layerRef = useRef(null);

  // Initialize form with editingProject data if available
  useEffect(() => {
    if (editingProject) {
      setName(editingProject.name || '');
      setAddress(editingProject.address || '');
      setPincode(editingProject.pincode || '');
      setLatitude(editingProject.location?.latitude?.toString() || '');
      setLongitude(editingProject.location?.longitude?.toString() || '');
      setProjectType(editingProject.projectType || 'Residential');
      setStatus(editingProject.status || 'active');

      if (editingProject.geofences && editingProject.geofences.length > 0) {
        const gf = editingProject.geofences[0];
        setEnableGeofence(true);
        setGeofenceName(gf.name || 'Site Perimeter');
        setBoundaryType(gf.boundaryType || 'circle');
        if (gf.radius) setRadius(gf.radius);
        if (gf.coordinates) setPolygonPoints(gf.coordinates);
      }
    } else {
      // Defaults for new project
      setName('');
      setAddress('');
      setPincode('');
      setLatitude('');
      setLongitude('');
      setProjectType('Residential');
      setStatus('active');
      setEnableGeofence(false);
      setPolygonPoints([]);
    }
    setValidationErrors({});
    setApiError('');
  }, [editingProject]);

  // Leaflet map lifecycle
  useEffect(() => {
    if (!enableGeofence || !mapContainerRef.current) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      return;
    }

    const defaultLat = parseFloat(latitude) || 23.0225;
    const defaultLng = parseFloat(longitude) || 72.5714;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [defaultLat, defaultLng],
        zoom: 15,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      // Click on map to adjust position or add polygon points
      map.on('click', (e) => {
        const clickedLat = Number(e.latlng.lat.toFixed(6));
        const clickedLng = Number(e.latlng.lng.toFixed(6));

        if (boundaryType === 'circle' || !enableGeofence) {
          setLatitude(clickedLat.toString());
          setLongitude(clickedLng.toString());
        } else if (boundaryType === 'polygon') {
          setPolygonPoints((prev) => [...prev, [clickedLng, clickedLat]]);
        }
      });

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Update center marker
    const validLat = parseFloat(latitude);
    const validLng = parseFloat(longitude);
    const hasValidCoords = !isNaN(validLat) && !isNaN(validLng);

    if (hasValidCoords) {
      if (markerRef.current) {
        markerRef.current.setLatLng([validLat, validLng]);
      } else {
        markerRef.current = L.marker([validLat, validLng], {
          draggable: true,
        }).addTo(map);

        markerRef.current.on('dragend', (e) => {
          const pos = e.target.getLatLng();
          setLatitude(Number(pos.lat.toFixed(6)).toString());
          setLongitude(Number(pos.lng.toFixed(6)).toString());
        });
      }
      map.setView([validLat, validLng]);
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }

    // Update boundary layer (circle or polygon)
    if (layerRef.current) {
      layerRef.current.remove();
      layerRef.current = null;
    }

    if (boundaryType === 'circle' && hasValidCoords && radius > 0) {
      layerRef.current = L.circle([validLat, validLng], {
        radius: Number(radius),
        color: '#10b981',
        fillColor: '#10b981',
        fillOpacity: 0.2,
        weight: 2,
      }).addTo(map);
    } else if (boundaryType === 'polygon' && polygonPoints.length >= 3) {
      const latLngs = polygonPoints.map((pt) => [pt[1], pt[0]]);
      layerRef.current = L.polygon(latLngs, {
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.25,
        weight: 2,
      }).addTo(map);
    }

    // Invalidate map size after render
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      // Cleanup on unmount or mode switch
    };
  }, [enableGeofence, latitude, longitude, boundaryType, radius, polygonPoints]);

  // Clean map on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Browser Geolocation API Capture
  const handleCaptureCurrentLocation = () => {
    setLocationError('');
    setLocationSuccess('');

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setIsCapturingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setLatitude(lat.toString());
        setLongitude(lng.toString());
        setIsCapturingLocation(false);
        setLocationSuccess(`Location captured successfully! Accurately resolved to ±${Math.round(pos.coords.accuracy)}m.`);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([lat, lng], 16);
        }
      },
      (err) => {
        setIsCapturingLocation(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setLocationError('Location permission denied. Please enable location access in your browser or enter coordinates manually.');
            break;
          case err.POSITION_UNAVAILABLE:
            setLocationError('Location information is unavailable on your device. Please enter coordinates manually.');
            break;
          case err.TIMEOUT:
            setLocationError('Location request timed out. Please try again or enter coordinates manually.');
            break;
          default:
            setLocationError('An unknown error occurred while retrieving location.');
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // Validation
  const validateForm = () => {
    const errors = {};

    if (!name.trim()) errors.name = 'Project Name is required';
    if (!address.trim()) errors.address = 'Project Address is required';

    const pinStr = pincode.trim();
    if (!pinStr) {
      errors.pincode = 'Project Address Pincode is required';
    } else if (!/^[1-9][0-9]{5}$/.test(pinStr)) {
      errors.pincode = 'Must be a valid Indian 6-digit PIN code (e.g. 380054)';
    }

    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);

    if (latitude === '' || isNaN(latNum)) {
      errors.latitude = 'Valid latitude is required';
    } else if (latNum < -90 || latNum > 90) {
      errors.latitude = 'Latitude must be between -90 and 90';
    }

    if (longitude === '' || isNaN(lngNum)) {
      errors.longitude = 'Valid longitude is required';
    } else if (lngNum < -180 || lngNum > 180) {
      errors.longitude = 'Longitude must be between -180 and 180';
    }

    if (enableGeofence) {
      if (boundaryType === 'circle') {
        const radNum = Number(radius);
        if (isNaN(radNum) || radNum <= 0) {
          errors.radius = 'Radius must be a positive number';
        } else if (radNum > 50000) {
          errors.radius = 'Radius cannot exceed 50,000 meters';
        }
      } else if (boundaryType === 'polygon') {
        if (polygonPoints.length < 3) {
          errors.polygon = 'Polygon geofence requires at least 3 points. Click on the map to add points.';
        }
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');

    if (!validateForm()) return;

    setSubmitting(true);

    try {
      const payload = {
        name: name.trim(),
        address: address.trim(),
        pincode: pincode.trim(),
        location: {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
        },
        projectType,
        status,
      };

      if (enableGeofence) {
        payload.geofences = [
          {
            id: editingProject?.geofences?.[0]?.id || `gf_${Date.now()}`,
            name: geofenceName.trim() || 'Site Perimeter',
            boundaryType,
            center: boundaryType === 'circle' ? {
              latitude: parseFloat(latitude),
              longitude: parseFloat(longitude),
            } : undefined,
            radius: boundaryType === 'circle' ? Number(radius) : undefined,
            coordinates: boundaryType === 'polygon' ? polygonPoints : undefined,
            isActive: true,
          },
        ];
      }

      if (editingProject) {
        const projId = editingProject._id || editingProject.id;
        const updated = await projectsApi.update(projId, payload);
        if (enableGeofence && payload.geofences) {
          await projectsApi.updateGeofences(projId, payload.geofences);
        }
        dispatch(updateProjectInList(updated));
      } else {
        const created = await projectsApi.create(payload);
        // Validate access via getById when possible, then enter app
        let validated = created;
        try {
          validated = await projectsApi.getById(created._id || created.id);
        } catch (_) {}
        dispatch(addProject(validated || created));
        dispatch(setView('overview'));
      }

      dispatch(closeCreateModal());
    } catch (err) {
      setApiError(err.message || 'Failed to save project. Please verify inputs.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearPolygon = () => {
    setPolygonPoints([]);
  };

  return (
    <div className="project-modal-backdrop" onClick={() => dispatch(closeCreateModal())}>
      <div className="project-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="pm-header">
          <div className="pm-header-left">
            <div className="pm-header-icon-box">
              <MapPin size={20} />
            </div>
            <div>
              <h2 className="pm-title">
                {editingProject ? 'Edit Project' : 'Create New Project'}
              </h2>
              <p className="pm-subtitle">
                Configure project site details, GPS coordinates, and geofence boundary
              </p>
            </div>
          </div>
          <button
            type="button"
            className="pm-close-btn"
            onClick={() => dispatch(closeCreateModal())}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="pm-form">
          {apiError && (
            <div className="pm-alert pm-alert-error">
              <AlertTriangle size={16} />
              <span>{apiError}</span>
            </div>
          )}

          <div className="pm-body-grid">
            {/* Column 1: Core Details */}
            <div className="pm-col">
              <h3 className="pm-section-title">General Information</h3>

              {/* Project Name */}
              <div className="pm-field">
                <label className="pm-label">
                  Project Name <span className="text-red">*</span>
                </label>
                <input
                  type="text"
                  className={`pm-input ${validationErrors.name ? 'has-error' : ''}`}
                  placeholder="e.g. Skyline Heights Tower A"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {validationErrors.name && (
                  <span className="pm-error-text">{validationErrors.name}</span>
                )}
              </div>

              {/* Project Type */}
              <div className="pm-field">
                <label className="pm-label">
                  Project Type <span className="text-red">*</span>
                </label>
                <select
                  className="pm-select"
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value)}
                >
                  {PROJECT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Project Address */}
              <div className="pm-field">
                <label className="pm-label">
                  Project Site Address <span className="text-red">*</span>
                </label>
                <textarea
                  className={`pm-textarea ${validationErrors.address ? 'has-error' : ''}`}
                  placeholder="Street address, landmark, sector..."
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
                {validationErrors.address && (
                  <span className="pm-error-text">{validationErrors.address}</span>
                )}
              </div>

              {/* Project Address Pincode */}
              <div className="pm-field">
                <label className="pm-label">
                  PIN Code (India 6-Digit) <span className="text-red">*</span>
                </label>
                <input
                  type="text"
                  maxLength={6}
                  className={`pm-input ${validationErrors.pincode ? 'has-error' : ''}`}
                  placeholder="e.g. 380054"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                />
                {validationErrors.pincode && (
                  <span className="pm-error-text">{validationErrors.pincode}</span>
                )}
              </div>

              {editingProject && (
                <div className="pm-field">
                  <label className="pm-label">Status</label>
                  <select
                    className="pm-select"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              )}
            </div>

            {/* Column 2: GPS Location & Geofence */}
            <div className="pm-col">
              <div className="pm-section-header">
                <h3 className="pm-section-title">GPS Coordinates & Location</h3>
                <button
                  type="button"
                  className="pm-capture-btn"
                  onClick={handleCaptureCurrentLocation}
                  disabled={isCapturingLocation}
                >
                  {isCapturingLocation ? (
                    <>
                      <Loader2 size={14} className="pm-spinner" />
                      <span>Detecting...</span>
                    </>
                  ) : (
                    <>
                      <Navigation size={14} />
                      <span>Capture Current Location</span>
                    </>
                  )}
                </button>
              </div>

              {locationError && (
                <div className="pm-alert pm-alert-error">
                  <AlertTriangle size={15} />
                  <span>{locationError}</span>
                </div>
              )}

              {locationSuccess && (
                <div className="pm-alert pm-alert-success">
                  <CheckCircle size={15} />
                  <span>{locationSuccess}</span>
                </div>
              )}

              <div className="pm-coord-grid">
                <div className="pm-field">
                  <label className="pm-label">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    className={`pm-input ${validationErrors.latitude ? 'has-error' : ''}`}
                    placeholder="e.g. 23.0338"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                  />
                  {validationErrors.latitude && (
                    <span className="pm-error-text">{validationErrors.latitude}</span>
                  )}
                </div>
                <div className="pm-field">
                  <label className="pm-label">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    className={`pm-input ${validationErrors.longitude ? 'has-error' : ''}`}
                    placeholder="e.g. 72.5850"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                  />
                  {validationErrors.longitude && (
                    <span className="pm-error-text">{validationErrors.longitude}</span>
                  )}
                </div>
              </div>

              {/* Geofence Configuration Section */}
              <div className="pm-geofence-box">
                <div className="pm-geofence-toggle-row">
                  <div className="pm-toggle-info">
                    <span className="pm-toggle-title">Project Geofence Perimeter</span>
                    <span className="pm-toggle-desc">
                      Configure circular or polygon boundary for project area
                    </span>
                  </div>
                  <label className="pm-switch">
                    <input
                      type="checkbox"
                      checked={enableGeofence}
                      onChange={(e) => setEnableGeofence(e.target.checked)}
                    />
                    <span className="pm-slider"></span>
                  </label>
                </div>

                {enableGeofence && (
                  <div className="pm-geofence-controls">
                    <div className="pm-type-selector">
                      <button
                        type="button"
                        className={`pm-type-btn ${boundaryType === 'circle' ? 'active' : ''}`}
                        onClick={() => setBoundaryType('circle')}
                      >
                        <Circle size={15} />
                        <span>Circular</span>
                      </button>
                      <button
                        type="button"
                        className={`pm-type-btn ${boundaryType === 'polygon' ? 'active' : ''}`}
                        onClick={() => setBoundaryType('polygon')}
                      >
                        <Pentagon size={15} />
                        <span>Polygon</span>
                      </button>
                    </div>

                    {boundaryType === 'circle' ? (
                      <div className="pm-circle-controls">
                        <div className="pm-radius-row">
                          <label className="pm-label">
                            Radius: <strong>{radius} meters</strong>
                          </label>
                          <input
                            type="range"
                            min="20"
                            max="5000"
                            step="10"
                            value={radius}
                            onChange={(e) => setRadius(Number(e.target.value))}
                            className="pm-range"
                          />
                        </div>
                        {validationErrors.radius && (
                          <span className="pm-error-text">{validationErrors.radius}</span>
                        )}
                      </div>
                    ) : (
                      <div className="pm-polygon-controls">
                        <div className="pm-poly-header">
                          <span className="pm-poly-count">
                            Points captured: <strong>{polygonPoints.length}</strong> (min. 3)
                          </span>
                          <button
                            type="button"
                            className="pm-poly-clear-btn"
                            onClick={handleClearPolygon}
                            disabled={polygonPoints.length === 0}
                          >
                            <RefreshCw size={12} />
                            <span>Clear Polygon</span>
                          </button>
                        </div>
                        <p className="pm-poly-hint">
                          Click on the map preview below to add boundary vertices.
                        </p>
                        {validationErrors.polygon && (
                          <span className="pm-error-text">{validationErrors.polygon}</span>
                        )}
                      </div>
                    )}

                    {/* Interactive Leaflet Map Preview */}
                    <div className="pm-map-container" ref={mapContainerRef}></div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pm-footer">
            <button
              type="button"
              className="pm-btn-secondary"
              onClick={() => dispatch(closeCreateModal())}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="pm-btn-primary"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="pm-spinner" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{editingProject ? 'Update Project' : 'Create Project'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

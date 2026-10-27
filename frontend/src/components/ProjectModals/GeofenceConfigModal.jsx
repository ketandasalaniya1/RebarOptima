import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { X, Shield, Plus, Trash2, Circle, Pentagon, RefreshCw, AlertTriangle, CheckCircle, Loader2, MapPin } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { projectsApi } from '../../utils/api';
import { updateProjectInList, closeGeofenceModal } from '../../store/slices/projectSlice';
import './GeofenceConfigModal.css';

export default function GeofenceConfigModal() {
  const dispatch = useDispatch();
  const project = useSelector((state) => state.project.geofenceModalProject);

  const [geofences, setGeofences] = useState([]);
  const [activeGfIndex, setActiveGfIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Leaflet map refs
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersMapRef = useRef(new Map());

  // Initialize geofences from project
  useEffect(() => {
    if (project) {
      if (project.geofences && project.geofences.length > 0) {
        setGeofences(JSON.parse(JSON.stringify(project.geofences)));
      } else {
        // Default initial circle geofence centered on project location
        const defaultCenter = project.location || { latitude: 23.0225, longitude: 72.5714 };
        setGeofences([
          {
            id: `gf_${Date.now()}`,
            name: 'Primary Site Boundary',
            boundaryType: 'circle',
            center: {
              latitude: Number(defaultCenter.latitude),
              longitude: Number(defaultCenter.longitude),
            },
            radius: 300,
            isActive: true,
          },
        ]);
      }
      setActiveGfIndex(0);
      setApiError('');
      setSuccessMsg('');
    }
  }, [project]);

  // Leaflet Map Initialization & Sync
  useEffect(() => {
    if (!project || !mapContainerRef.current) return;

    const centerLat = project.location?.latitude || 23.0225;
    const centerLng = project.location?.longitude || 72.5714;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLng],
        zoom: 15,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      // Project center pin
      L.marker([centerLat, centerLng], {
        title: project.name,
      }).addTo(map).bindPopup(`<b>${project.name}</b><br/>Project Site Center`);

      // Click to add polygon vertex or move circle center
      map.on('click', (e) => {
        const lat = Number(e.latlng.lat.toFixed(6));
        const lng = Number(e.latlng.lng.toFixed(6));

        setGeofences((prev) => {
          if (prev.length === 0) return prev;
          const updated = [...prev];
          const curr = { ...updated[activeGfIndex] };

          if (curr.boundaryType === 'circle') {
            curr.center = { latitude: lat, longitude: lng };
          } else if (curr.boundaryType === 'polygon') {
            curr.coordinates = [...(curr.coordinates || []), [lng, lat]];
          }

          updated[activeGfIndex] = curr;
          return updated;
        });
      });

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Clear old geofence overlay layers
    layersMapRef.current.forEach((layer) => layer.remove());
    layersMapRef.current.clear();

    // Render all geofences
    geofences.forEach((gf, idx) => {
      const isCurrent = idx === activeGfIndex;
      const strokeColor = isCurrent ? '#10b981' : '#3b82f6';
      const fillColor = isCurrent ? '#10b981' : '#60a5fa';

      if (gf.boundaryType === 'circle' && gf.center) {
        const circleLayer = L.circle([gf.center.latitude, gf.center.longitude], {
          radius: Number(gf.radius) || 100,
          color: strokeColor,
          fillColor: fillColor,
          fillOpacity: isCurrent ? 0.25 : 0.12,
          weight: isCurrent ? 3 : 1.5,
        }).addTo(map);

        circleLayer.bindTooltip(`${gf.name} (${gf.radius}m)`);
        layersMapRef.current.set(`circle_${idx}`, circleLayer);
      } else if (gf.boundaryType === 'polygon' && Array.isArray(gf.coordinates) && gf.coordinates.length >= 3) {
        const latLngs = gf.coordinates.map((pt) => [pt[1], pt[0]]);
        const polyLayer = L.polygon(latLngs, {
          color: strokeColor,
          fillColor: fillColor,
          fillOpacity: isCurrent ? 0.25 : 0.12,
          weight: isCurrent ? 3 : 1.5,
        }).addTo(map);

        polyLayer.bindTooltip(gf.name);
        layersMapRef.current.set(`poly_${idx}`, polyLayer);
      }
    });

    // Invalidate size
    setTimeout(() => {
      map.invalidateSize();
    }, 120);
  }, [geofences, activeGfIndex, project]);

  // Clean map on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const activeGf = geofences[activeGfIndex] || {};

  const handleUpdateActiveField = (field, value) => {
    setGeofences((prev) => {
      const updated = [...prev];
      updated[activeGfIndex] = {
        ...updated[activeGfIndex],
        [field]: value,
      };
      return updated;
    });
  };

  const handleAddGeofence = () => {
    const centerLat = project.location?.latitude || 23.0225;
    const centerLng = project.location?.longitude || 72.5714;

    const newGf = {
      id: `gf_${Date.now()}`,
      name: `Geofence Zone ${geofences.length + 1}`,
      boundaryType: 'circle',
      center: { latitude: centerLat, longitude: centerLng },
      radius: 200,
      isActive: true,
    };

    setGeofences((prev) => [...prev, newGf]);
    setActiveGfIndex(geofences.length);
  };

  const handleRemoveGeofence = (idx, e) => {
    e.stopPropagation();
    if (geofences.length <= 1) {
      setApiError('At least one geofence boundary is required.');
      return;
    }
    const updated = geofences.filter((_, i) => i !== idx);
    setGeofences(updated);
    setActiveGfIndex(Math.max(0, idx - 1));
  };

  const handleClearPolygon = () => {
    handleUpdateActiveField('coordinates', []);
  };

  const handleSave = async () => {
    setApiError('');
    setSuccessMsg('');

    // Validate all geofences
    for (const [idx, gf] of geofences.entries()) {
      if (!gf.name || !gf.name.trim()) {
        setApiError(`Geofence #${idx + 1} requires a name`);
        return;
      }
      if (gf.boundaryType === 'circle') {
        const rad = Number(gf.radius);
        if (isNaN(rad) || rad <= 0) {
          setApiError(`Geofence "${gf.name}" radius must be a positive number`);
          return;
        }
        if (rad > 50000) {
          setApiError(`Geofence "${gf.name}" radius cannot exceed 50,000 meters`);
          return;
        }
      } else if (gf.boundaryType === 'polygon') {
        if (!Array.isArray(gf.coordinates) || gf.coordinates.length < 3) {
          setApiError(`Polygon geofence "${gf.name}" requires at least 3 points. Click map to add points.`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const projId = project._id || project.id;
      const updated = await projectsApi.updateGeofences(projId, geofences);
      dispatch(updateProjectInList(updated));
      setSuccessMsg('Geofence configuration saved successfully!');
      setTimeout(() => {
        dispatch(closeGeofenceModal());
      }, 900);
    } catch (err) {
      setApiError(err.message || 'Failed to update geofence configuration.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!project) return null;

  return (
    <div className="geofence-modal-backdrop" onClick={() => dispatch(closeGeofenceModal())}>
      <div className="geofence-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="gfm-header">
          <div className="gfm-header-left">
            <div className="gfm-icon-box">
              <Shield size={20} />
            </div>
            <div>
              <h2 className="gfm-title">Geofence Boundary Configuration</h2>
              <p className="gfm-subtitle">
                Project: <strong>{project.name}</strong> • Define circular or polygon boundaries
              </p>
            </div>
          </div>
          <button
            type="button"
            className="gfm-close-btn"
            onClick={() => dispatch(closeGeofenceModal())}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="gfm-body">
          {apiError && (
            <div className="gfm-alert gfm-alert-error">
              <AlertTriangle size={16} />
              <span>{apiError}</span>
            </div>
          )}
          {successMsg && (
            <div className="gfm-alert gfm-alert-success">
              <CheckCircle size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="gfm-layout">
            {/* Left Column: Geofence Zones & Active Controls */}
            <div className="gfm-sidebar">
              <div className="gfm-zones-header">
                <span className="gfm-zones-title">Defined Geofence Zones</span>
                <button
                  type="button"
                  className="gfm-add-zone-btn"
                  onClick={handleAddGeofence}
                >
                  <Plus size={13} />
                  <span>Add Zone</span>
                </button>
              </div>

              {/* Zone List */}
              <div className="gfm-zones-list">
                {geofences.map((gf, idx) => (
                  <div
                    key={gf.id || idx}
                    className={`gfm-zone-item ${idx === activeGfIndex ? 'active' : ''}`}
                    onClick={() => setActiveGfIndex(idx)}
                  >
                    <div className="gfm-zone-item-left">
                      {gf.boundaryType === 'circle' ? (
                        <Circle size={14} className="text-emerald" />
                      ) : (
                        <Pentagon size={14} className="text-blue" />
                      )}
                      <span className="gfm-zone-name">{gf.name}</span>
                    </div>
                    {geofences.length > 1 && (
                      <button
                        type="button"
                        className="gfm-zone-delete"
                        onClick={(e) => handleRemoveGeofence(idx, e)}
                        title="Delete Zone"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Active Zone Editor */}
              {activeGf && (
                <div className="gfm-active-editor">
                  <h4 className="gfm-editor-title">Edit Zone: {activeGf.name}</h4>

                  <div className="gfm-field">
                    <label className="gfm-label">Zone Name</label>
                    <input
                      type="text"
                      className="gfm-input"
                      value={activeGf.name || ''}
                      onChange={(e) => handleUpdateActiveField('name', e.target.value)}
                    />
                  </div>

                  <div className="gfm-field">
                    <label className="gfm-label">Boundary Type</label>
                    <div className="gfm-type-switch">
                      <button
                        type="button"
                        className={`gfm-type-btn ${activeGf.boundaryType === 'circle' ? 'active' : ''}`}
                        onClick={() => handleUpdateActiveField('boundaryType', 'circle')}
                      >
                        <Circle size={14} />
                        <span>Circle</span>
                      </button>
                      <button
                        type="button"
                        className={`gfm-type-btn ${activeGf.boundaryType === 'polygon' ? 'active' : ''}`}
                        onClick={() => handleUpdateActiveField('boundaryType', 'polygon')}
                      >
                        <Pentagon size={14} />
                        <span>Polygon</span>
                      </button>
                    </div>
                  </div>

                  {activeGf.boundaryType === 'circle' ? (
                    <div className="gfm-circle-editor">
                      <div className="gfm-field">
                        <label className="gfm-label">
                          Radius: <strong>{activeGf.radius || 200} meters</strong>
                        </label>
                        <input
                          type="range"
                          min="30"
                          max="5000"
                          step="10"
                          className="gfm-range"
                          value={activeGf.radius || 200}
                          onChange={(e) => handleUpdateActiveField('radius', Number(e.target.value))}
                        />
                      </div>
                      <p className="gfm-hint">
                        Click on the map to place or reposition the circular perimeter center.
                      </p>
                    </div>
                  ) : (
                    <div className="gfm-polygon-editor">
                      <div className="gfm-poly-stats">
                        <span>Vertices: <strong>{(activeGf.coordinates || []).length}</strong></span>
                        <button
                          type="button"
                          className="gfm-clear-poly-btn"
                          onClick={handleClearPolygon}
                          disabled={!activeGf.coordinates || activeGf.coordinates.length === 0}
                        >
                          <RefreshCw size={12} />
                          <span>Clear Points</span>
                        </button>
                      </div>
                      <p className="gfm-hint">
                        Click on the map to add boundary points (minimum 3 points required).
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Interactive Map */}
            <div className="gfm-map-panel">
              <div className="gfm-map-header">
                <span className="gfm-map-title">Interactive Boundary Preview</span>
                <span className="gfm-map-coord">
                  Site: {project.location?.latitude?.toFixed(4)}, {project.location?.longitude?.toFixed(4)}
                </span>
              </div>
              <div className="gfm-map-viewport" ref={mapContainerRef}></div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="gfm-footer">
          <button
            type="button"
            className="gfm-btn-secondary"
            onClick={() => dispatch(closeGeofenceModal())}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="gfm-btn-primary"
            onClick={handleSave}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="pm-spinner" />
                <span>Saving Geofences...</span>
              </>
            ) : (
              <span>Save Geofence Configuration</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

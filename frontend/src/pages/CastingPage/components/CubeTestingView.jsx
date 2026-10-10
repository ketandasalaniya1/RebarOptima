import React, { useState, useEffect } from 'react';
import { 
  FlaskConical, Plus, CheckCircle2, AlertTriangle, XCircle, Search, 
  Filter, FileText, Shield, Award, RefreshCw, Info, Calendar, ArrowRight,
  TrendingUp, Check, AlertOctagon
} from 'lucide-react';
import { castingApi } from '../castingApi';

export default function CubeTestingView({ selectedProject, events = [] }) {
  const [samples, setSamples] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterEventId, setFilterEventId] = useState('');
  const [filterGrade, setFilterGrade] = useState('');

  // Modals
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showEvaluateModal, setShowEvaluateModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedEvaluationForReview, setSelectedEvaluationForReview] = useState(null);

  // Registration Form State
  const [regForm, setRegForm] = useState({
    castingEventId: '',
    segmentId: '',
    pourDate: new Date().toISOString().split('T')[0],
    testingAgeDays: 28,
    concreteGrade: 'M25',
    shift: 'DAY',
    sampleNumber: 'S-01',
    batchNumber: 'B-01',
    cube1LoadKn: '',
    cube1WeightKg: 8.2,
    cube2LoadKn: '',
    cube2WeightKg: 8.25,
    cube3LoadKn: '',
    cube3WeightKg: 8.18,
    testedBy: 'Lab Tech Sharma',
    notes: ''
  });

  // Evaluation Form State
  const [evalForm, setEvalForm] = useState({
    concreteGrade: 'M25',
    standardDeviationSource: 'IS456_TABLE_8',
    siteControlDegree: 'GOOD',
    totalSamplesInHistory: 35,
    customStandardDeviation: 4.0,
    curingCondition: 'LAB_MOIST_27C',
    testedAtAgeDays: 28
  });

  // Engineer Review Form State
  const [reviewForm, setReviewForm] = useState({
    decision: 'ACCEPTED',
    engineeringRationale: '',
    structuralImplication: 'Full structural capacity verified per IS 456 Table 11',
    professionalRegistrationId: 'CE-IND-2024-9842',
    reviewedBy: 'Er. Rajesh K. (Chartered Structural Engineer)',
    ndtReference: ''
  });

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [evalResultPreview, setEvalResultPreview] = useState(null);

  const pId = selectedProject?.id || selectedProject?._id;

  useEffect(() => {
    if (pId) {
      loadData();
    }
  }, [pId, filterEventId, filterGrade]);

  const loadData = async () => {
    if (!pId) return;
    setLoading(true);
    try {
      const params = { projectId: pId };
      if (filterEventId) params.castingEventId = filterEventId;
      if (filterGrade) params.grade = filterGrade;

      const [samplesRes, evalsRes] = await Promise.all([
        castingApi.getCubeSamples(params).catch(() => ({ success: true, data: [] })),
        castingApi.getCubeEvaluations({ projectId: pId }).catch(() => ({ success: true, data: [] }))
      ]);

      setSamples(Array.isArray(samplesRes?.data) ? samplesRes.data : []);
      setEvaluations(Array.isArray(evalsRes?.data) ? evalsRes.data : []);
    } catch (err) {
      console.error('Error loading cube data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Real-time calculation of strengths and Cl 15.4 deviation
  const calcStrengths = () => {
    const l1 = parseFloat(regForm.cube1LoadKn) || 0;
    const l2 = parseFloat(regForm.cube2LoadKn) || 0;
    const l3 = parseFloat(regForm.cube3LoadKn) || 0;

    const s1 = l1 > 0 ? (l1 * 1000) / 22500 : 0;
    const s2 = l2 > 0 ? (l2 * 1000) / 22500 : 0;
    const s3 = l3 > 0 ? (l3 * 1000) / 22500 : 0;

    const avg = (s1 + s2 + s3) / 3;
    let maxDevPercent = 0;
    let isValid = false;

    if (s1 > 0 && s2 > 0 && s3 > 0) {
      const d1 = Math.abs(s1 - avg) / avg * 100;
      const d2 = Math.abs(s2 - avg) / avg * 100;
      const d3 = Math.abs(s3 - avg) / avg * 100;
      maxDevPercent = Math.max(d1, d2, d3);
      isValid = maxDevPercent <= 15.0;
    }

    return {
      s1: s1.toFixed(2),
      s2: s2.toFixed(2),
      s3: s3.toFixed(2),
      avg: avg.toFixed(2),
      maxDevPercent: maxDevPercent.toFixed(1),
      isValid,
      hasAllThree: l1 > 0 && l2 > 0 && l3 > 0
    };
  };

  const preview = calcStrengths();

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!regForm.castingEventId) {
      setFormError('Please select a Casting Event');
      return;
    }
    if (!regForm.cube1LoadKn || !regForm.cube2LoadKn || !regForm.cube3LoadKn) {
      setFormError('Please enter failure loads in kN for all 3 specimens');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        projectId: pId,
        castingEventId: regForm.castingEventId,
        segmentId: regForm.segmentId || undefined,
        pourDate: regForm.pourDate,
        testingAgeDays: Number(regForm.testingAgeDays),
        concreteGrade: regForm.concreteGrade,
        shift: regForm.shift,
        sampleNumber: regForm.sampleNumber,
        batchNumber: regForm.batchNumber,
        specimens: [
          {
            specimenNumber: 1,
            failureLoadKn: Number(regForm.cube1LoadKn),
            weightKg: Number(regForm.cube1WeightKg) || 8.2,
            dimensionMm: { length: 150, width: 150, height: 150 }
          },
          {
            specimenNumber: 2,
            failureLoadKn: Number(regForm.cube2LoadKn),
            weightKg: Number(regForm.cube2WeightKg) || 8.2,
            dimensionMm: { length: 150, width: 150, height: 150 }
          },
          {
            specimenNumber: 3,
            failureLoadKn: Number(regForm.cube3LoadKn),
            weightKg: Number(regForm.cube3WeightKg) || 8.2,
            dimensionMm: { length: 150, width: 150, height: 150 }
          }
        ],
        testedBy: regForm.testedBy,
        notes: regForm.notes
      };

      const res = await castingApi.registerCubeSample(payload);
      if (res.success) {
        setShowRegisterModal(false);
        await loadData();
      } else {
        setFormError(res.error || 'Failed to register cube sample');
      }
    } catch (err) {
      setFormError(err.message || 'Error submitting sample');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRunEvaluation = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const payload = {
        projectId: pId,
        concreteGrade: evalForm.concreteGrade,
        standardDeviationSource: evalForm.standardDeviationSource,
        siteControlDegree: evalForm.siteControlDegree,
        totalSamplesInHistory: Number(evalForm.totalSamplesInHistory),
        customStandardDeviation: evalForm.standardDeviationSource === 'ESTABLISHED_PLANT_DATA' ? Number(evalForm.customStandardDeviation) : undefined,
        curingCondition: evalForm.curingCondition,
        testedAtAgeDays: Number(evalForm.testedAtAgeDays)
      };

      const res = await castingApi.runCubeEvaluation(payload);
      if (res.success) {
        setEvalResultPreview(res.data);
        await loadData();
      } else {
        setFormError(res.error || 'Failed to run compliance evaluation');
      }
    } catch (err) {
      setFormError(err.message || 'Error running evaluation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEngineerReviewSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEvaluationForReview) return;
    setFormError('');
    if (!reviewForm.engineeringRationale || reviewForm.engineeringRationale.length < 10) {
      setFormError('Engineering rationale must be at least 10 characters long');
      return;
    }

    setSubmitting(true);
    try {
      const evalId = selectedEvaluationForReview._id || selectedEvaluationForReview.id;
      const res = await castingApi.approveCubeEvaluation(evalId, {
        decision: reviewForm.decision,
        engineeringRationale: reviewForm.engineeringRationale,
        structuralImplication: reviewForm.structuralImplication,
        professionalRegistrationId: reviewForm.professionalRegistrationId,
        reviewedBy: reviewForm.reviewedBy,
        ndtReference: reviewForm.ndtReference || undefined
      });

      if (res.success) {
        setShowReviewModal(false);
        setSelectedEvaluationForReview(null);
        await loadData();
      } else {
        setFormError(res.error || 'Review approval rejected by server');
      }
    } catch (err) {
      setFormError(err.message || 'Error signing review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="cube-testing-view">
      {/* View Header */}
      <div className="view-subbar">
        <div className="view-subbar-left">
          <div className="view-badge purple">
            <FlaskConical size={16} /> IS 456:2000 Cl 15 & Amd 4 Table 11
          </div>
          <span className="view-subbar-title">Concrete Cube Compressive Strength Register</span>
        </div>
        <div className="view-subbar-actions">
          <button 
            className="casting-btn casting-btn-secondary casting-btn-sm"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button 
            className="casting-btn btn-outline casting-btn-sm"
            onClick={() => {
              setEvalResultPreview(null);
              setFormError('');
              setShowEvaluateModal(true);
            }}
          >
            <Award size={14} /> Run Table 11 Evaluation
          </button>
          <button 
            className="casting-btn casting-btn-primary casting-btn-sm"
            onClick={() => {
              setFormError('');
              setShowRegisterModal(true);
            }}
          >
            <Plus size={14} /> Register Cube Sample
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="curing-filter-bar">
        <div className="filter-group">
          <Filter size={14} />
          <span className="filter-label">Filter Pour Event:</span>
          <select 
            value={filterEventId} 
            onChange={(e) => setFilterEventId(e.target.value)}
            className="filter-select"
          >
            <option value="">All Casting Events</option>
            {events.map(ev => (
              <option key={ev._id || ev.id} value={ev._id || ev.id}>
                {ev.pourType || 'Pour'} - {new Date(ev.scheduledDate || ev.pourDate).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <span className="filter-label">Grade:</span>
          <select 
            value={filterGrade} 
            onChange={(e) => setFilterGrade(e.target.value)}
            className="filter-select"
          >
            <option value="">All Grades</option>
            {['M15', 'M20', 'M25', 'M30', 'M35', 'M40', 'M45', 'M50'].map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        <div className="filter-info">
          Showing {samples.length} registered sample sets ({samples.length * 3} individual cubes)
        </div>
      </div>

      {/* Main Content: Split Grid or Sections */}
      <div className="cube-testing-workspace">
        {/* Section 1: Cube Samples Register */}
        <div className="cube-section">
          <div className="section-header">
            <h4>Registered Sample Sets (3 Specimens per Set)</h4>
            <span className="section-tag">IS 456 Cl 15.4 ±15% Rule</span>
          </div>

          {samples.length === 0 ? (
            <div className="empty-state-pane">
              <FlaskConical size={36} className="empty-icon" />
              <p>No cube samples registered yet for this project.</p>
              <button 
                className="btn-primary btn-sm"
                onClick={() => setShowRegisterModal(true)}
              >
                Register First Sample
              </button>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="quality-table">
                <thead>
                  <tr>
                    <th>Sample #</th>
                    <th>Pour Date / Age</th>
                    <th>Grade / Shift</th>
                    <th>Specimen Loads (kN)</th>
                    <th>Compressive Strengths (MPa)</th>
                    <th>Average (MPa)</th>
                    <th>Cl 15.4 Validity</th>
                    <th>Lab Technician</th>
                    <th>Review Status</th>
                  </tr>
                </thead>
                <tbody>
                  {samples.map((s) => {
                    const isValid = s.complianceCheck?.isSpecimenValid;
                    const maxDev = s.complianceCheck?.maxDeviationPercent;
                    const avg = s.sampleAverageMpa;
                    return (
                      <tr key={s._id || s.id}>
                        <td>
                          <strong>{s.sampleNumber}</strong>
                          <div className="text-xs text-muted">Batch: {s.batchNumber}</div>
                        </td>
                        <td>
                          <div>{new Date(s.pourDate).toLocaleDateString()}</div>
                          <span className="badge-tag age-tag">{s.testingAgeDays} Days</span>
                        </td>
                        <td>
                          <span className="badge-tag grade-tag">{s.concreteGrade}</span>
                          <span className="text-xs text-muted ml-1">({s.shift})</span>
                        </td>
                        <td>
                          <div className="specimen-loads-list">
                            {s.specimens?.map((sp, idx) => (
                              <span key={idx} className="specimen-pill">
                                C{idx + 1}: {sp.failureLoadKn} kN
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <div className="specimen-loads-list">
                            {s.specimens?.map((sp, idx) => (
                              <span key={idx} className="specimen-pill mpa">
                                {sp.compressiveStrengthMpa.toFixed(2)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <strong className="text-lg">{avg ? avg.toFixed(2) : '-'}</strong>
                          <span className="text-xs text-muted"> MPa</span>
                        </td>
                        <td>
                          {isValid ? (
                            <span className="status-badge success" title={`Max variation: ${maxDev?.toFixed(1)}% ≤ 15%`}>
                              <CheckCircle2 size={12} /> VALID (±{maxDev?.toFixed(1)}%)
                            </span>
                          ) : (
                            <span className="status-badge danger" title={`Max variation: ${maxDev?.toFixed(1)}% > 15% - Strictly Prohibited to Average`}>
                              <AlertOctagon size={12} /> INVALID ({maxDev?.toFixed(1)}%)
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="text-sm">{s.testedBy}</div>
                        </td>
                        <td>
                          <span className={`status-badge ${s.status === 'VALID' ? 'success' : s.status === 'INVALID' ? 'danger' : 'neutral'}`}>
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 2: IS 456 Table 11 Compliance Evaluations & Engineering Reviews */}
        <div className="cube-section mt-4">
          <div className="section-header">
            <h4>IS 456:2000 Amd 4 Table 11 Compliance & Qualified Engineer Sign-offs</h4>
            <span className="section-tag">Formal Governance Stage-Gate</span>
          </div>

          {evaluations.length === 0 ? (
            <div className="empty-state-pane">
              <Award size={36} className="empty-icon" />
              <p>No compliance evaluations executed yet. Run Table 11 evaluation when samples are ready.</p>
              <button 
                className="btn-outline btn-sm"
                onClick={() => setShowEvaluateModal(true)}
              >
                Execute Table 11 Evaluation
              </button>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="quality-table">
                <thead>
                  <tr>
                    <th>Evaluation Date</th>
                    <th>Grade</th>
                    <th>Evaluated Samples</th>
                    <th>Pathway Applied</th>
                    <th>Mean Strength vs Criteria</th>
                    <th>Individual Min vs Criteria</th>
                    <th>Objective Status</th>
                    <th>Formal Engineer Decision</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluations.map((ev) => {
                    const isPassed = ev.objectiveComplianceStatus === 'COMPLIANT';
                    const isDeficient = ev.objectiveComplianceStatus === 'DEFICIENT_SAMPLING';
                    const hasReview = !!ev.engineerReview;

                    return (
                      <tr key={ev._id || ev.id}>
                        <td>{new Date(ev.evaluationDate).toLocaleDateString()}</td>
                        <td><span className="badge-tag grade-tag">{ev.concreteGrade}</span></td>
                        <td>
                          <strong>{ev.totalValidSamplesEvaluated} Samples</strong>
                          <div className="text-xs text-muted">Target SD: {ev.standardDeviationAssumed} N/mm²</div>
                        </td>
                        <td>
                          <span className="pathway-badge" title={ev.pathwayApplied}>
                            {ev.pathwayApplied.replace('IS456_TABLE11_', '')}
                          </span>
                        </td>
                        <td>
                          <div>Actual: <strong>{ev.criteriaCalculations?.actualMean?.toFixed(2)}</strong> MPa</div>
                          <div className="text-xs text-muted">Req: ≥ {ev.criteriaCalculations?.requiredMean?.toFixed(2)} MPa</div>
                        </td>
                        <td>
                          <div>Min: <strong>{ev.criteriaCalculations?.actualIndividualMin?.toFixed(2)}</strong> MPa</div>
                          <div className="text-xs text-muted">Req: ≥ {ev.criteriaCalculations?.requiredIndividualMin?.toFixed(2)} MPa</div>
                        </td>
                        <td>
                          <span className={`status-badge ${isPassed ? 'success' : isDeficient ? 'warning' : 'danger'}`}>
                            {ev.objectiveComplianceStatus}
                          </span>
                        </td>
                        <td>
                          {hasReview ? (
                            <div>
                              <span className={`status-badge ${ev.engineerReview.decision === 'ACCEPTED' ? 'success' : 'warning'}`}>
                                <Shield size={12} /> {ev.engineerReview.decision}
                              </span>
                              <div className="text-xs text-muted mt-1">
                                By: {ev.engineerReview.reviewedBy}
                              </div>
                              <div className="text-xs text-muted font-mono" title={ev.engineerReview.auditSignature}>
                                SHA: {ev.engineerReview.auditSignature?.substring(0, 10)}...
                              </div>
                            </div>
                          ) : (
                            <span className="status-badge neutral">
                              PENDING REVIEW
                            </span>
                          )}
                        </td>
                        <td>
                          {!hasReview && (
                            <button 
                              className="btn-primary btn-xs"
                              onClick={() => {
                                setSelectedEvaluationForReview(ev);
                                setFormError('');
                                setShowReviewModal(true);
                              }}
                            >
                              <Shield size={12} /> Review & Sign
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: REGISTER 3-SPECIMEN CUBE SAMPLE */}
      {showRegisterModal && (
        <div className="modal-backdrop">
          <div className="modal-content medium">
            <div className="modal-header">
              <h3>Register Concrete Cube Test Set (IS 456 Cl 15.4)</h3>
              <button className="btn-close" onClick={() => setShowRegisterModal(false)}>×</button>
            </div>
            <form onSubmit={handleRegisterSubmit}>
              <div className="modal-body">
                {formError && <div className="alert-banner danger">{formError}</div>}

                <div className="form-row-grid">
                  <div className="form-group">
                    <label>Casting Event *</label>
                    <select
                      value={regForm.castingEventId}
                      onChange={(e) => setRegForm({ ...regForm, castingEventId: e.target.value })}
                      required
                    >
                      <option value="">-- Select Event --</option>
                      {events.map((ev) => (
                        <option key={ev._id || ev.id} value={ev._id || ev.id}>
                          {ev.pourType || 'Pour'} ({new Date(ev.scheduledDate || ev.pourDate).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Concrete Grade *</label>
                    <select
                      value={regForm.concreteGrade}
                      onChange={(e) => setRegForm({ ...regForm, concreteGrade: e.target.value })}
                    >
                      {['M15', 'M20', 'M25', 'M30', 'M35', 'M40', 'M45', 'M50'].map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row-grid">
                  <div className="form-group">
                    <label>Pour Date *</label>
                    <input
                      type="date"
                      value={regForm.pourDate}
                      onChange={(e) => setRegForm({ ...regForm, pourDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Testing Age (Days) *</label>
                    <select
                      value={regForm.testingAgeDays}
                      onChange={(e) => setRegForm({ ...regForm, testingAgeDays: e.target.value })}
                    >
                      <option value="28">28 Days (Contractual Acceptance)</option>
                      <option value="7">7 Days (Early Indicative)</option>
                      <option value="14">14 Days</option>
                      <option value="3">3 Days (Early)</option>
                    </select>
                  </div>
                </div>

                <div className="form-row-grid">
                  <div className="form-group">
                    <label>Sample Tag / ID *</label>
                    <input
                      type="text"
                      value={regForm.sampleNumber}
                      onChange={(e) => setRegForm({ ...regForm, sampleNumber: e.target.value })}
                      placeholder="e.g. S-01"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Pour Shift *</label>
                    <select
                      value={regForm.shift}
                      onChange={(e) => setRegForm({ ...regForm, shift: e.target.value })}
                    >
                      <option value="DAY">Day Shift</option>
                      <option value="NIGHT">Night Shift</option>
                    </select>
                  </div>
                </div>

                {/* 3 SPECIMENS COMPRESSIVE STRENGTH INPUTS */}
                <div className="specimen-entry-card">
                  <div className="specimen-card-title">
                    <span>150mm Cube Specimen Testing (kN Failure Load)</span>
                    <span className="text-xs text-muted">Area = 22,500 mm²</span>
                  </div>

                  <div className="specimen-inputs-row">
                    <div className="specimen-input-col">
                      <label>Specimen 1 (kN)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 680"
                        value={regForm.cube1LoadKn}
                        onChange={(e) => setRegForm({ ...regForm, cube1LoadKn: e.target.value })}
                        required
                      />
                      <div className="calculated-mpa-preview">
                        {preview.s1 > 0 ? `${preview.s1} MPa` : '-'}
                      </div>
                    </div>

                    <div className="specimen-input-col">
                      <label>Specimen 2 (kN)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 695"
                        value={regForm.cube2LoadKn}
                        onChange={(e) => setRegForm({ ...regForm, cube2LoadKn: e.target.value })}
                        required
                      />
                      <div className="calculated-mpa-preview">
                        {preview.s2 > 0 ? `${preview.s2} MPa` : '-'}
                      </div>
                    </div>

                    <div className="specimen-input-col">
                      <label>Specimen 3 (kN)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 675"
                        value={regForm.cube3LoadKn}
                        onChange={(e) => setRegForm({ ...regForm, cube3LoadKn: e.target.value })}
                        required
                      />
                      <div className="calculated-mpa-preview">
                        {preview.s3 > 0 ? `${preview.s3} MPa` : '-'}
                      </div>
                    </div>
                  </div>

                  {/* IS 456 Cl 15.4 Instant Validation Banner */}
                  {preview.hasAllThree && (
                    <div className={`deviation-check-box ${preview.isValid ? 'valid' : 'invalid'}`}>
                      <div className="deviation-header">
                        <strong>Average Compressive Strength: {preview.avg} N/mm²</strong>
                        <span>Max Deviation: {preview.maxDevPercent}%</span>
                      </div>
                      {preview.isValid ? (
                        <div className="deviation-status text-success">
                          <CheckCircle2 size={16} /> IS 456 Cl 15.4 Compliant: All 3 specimens fall within ±15% of average.
                        </div>
                      ) : (
                        <div className="deviation-status text-danger">
                          <AlertTriangle size={16} /> IS 456 Cl 15.4 VIOLATION: Maximum specimen deviation ({preview.maxDevPercent}%) exceeds 15%.
                          <strong> Averaging only 2 specimens is strictly forbidden by standard. Sample will be marked INVALID.</strong>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="form-group mt-3">
                  <label>Testing Technician *</label>
                  <input
                    type="text"
                    value={regForm.testedBy}
                    onChange={(e) => setRegForm({ ...regForm, testedBy: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowRegisterModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Registering...' : 'Register Specimen Set'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EXECUTE TABLE 11 COMPLIANCE EVALUATION */}
      {showEvaluateModal && (
        <div className="modal-backdrop">
          <div className="modal-content medium">
            <div className="modal-header">
              <h3>IS 456:2000 Amd 4 Table 11 Batch Evaluation</h3>
              <button className="btn-close" onClick={() => setShowEvaluateModal(false)}>×</button>
            </div>
            <form onSubmit={handleRunEvaluation}>
              <div className="modal-body">
                {formError && <div className="alert-banner danger">{formError}</div>}

                <div className="form-row-grid">
                  <div className="form-group">
                    <label>Concrete Grade to Evaluate *</label>
                    <select
                      value={evalForm.concreteGrade}
                      onChange={(e) => setEvalForm({ ...evalForm, concreteGrade: e.target.value })}
                    >
                      {['M15', 'M20', 'M25', 'M30', 'M35', 'M40', 'M45', 'M50'].map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Testing Age Target</label>
                    <input type="text" value="28 Days (IS 456 Table 11)" disabled />
                  </div>
                </div>

                <div className="form-row-grid">
                  <div className="form-group">
                    <label>Standard Deviation Basis *</label>
                    <select
                      value={evalForm.standardDeviationSource}
                      onChange={(e) => setEvalForm({ ...evalForm, standardDeviationSource: e.target.value })}
                    >
                      <option value="IS456_TABLE_8">IS 456:2000 Table 8 (Assumed SD)</option>
                      <option value="ESTABLISHED_PLANT_DATA">Established Plant SD (Requires ≥ 30 Samples)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Degree of Site Quality Control *</label>
                    <select
                      value={evalForm.siteControlDegree}
                      onChange={(e) => setEvalForm({ ...evalForm, siteControlDegree: e.target.value })}
                    >
                      <option value="GOOD">Good Control (Standard SD)</option>
                      <option value="FAIR">Fair Control (+1.0 N/mm² Penalty per Table 8 Note)</option>
                    </select>
                  </div>
                </div>

                {evalForm.standardDeviationSource === 'ESTABLISHED_PLANT_DATA' && (
                  <div className="form-row-grid bg-muted p-2 rounded">
                    <div className="form-group">
                      <label>Total Historical Samples (Min 30)</label>
                      <input
                        type="number"
                        value={evalForm.totalSamplesInHistory}
                        onChange={(e) => setEvalForm({ ...evalForm, totalSamplesInHistory: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Plant Established SD (N/mm²)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={evalForm.customStandardDeviation}
                        onChange={(e) => setEvalForm({ ...evalForm, customStandardDeviation: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                {evalResultPreview && (
                  <div className="evaluation-preview-card mt-3">
                    <div className="preview-header">
                      <strong>Evaluation Engine Result:</strong>
                      <span className={`status-badge ${evalResultPreview.objectiveComplianceStatus === 'COMPLIANT' ? 'success' : 'danger'}`}>
                        {evalResultPreview.objectiveComplianceStatus}
                      </span>
                    </div>
                    <div className="preview-details">
                      <div>Pathway: <strong>{evalResultPreview.pathwayApplied}</strong></div>
                      <div>Samples Evaluated: <strong>{evalResultPreview.totalValidSamplesEvaluated}</strong></div>
                      <div>Actual Mean: <strong>{evalResultPreview.criteriaCalculations?.actualMean?.toFixed(2)} MPa</strong> (Req: ≥ {evalResultPreview.criteriaCalculations?.requiredMean?.toFixed(2)} MPa)</div>
                      <div>Individual Min: <strong>{evalResultPreview.criteriaCalculations?.actualIndividualMin?.toFixed(2)} MPa</strong> (Req: ≥ {evalResultPreview.criteriaCalculations?.requiredIndividualMin?.toFixed(2)} MPa)</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowEvaluateModal(false)}>
                  Close
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Evaluating...' : 'Run Table 11 Evaluation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: FORMAL QUALIFIED ENGINEER REVIEW & AUDIT SIGN-OFF */}
      {showReviewModal && selectedEvaluationForReview && (
        <div className="modal-backdrop">
          <div className="modal-content medium">
            <div className="modal-header">
              <h3>Qualified Engineer Stage-Gate Sign-off (IS 456 Cl 16)</h3>
              <button className="btn-close" onClick={() => setShowReviewModal(false)}>×</button>
            </div>
            <form onSubmit={handleEngineerReviewSubmit}>
              <div className="modal-body">
                {formError && <div className="alert-banner danger">{formError}</div>}

                <div className="alert-banner info">
                  <Shield size={16} />
                  <span>
                    Objective Evaluation Status: <strong>{selectedEvaluationForReview.objectiveComplianceStatus}</strong>.
                    An independent licensed engineer must review structural safety before pouring or stripping proceeds.
                  </span>
                </div>

                <div className="form-group">
                  <label>Formal Engineering Decision *</label>
                  <select
                    value={reviewForm.decision}
                    onChange={(e) => setReviewForm({ ...reviewForm, decision: e.target.value })}
                  >
                    <option value="ACCEPTED">ACCEPTED — Conforms to structural specifications</option>
                    <option value="CONDITIONAL_ACCEPTANCE">CONDITIONAL ACCEPTANCE — Non-critical element with concessions</option>
                    <option value="NON_DESTRUCTIVE_INVESTIGATION_REQUIRED">NDT REQUIRED — Ultrasonic / Rebound Hammer / Core Test</option>
                    <option value="REJECTED">REJECTED — Strength inadequate, dismantle or structural strengthening</option>
                    <option value="UNDER_REVIEW">UNDER REVIEW — Additional analysis required</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Technical Rationale & Structural Justification (min 10 chars) *</label>
                  <textarea
                    rows="3"
                    value={reviewForm.engineeringRationale}
                    onChange={(e) => setReviewForm({ ...reviewForm, engineeringRationale: e.target.value })}
                    placeholder="State technical justification, structural safety assessment, and code references..."
                    required
                  />
                </div>

                <div className="form-row-grid">
                  <div className="form-group">
                    <label>Structural Implications</label>
                    <input
                      type="text"
                      value={reviewForm.structuralImplication}
                      onChange={(e) => setReviewForm({ ...reviewForm, structuralImplication: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Professional Registration / License ID *</label>
                    <input
                      type="text"
                      value={reviewForm.professionalRegistrationId}
                      onChange={(e) => setReviewForm({ ...reviewForm, professionalRegistrationId: e.target.value })}
                      placeholder="e.g. CE-IND-2024-9842"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Reviewing Chartered Engineer *</label>
                  <input
                    type="text"
                    value={reviewForm.reviewedBy}
                    onChange={(e) => setReviewForm({ ...reviewForm, reviewedBy: e.target.value })}
                    required
                  />
                </div>

                {reviewForm.decision === 'NON_DESTRUCTIVE_INVESTIGATION_REQUIRED' && (
                  <div className="form-group">
                    <label>Non-Destructive Testing Reference / Report ID</label>
                    <input
                      type="text"
                      value={reviewForm.ndtReference}
                      onChange={(e) => setReviewForm({ ...reviewForm, ndtReference: e.target.value })}
                      placeholder="e.g. NDT-REBOUND-2026-001"
                    />
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowReviewModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Signing...' : 'Affix Cryptographic Signature & Approve'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

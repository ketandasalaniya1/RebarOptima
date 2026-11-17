import { apiRequest } from './api';

export const activityTrackerApi = {
  // 1. Dashboard & Overview
  getSummary: (projectId, blockId) => {
    const qs = new URLSearchParams();
    if (projectId) qs.append('projectId', projectId);
    if (blockId && blockId !== 'ALL') qs.append('blockId', blockId);
    return apiRequest(`/activity-tracker/summary?${qs.toString()}`);
  },

  getOverview: (projectId, blockId) => {
    const qs = new URLSearchParams();
    if (projectId) qs.append('projectId', projectId);
    if (blockId && blockId !== 'ALL') qs.append('blockId', blockId);
    return apiRequest(`/activity-tracker/overview?${qs.toString()}`);
  },

  // 2. Activities CRUD & WBS
  getActivities: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== 'ALL') {
        qs.append(k, String(v));
      }
    });
    return apiRequest(`/activity-tracker/activities?${qs.toString()}`);
  },

  getActivityById: (id) => apiRequest(`/activity-tracker/activities/${id}`),

  createActivity: (data) =>
    apiRequest('/activity-tracker/activities', {
      method: 'POST',
      body: data,
    }),

  updateActivity: (id, data) =>
    apiRequest(`/activity-tracker/activities/${id}`, {
      method: 'PUT',
      body: data,
    }),

  archiveActivity: (id) =>
    apiRequest(`/activity-tracker/activities/${id}`, {
      method: 'DELETE',
    }),

  restoreActivity: (id) =>
    apiRequest(`/activity-tracker/activities/${id}/restore`, {
      method: 'PUT',
    }),

  saveWeightages: (id, data) =>
    apiRequest(`/activity-tracker/activities/${id}/weights`, {
      method: 'PUT',
      body: data,
    }),

  // 3. Daily Planner
  getPlannerToday: (projectId, blockId) => {
    const qs = new URLSearchParams();
    if (projectId) qs.append('projectId', projectId);
    if (blockId && blockId !== 'ALL') qs.append('blockId', blockId);
    return apiRequest(`/activity-tracker/planner/today?${qs.toString()}`);
  },

  getPlannerUpcoming: (projectId, blockId, days = 7) => {
    const qs = new URLSearchParams();
    if (projectId) qs.append('projectId', projectId);
    if (blockId && blockId !== 'ALL') qs.append('blockId', blockId);
    qs.append('days', String(days));
    return apiRequest(`/activity-tracker/planner/upcoming?${qs.toString()}`);
  },

  getPlannerHistory: (projectId, blockId, date) => {
    const qs = new URLSearchParams();
    if (projectId) qs.append('projectId', projectId);
    if (blockId && blockId !== 'ALL') qs.append('blockId', blockId);
    if (date) qs.append('date', date);
    return apiRequest(`/activity-tracker/planner/history?${qs.toString()}`);
  },

  // 4. Daily Updates & Historical Corrections
  listDailyUpdates: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== 'ALL') {
        qs.append(k, String(v));
      }
    });
    return apiRequest(`/activity-tracker/daily-updates?${qs.toString()}`);
  },

  submitDailyUpdate: (data) =>
    apiRequest('/activity-tracker/daily-updates', {
      method: 'POST',
      body: data,
    }),

  correctDailyUpdate: (id, data) =>
    apiRequest(`/activity-tracker/daily-updates/${id}/correct`, {
      method: 'PUT',
      body: data,
    }),

  // 5. Photographs
  uploadPhoto: (data) =>
    apiRequest('/activity-tracker/photos/upload', {
      method: 'POST',
      body: data,
    }),

  getPhotoUrl: (photoId) => `/api/activity-tracker/photos/${photoId}`,

  // 6. Assignable Team Members & Structural Hierarchy
  getAssignees: (projectId) => {
    const qs = new URLSearchParams();
    if (projectId) qs.append('projectId', projectId);
    return apiRequest(`/activity-tracker/assignees?${qs.toString()}`);
  },

  listBlocks: (projectId) => apiRequest(`/projects/${projectId}/blocks`),

  listFloors: (projectId, blockId) =>
    apiRequest(`/projects/${projectId}/blocks/${blockId}/floors`),

  // 7. Independent Reports Engine
  getReportPreview: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== 'ALL') {
        qs.append(k, String(v));
      }
    });
    return apiRequest(`/activity-tracker/reports/preview?${qs.toString()}`);
  },

  previewReport: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== 'ALL') {
        qs.append(k, String(v));
      }
    });
    return apiRequest(`/activity-tracker/reports/preview?${qs.toString()}`);
  },

  getProgressOverview: (blockId) => {
    const qs = new URLSearchParams();
    if (blockId && blockId !== 'ALL') qs.append('blockId', blockId);
    return apiRequest(`/activity-tracker/overview?${qs.toString()}`);
  },

  downloadReportPdf: async (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== 'ALL') {
        qs.append(k, String(v));
      }
    });
    const token = sessionStorage.getItem('accessToken') || '';
    const response = await fetch(`/api/activity-tracker/reports/pdf?${qs.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to generate PDF report');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RebarOptima_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  downloadReportExcel: async (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== 'ALL') {
        qs.append(k, String(v));
      }
    });
    const token = sessionStorage.getItem('accessToken') || '';
    const response = await fetch(`/api/activity-tracker/reports/excel?${qs.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to generate Excel report');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RebarOptima_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
};

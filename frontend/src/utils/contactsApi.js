import { apiRequest } from './api';

export const contactsApi = {
  /**
   * Fetch contacts list with filters, search, and pagination
   */
  async getContacts(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.categoryId && params.categoryId !== 'all') query.append('categoryId', params.categoryId);
    if (params.projectId && params.projectId !== 'all') query.append('projectId', params.projectId);
    if (params.visibility && params.visibility !== 'all') query.append('visibility', params.visibility);
    if (params.isFavourite) query.append('isFavourite', 'true');
    if (params.isArchived) query.append('isArchived', 'true');
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);

    const qs = query.toString();
    return apiRequest(`/contacts${qs ? `?${qs}` : ''}`);
  },

  /**
   * Fetch quick directory summary counters & category breakdown
   */
  async getSummary() {
    return apiRequest('/contacts/summary');
  },

  /**
   * Check if a phone number is already registered within this tenant
   */
  async checkDuplicatePhone(phone, excludeId = null) {
    if (!phone) return { exists: false, contact: null };
    const query = new URLSearchParams({ phone });
    if (excludeId) query.append('excludeId', excludeId);
    return apiRequest(`/contacts/check-duplicate?${query.toString()}`);
  },

  /**
   * Get single contact by ID with audit log & resolved associations
   */
  async getContactById(id) {
    return apiRequest(`/contacts/${id}`);
  },

  /**
   * Create a new contact
   */
  async createContact(data) {
    return apiRequest('/contacts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update an existing contact
   */
  async updateContact(id, data) {
    return apiRequest(`/contacts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete or soft-delete contact
   */
  async deleteContact(id, permanent = false) {
    return apiRequest(`/contacts/${id}${permanent ? '?permanent=true' : ''}`, {
      method: 'DELETE',
    });
  },

  /**
   * Archive contact
   */
  async archiveContact(id) {
    return apiRequest(`/contacts/${id}/archive`, {
      method: 'PUT',
    });
  },

  /**
   * Restore contact from archive
   */
  async restoreContact(id) {
    return apiRequest(`/contacts/${id}/restore`, {
      method: 'PUT',
    });
  },

  /**
   * Toggle favourite status
   */
  async toggleFavourite(id) {
    return apiRequest(`/contacts/${id}/favourite`, {
      method: 'PUT',
    });
  },

  /**
   * Categories
   */
  async getCategories() {
    return apiRequest('/contacts/categories');
  },

  async createCategory(name) {
    return apiRequest('/contacts/categories', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  async updateCategory(id, name) {
    return apiRequest(`/contacts/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  },

  async deleteCategory(id) {
    return apiRequest(`/contacts/categories/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Bulk Import: Preview
   */
  async previewImport(rows) {
    return apiRequest('/contacts/import/preview', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
  },

  /**
   * Bulk Import: Commit
   */
  async commitImport(contacts, skipDuplicates = true) {
    return apiRequest('/contacts/import/commit', {
      method: 'POST',
      body: JSON.stringify({ contacts, skipDuplicates }),
    });
  },

  /**
   * Download export file
   */
  async downloadExport(params = {}, format = 'xlsx') {
    const query = new URLSearchParams({ format });
    if (params.search) query.append('search', params.search);
    if (params.categoryId && params.categoryId !== 'all') query.append('categoryId', params.categoryId);
    if (params.projectId && params.projectId !== 'all') query.append('projectId', params.projectId);
    if (params.isArchived) query.append('isArchived', 'true');

    const token = sessionStorage.getItem('accessToken');
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    const url = `${API_BASE_URL}/contacts/export/download?${query.toString()}`;

    const res = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) throw new Error('Failed to export contacts');

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `CraveToBuild_Contacts.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);
  },
};


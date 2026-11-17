import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  BookUser,
  Search,
  Plus,
  Upload,
  Download,
  Filter,
  Star,
  Building2,
  Users,
  Archive,
  Grid,
  List,
  Tag,
  Clock,
  X,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { contactsApi } from '../../utils/contactsApi';
import { setSelectedProject } from '../../store/slices/projectSlice';
import ContactCard from './components/ContactCard';
import ContactTable from './components/ContactTable';
import ContactDetailDrawer from './components/ContactDetailDrawer';
import ContactFormModal from './components/ContactFormModal';
import ImportContactsModal from './components/ImportContactsModal';
import CategoryManagerModal from './components/CategoryManagerModal';
import './ContactDirectoryPage.css';

export default function ContactDirectoryPage() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const selectedProject = useSelector((state) => state.project.selectedProject);
  const projects = useSelector((state) => state.project.projects || []);

  const [contacts, setContacts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Filters state
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [visibilityFilter, setVisibilityFilter] = useState('all'); // 'all' | 'shared' | 'private'
  const [showFavouritesOnly, setShowFavouritesOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals / Drawers state
  const [detailContactId, setDetailContactId] = useState(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Role check
  const roleUpper = (user?.role || '').toUpperCase();
  const isFirmAdmin =
    roleUpper === 'ADMIN' ||
    roleUpper === 'OWNER' ||
    roleUpper === 'COMPANY_ADMIN' ||
    user?.accountType === 'developer';

  // 1. Fetch Summary & Categories
  const fetchSummaryAndCategories = useCallback(async () => {
    try {
      const [sumRes, catRes] = await Promise.allSettled([
        contactsApi.getSummary(),
        contactsApi.getCategories(),
      ]);

      if (sumRes.status === 'fulfilled') {
        setSummary(sumRes.value);
      }
      if (catRes.status === 'fulfilled') {
        setCategories(catRes.value || []);
      }
    } catch (_) {}
  }, []);

  // 2. Fetch Contacts List
  const fetchContacts = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setIsLoading(true);
      else setIsRefreshing(true);
      setErrorMsg('');

      const params = {
        search,
        categoryId: selectedCategory,
        projectId: selectedProjectId,
        visibility: visibilityFilter,
        isFavourite: showFavouritesOnly,
        isArchived: showArchived,
        page,
        limit: 24,
      };

      const res = await contactsApi.getContacts(params);
      setContacts(res.contacts || []);
      setTotalPages(res.totalPages || 1);
      setTotalCount(res.total || 0);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load contacts');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [search, selectedCategory, selectedProjectId, visibilityFilter, showFavouritesOnly, showArchived, page]);

  useEffect(() => {
    fetchSummaryAndCategories();
  }, [fetchSummaryAndCategories]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Actions
  const handleToggleFavourite = async (id) => {
    // Optimistic toggle
    setContacts((prev) =>
      prev.map((c) => ((c.id || c._id) === id ? { ...c, isFavourite: !c.isFavourite } : c))
    );
    try {
      await contactsApi.toggleFavourite(id);
      fetchSummaryAndCategories();
    } catch (_) {
      fetchContacts(true);
    }
  };

  const handleArchive = async (id) => {
    try {
      await contactsApi.archiveContact(id);
      fetchContacts(true);
      fetchSummaryAndCategories();
    } catch (err) {
      alert(err.message || 'Could not archive contact');
    }
  };

  const handleRestore = async (id) => {
    try {
      await contactsApi.restoreContact(id);
      fetchContacts(true);
      fetchSummaryAndCategories();
    } catch (err) {
      alert(err.message || 'Could not restore contact');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this contact?')) return;
    try {
      await contactsApi.deleteContact(id, isFirmAdmin);
      fetchContacts(true);
      fetchSummaryAndCategories();
    } catch (err) {
      alert(err.message || 'Could not delete contact');
    }
  };

  const handleExport = async (format = 'xlsx') => {
    try {
      await contactsApi.downloadExport(
        {
          search,
          categoryId: selectedCategory,
          projectId: selectedProjectId,
          isArchived: showArchived,
        },
        format
      );
    } catch (err) {
      alert(err.message || 'Failed to export contacts');
    }
  };

  const handleProjectSelect = (projId) => {
    const matched = projects.find((p) => String(p.id || p._id) === String(projId));
    if (matched) {
      dispatch(setSelectedProject(matched));
    }
    setSelectedProjectId(projId);
  };

  return (
    <div className="ro-contacts-page">
      {/* ── Top Header ── */}
      <div className="ro-contacts-header">
        <div className="ro-contacts-header-left">
          <div className="ro-contacts-icon-badge">
            <BookUser size={22} />
          </div>
          <div>
            <div className="ro-contacts-title-row">
              <h1 className="ro-contacts-title">Contact Directory</h1>
              <span className="ro-count-pill">{totalCount} {showArchived ? 'Archived' : 'Contacts'}</span>
            </div>
            <p className="ro-contacts-subtitle">
              Centralized organization directory for clients, contractors, suppliers, engineers, and site stakeholders
            </p>
          </div>
        </div>

        <div className="ro-contacts-header-actions">
          {isFirmAdmin && (
            <button
              type="button"
              className="ro-btn ro-btn--secondary"
              onClick={() => setIsCategoryModalOpen(true)}
              title="Configure stakeholder categories"
            >
              <Tag size={15} />
              <span className="hide-sm">Categories</span>
            </button>
          )}

          <button
            type="button"
            className="ro-btn ro-btn--secondary"
            onClick={() => setIsImportModalOpen(true)}
            title="Bulk import contacts from CSV or Excel"
          >
            <Upload size={15} />
            <span className="hide-sm">Import</span>
          </button>

          <button
            type="button"
            className="ro-btn ro-btn--secondary"
            onClick={() => handleExport('xlsx')}
            title="Export contacts to Excel"
          >
            <Download size={15} />
            <span className="hide-sm">Export</span>
          </button>

          <button
            type="button"
            className="ro-btn ro-btn--primary"
            onClick={() => {
              setEditingContact(null);
              setIsFormModalOpen(true);
            }}
          >
            <Plus size={16} />
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      {/* ── Metrics Cards Row ── */}
      <div className="ro-contacts-metrics-row">
        <button
          type="button"
          className={`ro-metric-card ${!showArchived && !showFavouritesOnly ? 'active' : ''}`}
          onClick={() => {
            setShowArchived(false);
            setShowFavouritesOnly(false);
            setPage(1);
          }}
        >
          <div className="ro-metric-icon bg-emerald">
            <Users size={16} />
          </div>
          <div className="ro-metric-data">
            <span className="ro-metric-val">{summary?.totalActive ?? totalCount}</span>
            <span className="ro-metric-lbl">Active Directory</span>
          </div>
        </button>

        <button
          type="button"
          className={`ro-metric-card ${showFavouritesOnly ? 'active' : ''}`}
          onClick={() => {
            setShowArchived(false);
            setShowFavouritesOnly(true);
            setPage(1);
          }}
        >
          <div className="ro-metric-icon bg-amber">
            <Star size={16} fill="#f59e0b" />
          </div>
          <div className="ro-metric-data">
            <span className="ro-metric-val">{summary?.totalFavourites ?? 0}</span>
            <span className="ro-metric-lbl">Favourite Contacts</span>
          </div>
        </button>

        <div className="ro-metric-card static-card">
          <div className="ro-metric-icon bg-blue">
            <Clock size={16} />
          </div>
          <div className="ro-metric-data">
            <span className="ro-metric-val">{summary?.totalRecent ?? 0}</span>
            <span className="ro-metric-lbl">Recently Added</span>
          </div>
        </div>

        <button
          type="button"
          className={`ro-metric-card ${showArchived ? 'active' : ''}`}
          onClick={() => {
            setShowArchived(true);
            setShowFavouritesOnly(false);
            setPage(1);
          }}
        >
          <div className="ro-metric-icon bg-gray">
            <Archive size={16} />
          </div>
          <div className="ro-metric-data">
            <span className="ro-metric-val">{summary?.totalArchived ?? 0}</span>
            <span className="ro-metric-lbl">Archived Contacts</span>
          </div>
        </button>
      </div>

      {/* ── Filter Toolbar ── */}
      <div className="ro-contacts-toolbar">
        {/* Search Input */}
        <div className="ro-search-box-wrap">
          <Search size={15} className="ro-search-icon" />
          <input
            type="text"
            placeholder="Search by name, phone, company, or designation…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="ro-search-input"
          />
          {search && (
            <button
              type="button"
              className="ro-search-clear-btn"
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Project Selector Filter */}
        <div className="ro-toolbar-select-wrap">
          <Building2 size={14} className="ro-select-prefix-icon" />
          <select
            value={selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
              setPage(1);
            }}
            className="ro-select"
            aria-label="Filter by project"
          >
            <option value="all">All Projects / Sites</option>
            {projects.map((p) => (
              <option key={p.id || p._id} value={p.id || p._id}>
                {p.name || p.projectName}
              </option>
            ))}
          </select>
        </div>

        {/* Visibility Filter */}
        <div className="ro-toolbar-select-wrap">
          <select
            value={visibilityFilter}
            onChange={(e) => {
              setVisibilityFilter(e.target.value);
              setPage(1);
            }}
            className="ro-select"
            aria-label="Filter by visibility"
          >
            <option value="all">All Visibility</option>
            <option value="shared">Company Shared</option>
            <option value="private">Private to Me</option>
          </select>
        </div>

        {/* View Switcher (Grid / Table) */}
        <div className="ro-view-mode-toggle" role="group" aria-label="View layout switch">
          <button
            type="button"
            className={`ro-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Card Grid View"
            aria-label="Card Grid View"
          >
            <Grid size={15} />
          </button>
          <button
            type="button"
            className={`ro-view-btn ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => setViewMode('table')}
            title="Spreadsheet Table View"
            aria-label="Spreadsheet Table View"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* ── Category Filter Pills Bar ── */}
      <div className="ro-categories-pill-bar">
        <button
          type="button"
          className={`ro-cat-pill-btn ${selectedCategory === 'all' ? 'active' : ''}`}
          onClick={() => {
            setSelectedCategory('all');
            setPage(1);
          }}
        >
          <span>All Categories</span>
        </button>

        {(summary?.categories || categories).map((cat) => {
          const cId = cat.id || cat._id;
          const isSelected = selectedCategory === cId;
          return (
            <button
              key={cId}
              type="button"
              className={`ro-cat-pill-btn ${isSelected ? 'active' : ''}`}
              onClick={() => {
                setSelectedCategory(cId);
                setPage(1);
              }}
            >
              <span>{cat.name}</span>
              {cat.count !== undefined && <span className="ro-cat-pill-count">{cat.count}</span>}
            </button>
          );
        })}
      </div>

      {/* ── Content Viewport ── */}
      <div className="ro-contacts-content-area">
        {isLoading ? (
          <div className="ro-contacts-loading-grid">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="ro-contact-card-skeleton" />
            ))}
          </div>
        ) : errorMsg ? (
          <div className="ro-contacts-error-state">
            <p>{errorMsg}</p>
            <button type="button" className="ro-btn ro-btn--secondary" onClick={() => fetchContacts()}>
              Retry Loading
            </button>
          </div>
        ) : contacts.length === 0 ? (
          <div className="ro-contacts-empty-state">
            <div className="ro-empty-icon-circle">
              <BookUser size={36} />
            </div>
            <h3>No contacts found</h3>
            <p>
              {search || selectedCategory !== 'all' || selectedProjectId !== 'all' || showFavouritesOnly
                ? 'No contacts match your current search and filter criteria.'
                : 'Start building your centralized organization directory with stakeholders, contractors, and suppliers.'}
            </p>
            <div className="ro-empty-actions">
              {(search || selectedCategory !== 'all' || selectedProjectId !== 'all' || showFavouritesOnly) && (
                <button
                  type="button"
                  className="ro-btn ro-btn--secondary"
                  onClick={() => {
                    setSearch('');
                    setSelectedCategory('all');
                    setSelectedProjectId('all');
                    setVisibilityFilter('all');
                    setShowFavouritesOnly(false);
                    setPage(1);
                  }}
                >
                  Clear Filters
                </button>
              )}
              <button
                type="button"
                className="ro-btn ro-btn--primary"
                onClick={() => {
                  setEditingContact(null);
                  setIsFormModalOpen(true);
                }}
              >
                <Plus size={16} />
                <span>Add Contact</span>
              </button>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="ro-contacts-cards-grid">
            {contacts.map((contact) => (
              <ContactCard
                key={contact.id || contact._id}
                contact={contact}
                onView={(c) => setDetailContactId(c.id || c._id)}
                onEdit={(c) => {
                  setEditingContact(c);
                  setIsFormModalOpen(true);
                }}
                onToggleFavourite={handleToggleFavourite}
                onArchive={handleArchive}
                onRestore={handleRestore}
                onDelete={handleDelete}
                onProjectClick={handleProjectSelect}
              />
            ))}
          </div>
        ) : (
          <ContactTable
            contacts={contacts}
            onView={(c) => setDetailContactId(c.id || c._id)}
            onEdit={(c) => {
              setEditingContact(c);
              setIsFormModalOpen(true);
            }}
            onToggleFavourite={handleToggleFavourite}
            onArchive={handleArchive}
            onRestore={handleRestore}
            onDelete={handleDelete}
            onProjectClick={handleProjectSelect}
          />
        )}

        {/* ── Pagination Bar ── */}
        {totalPages > 1 && (
          <div className="ro-contacts-pagination">
            <button
              type="button"
              className="ro-btn-page"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </button>
            <span className="ro-page-indicator">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="ro-btn-page"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* ── Slide-Over Contact Detail Drawer ── */}
      <ContactDetailDrawer
        isOpen={Boolean(detailContactId)}
        onClose={() => setDetailContactId(null)}
        contactId={detailContactId}
        onEdit={(c) => {
          setEditingContact(c);
          setIsFormModalOpen(true);
        }}
        onToggleFavourite={handleToggleFavourite}
        onArchive={handleArchive}
        onRestore={handleRestore}
        onDelete={handleDelete}
        onSelectProject={handleProjectSelect}
      />

      {/* ── Add / Edit Contact Modal ── */}
      <ContactFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingContact(null);
        }}
        initialContact={editingContact}
        categories={categories}
        projects={projects}
        onSaved={() => {
          fetchContacts();
          fetchSummaryAndCategories();
        }}
        onOpenDuplicateContact={(dupId) => {
          setDetailContactId(dupId);
        }}
      />

      {/* ── Bulk Import Modal ── */}
      <ImportContactsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={() => {
          fetchContacts();
          fetchSummaryAndCategories();
        }}
      />

      {/* ── Category Manager Modal ── */}
      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onCategoriesChanged={() => {
          fetchSummaryAndCategories();
        }}
      />
    </div>
  );
}


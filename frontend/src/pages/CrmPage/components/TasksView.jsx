import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CheckSquare, Circle, CheckCircle2, Clock, Flag, Plus, Search,
  Calendar, Repeat, Bell, Filter, LayoutList, Kanban, MoreVertical,
  Trash2, X, ChevronDown, ChevronRight, User, Building, DollarSign
} from 'lucide-react';
import { crmApi } from '../../../utils/crmApi';

export default function TasksView({
  leads = [],
  projects = [],
  units = [],
  bookings = [],
  onRefreshData
}) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'board'
  const [activeTab, setActiveTab] = useState('all_open'); // 'all_open' | 'today' | 'upcoming' | 'completed'
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [scopeFilter, setScopeFilter] = useState('all'); // 'all' | 'my'

  // Quick-Add bar state
  const [quickTitle, setQuickTitle] = useState('');
  const [quickDue, setQuickDue] = useState('today');
  const [quickPriority, setQuickPriority] = useState('Medium');
  const quickInputRef = useRef(null);

  // New Task Modal state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalPriority, setModalPriority] = useState('Medium');
  const [modalStatus, setModalStatus] = useState('Pending');
  const [modalDueDate, setModalDueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [modalDueTime, setModalDueTime] = useState('11:00');
  const [modalReminder, setModalReminder] = useState('none');
  const [modalRepeat, setModalRepeat] = useState('none');
  const [modalLeadId, setModalLeadId] = useState('');
  const [modalUnitId, setModalUnitId] = useState('');
  const [modalBookingId, setModalBookingId] = useState('');
  const [modalNotes, setModalNotes] = useState('');
  const [checklist, setChecklist] = useState([]);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch tasks
  const loadTasks = async () => {
    setLoading(true);
    try {
      const res = await crmApi.getTasks();
      setTasks(Array.isArray(res) ? res : []);
    } catch (err) {
      console.warn('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  // Keyboard shortcut 'N' listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.key.toLowerCase() === 'n' &&
        !['input', 'textarea', 'select'].includes(document.activeElement?.tagName?.toLowerCase())
      ) {
        e.preventDefault();
        quickInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Task Counts
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const stats = useMemo(() => {
    let openCount = 0;
    let overdueCount = 0;
    let doneTodayCount = 0;

    tasks.forEach(t => {
      const isCompleted = t.status === 'Completed';
      const due = t.dueDateTime ? new Date(t.dueDateTime) : null;

      if (!isCompleted) {
        openCount++;
        if (due && due < todayStart) overdueCount++;
      } else {
        const compTime = t.completedAt ? new Date(t.completedAt) : new Date(t.updatedAt || t.createdAt);
        if (compTime >= todayStart && compTime <= todayEnd) {
          doneTodayCount++;
        }
      }
    });

    return { openCount, overdueCount, doneTodayCount };
  }, [tasks, todayStart, todayEnd]);

  // Priority color
  const getPriorityColor = (p) => {
    switch (p?.toLowerCase()) {
      case 'urgent':
      case 'high':
        return '#ef4444';
      case 'medium':
        return '#f59e0b';
      default:
        return '#3b82f6';
    }
  };

  // Toggle complete
  const handleToggleTask = async (taskId) => {
    try {
      await crmApi.toggleTask(taskId);
      loadTasks();
      if (onRefreshData) onRefreshData();
    } catch (err) {
      alert('Failed to toggle task: ' + err.message);
    }
  };

  // Quick add submit
  const handleQuickAdd = async (e) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;

    let due = new Date();
    if (quickDue === 'tomorrow') due.setDate(due.getDate() + 1);
    else if (quickDue === 'in_3_days') due.setDate(due.getDate() + 3);
    else if (quickDue === 'next_week') due.setDate(due.getDate() + 7);

    try {
      await crmApi.createTask({
        title: quickTitle.trim(),
        priority: quickPriority,
        dueDateTime: due.toISOString(),
        status: 'Pending'
      });
      setQuickTitle('');
      loadTasks();
      if (onRefreshData) onRefreshData();
    } catch (err) {
      alert('Failed to add task: ' + err.message);
    }
  };

  // Open Task Modal (Create or Edit)
  const handleOpenModal = (task = null) => {
    if (task) {
      setEditingTask(task);
      setModalTitle(task.title || '');
      setModalPriority(task.priority || 'Medium');
      setModalStatus(task.status || 'Pending');
      const d = task.dueDateTime ? new Date(task.dueDateTime) : new Date();
      setModalDueDate(d.toISOString().split('T')[0]);
      setModalDueTime(d.toTimeString().slice(0, 5));
      setModalReminder(task.reminder_at ? 'reminder' : 'none');
      setModalRepeat(task.repeat_rule || 'none');
      setModalLeadId(task.unitInterestId || task.leadId || '');
      setModalUnitId(task.unitId || '');
      setModalBookingId(task.bookingId || '');
      setModalNotes(task.notes || '');
      setChecklist(Array.isArray(task.checklist) ? task.checklist : []);
    } else {
      setEditingTask(null);
      setModalTitle('');
      setModalPriority('Medium');
      setModalStatus('Pending');
      setModalDueDate(new Date().toISOString().split('T')[0]);
      setModalDueTime('11:00');
      setModalReminder('none');
      setModalRepeat('none');
      setModalLeadId('');
      setModalUnitId('');
      setModalBookingId('');
      setModalNotes('');
      setChecklist([]);
    }
    setShowTaskModal(true);
  };

  // Checklist adder
  const handleAddChecklistItem = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!newChecklistText.trim()) return;
      setChecklist(prev => [...prev, { id: Date.now().toString(), text: newChecklistText.trim(), done: false }]);
      setNewChecklistText('');
    }
  };

  const handleToggleChecklistItem = (id) => {
    setChecklist(prev => prev.map(c => c.id === id ? { ...c, done: !c.done } : c));
  };

  const handleDeleteChecklistItem = (id) => {
    setChecklist(prev => prev.filter(c => c.id !== id));
  };

  // Quick date chip setters
  const applyQuickDateChip = (daysOffset) => {
    if (daysOffset === null) {
      setModalDueDate('');
      return;
    }
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    setModalDueDate(d.toISOString().split('T')[0]);
  };

  // Save Modal
  const handleSaveModalTask = async (e) => {
    e.preventDefault();
    if (!modalTitle.trim()) return;
    setSubmitting(true);
    try {
      const fullDueDate = modalDueDate
        ? new Date(`${modalDueDate}T${modalDueTime || '10:00'}:00`).toISOString()
        : new Date().toISOString();

      const selectedLead = leads.find(l => (l._id || l.id) === modalLeadId);

      const payload = {
        title: modalTitle.trim(),
        priority: modalPriority,
        status: modalStatus,
        dueDateTime: fullDueDate,
        repeat_rule: modalRepeat,
        checklist,
        notes: modalNotes.trim(),
        leadId: modalLeadId || undefined,
        customerId: selectedLead?.customerId || undefined,
        customerName: selectedLead?.name || selectedLead?.customerName || undefined,
        unitId: modalUnitId || undefined,
        bookingId: modalBookingId || undefined
      };

      if (editingTask && editingTask._id) {
        await crmApi.updateTask(editingTask._id, payload);
      } else {
        await crmApi.createTask(payload);
      }

      setShowTaskModal(false);
      loadTasks();
      if (onRefreshData) onRefreshData();
    } catch (err) {
      alert('Failed to save task: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await crmApi.deleteTask(taskId);
      loadTasks();
      if (onRefreshData) onRefreshData();
    } catch (err) {
      alert('Failed to delete task: ' + err.message);
    }
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      // Tab filter
      const isCompleted = t.status === 'Completed';
      const due = t.dueDateTime ? new Date(t.dueDateTime) : null;

      if (activeTab === 'all_open' && isCompleted) return false;
      if (activeTab === 'today' && (isCompleted || !due || due < todayStart || due > todayEnd)) return false;
      if (activeTab === 'upcoming' && (isCompleted || !due || due <= todayEnd)) return false;
      if (activeTab === 'completed' && !isCompleted) return false;

      // Priority filter
      if (priorityFilter !== 'all' && t.priority?.toLowerCase() !== priorityFilter.toLowerCase()) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title?.toLowerCase().includes(q);
        const matchCust = t.customerName?.toLowerCase().includes(q);
        if (!matchTitle && !matchCust) return false;
      }

      return true;
    });
  }, [tasks, activeTab, priorityFilter, searchQuery, todayStart, todayEnd]);

  // Grouped tasks for List Mode
  const groupedTasks = useMemo(() => {
    const overdue = [];
    const today = [];
    const tomorrow = [];
    const next7Days = [];
    const later = [];
    const noDueDate = [];

    const tomorrowStart = new Date(todayEnd.getTime() + 1);
    const tomorrowEnd = new Date(tomorrowStart.getTime() + 24 * 3600 * 1000 - 1);
    const next7End = new Date(todayEnd.getTime() + 7 * 24 * 3600 * 1000);

    filteredTasks.forEach(t => {
      if (t.status === 'Completed') {
        later.push(t);
        return;
      }
      if (!t.dueDateTime) {
        noDueDate.push(t);
        return;
      }
      const due = new Date(t.dueDateTime);
      if (due < todayStart) overdue.push(t);
      else if (due >= todayStart && due <= todayEnd) today.push(t);
      else if (due >= tomorrowStart && due <= tomorrowEnd) tomorrow.push(t);
      else if (due > tomorrowEnd && due <= next7End) next7Days.push(t);
      else later.push(t);
    });

    return [
      { key: 'overdue', label: 'Overdue', color: '#ef4444', items: overdue },
      { key: 'today', label: 'Today', color: '#f59e0b', items: today },
      { key: 'tomorrow', label: 'Tomorrow', color: "var(--accent)", items: tomorrow },
      { key: 'next_7', label: 'Next 7 Days', color: '#a78bfa', items: next7Days },
      { key: 'later', label: 'Later / Completed', color: "var(--text-secondary)", items: later },
      { key: 'no_due', label: 'No Due Date', color: '#64748b', items: noDueDate }
    ].filter(g => g.items.length > 0);
  }, [filteredTasks, todayStart, todayEnd]);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px 16px' }}>
      {/* ── HEADER WITH COUNTS & LIST/BOARD TOGGLE ─────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px',
        marginBottom: '18px'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: "var(--text-primary)" }}>
            Tasks
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '0.82rem', color: "var(--text-secondary)" }}>
            <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{stats.openCount} open</span>
            <span>•</span>
            <span style={{ fontWeight: 700, color: stats.overdueCount > 0 ? '#ef4444' : '#94a3b8' }}>
              {stats.overdueCount} overdue
            </span>
            <span>•</span>
            <span style={{ fontWeight: 700, color: '#10b981' }}>{stats.doneTodayCount} done today</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* List / Board Switcher */}
          <div style={{ display: 'flex', background: "var(--input-bg)", padding: '3px', borderRadius: '8px', border: "1px solid var(--card-border)" }}>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 10px',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'list' ? '#38bdf8' : 'transparent',
                color: viewMode === 'list' ? '#0f172a' : '#94a3b8',
                fontWeight: 600,
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              <LayoutList size={14} /> List
            </button>
            <button
              type="button"
              onClick={() => setViewMode('board')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 10px',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'board' ? '#38bdf8' : 'transparent',
                color: viewMode === 'board' ? '#0f172a' : '#94a3b8',
                fontWeight: 600,
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              <Kanban size={14} /> Board
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleOpenModal()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              background: "var(--accent)", color: "var(--accent-contrast)",
              border: 'none',
              fontWeight: 700,
              fontSize: '0.84rem',
              cursor: 'pointer'
            }}
          >
            <Plus size={16} /> New Task
          </button>
        </div>
      </div>

      {/* ── QUICK-ADD BAR (SHORTCUT 'N') ───────────────────────────────── */}
      <form onSubmit={handleQuickAdd} style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: "var(--input-bg)",
        border: "1px solid var(--card-border)",
        borderRadius: '10px',
        padding: '6px 10px',
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '220px' }}>
          <Plus size={16} color="var(--accent)" />
          <input
            ref={quickInputRef}
            type="text"
            placeholder="Quick add task... (Press 'N' anywhere to focus)"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              color: "var(--text-primary)",
              fontSize: '0.86rem',
              outline: 'none'
            }}
          />
        </div>

        <select
          value={quickDue}
          onChange={(e) => setQuickDue(e.target.value)}
          style={{
            padding: '5px 10px',
            background: "var(--card-bg)",
            border: "1px solid var(--card-border)",
            color: "var(--text-secondary)",
            borderRadius: '6px',
            fontSize: '0.78rem'
          }}
        >
          <option value="today">Due Today</option>
          <option value="tomorrow">Due Tomorrow</option>
          <option value="in_3_days">In 3 Days</option>
          <option value="next_week">Next Week</option>
        </select>

        <select
          value={quickPriority}
          onChange={(e) => setQuickPriority(e.target.value)}
          style={{
            padding: '5px 10px',
            background: "var(--card-bg)",
            border: "1px solid var(--card-border)",
            color: getPriorityColor(quickPriority),
            borderRadius: '6px',
            fontSize: '0.78rem',
            fontWeight: 700
          }}
        >
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        <button
          type="submit"
          style={{
            padding: '6px 14px',
            borderRadius: '6px',
            background: "var(--accent)", color: "var(--accent-contrast)",
            border: 'none',
            fontWeight: 700,
            fontSize: '0.8rem',
            cursor: 'pointer'
          }}
        >
          Add
        </button>
      </form>

      {/* ── TABS & FILTERS BAR ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '18px',
        borderBottom: "1px solid var(--card-border)",
        paddingBottom: '12px'
      }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
          {[
            { key: 'all_open', label: `All open (${stats.openCount})` },
            { key: 'today', label: `Today` },
            { key: 'upcoming', label: `Upcoming` },
            { key: 'completed', label: `Completed` }
          ].map(t => {
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: '1px solid',
                  borderColor: isActive ? '#38bdf8' : 'transparent',
                  background: isActive ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                  color: isActive ? '#38bdf8' : '#94a3b8',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Filters: Search + Priority */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '8px', top: '8px', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Filter tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '5px 10px 5px 28px',
                background: "var(--input-bg)",
                border: "1px solid var(--card-border)",
                color: "var(--text-primary)",
                borderRadius: '6px',
                fontSize: '0.78rem',
                width: '140px'
              }}
            />
          </div>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={{
              padding: '5px 10px',
              background: "var(--input-bg)",
              border: "1px solid var(--card-border)",
              color: "var(--text-secondary)",
              borderRadius: '6px',
              fontSize: '0.78rem'
            }}
          >
            <option value="all">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
      </div>

      {/* ── LIST VIEW MODE ─────────────────────────────────────────────── */}
      {viewMode === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {groupedTasks.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', color: '#64748b', fontSize: '0.88rem' }}>
              No tasks match your current filter.
            </div>
          ) : (
            groupedTasks.map(group => (
              <div key={group.key}>
                <div style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: group.color,
                  textTransform: "none",
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span>{group.label}</span>
                  <span style={{ fontSize: '0.72rem', background: "var(--input-bg)", color: "var(--text-secondary)", padding: '1px 6px', borderRadius: '10px' }}>
                    {group.items.length}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {group.items.map(task => (
                    <TaskCardRow
                      key={task._id}
                      task={task}
                      onToggle={handleToggleTask}
                      onEdit={handleOpenModal}
                      onDelete={handleDeleteTask}
                      getPriorityColor={getPriorityColor}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── BOARD VIEW MODE (TO DO / IN PROGRESS / DONE) ────────────────── */}
      {viewMode === 'board' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
          alignItems: 'flex-start'
        }}>
          {[
            { id: 'Pending', label: 'To do', color: "var(--accent)" },
            { id: 'In Progress', label: 'In progress', color: '#f59e0b' },
            { id: 'Completed', label: 'Done', color: '#10b981' }
          ].map(col => {
            const colTasks = filteredTasks.filter(t => (t.status || 'Pending') === col.id);
            return (
              <div
                key={col.id}
                style={{
                  background: "var(--input-bg)",
                  border: "1px solid var(--card-border)",
                  borderRadius: '12px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: col.color }}>
                    {col.label}
                  </span>
                  <span style={{ fontSize: '0.75rem', background: "var(--card-bg)", padding: '2px 8px', borderRadius: '10px', color: "var(--text-secondary)" }}>
                    {colTasks.length}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {colTasks.map(task => (
                    <TaskCardRow
                      key={task._id}
                      task={task}
                      onToggle={handleToggleTask}
                      onEdit={handleOpenModal}
                      onDelete={handleDeleteTask}
                      getPriorityColor={getPriorityColor}
                      isBoard
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── NEW / EDIT TASK MODAL ───────────────────────────────────────── */}
      {showTaskModal && (
        <div className="crm-modal-backdrop" onClick={() => setShowTaskModal(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px'
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: '16px', width: '100%', maxWidth: '520px', padding: '24px', color: "var(--text-primary)", maxHeight: '90vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                {editingTask ? 'Edit Task' : '+ New Task'}
              </h3>
              <button
                type="button"
                onClick={() => setShowTaskModal(false)}
                style={{ background: 'none', border: 'none', color: "var(--text-secondary)", cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveModalTask} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Schedule lawyer review for agreement drafting"
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '8px', color: "var(--text-primary)", fontSize: '0.86rem' }}
                />
              </div>

              {/* Priority & Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px', fontWeight: 600 }}>Priority</label>
                  <select
                    value={modalPriority}
                    onChange={(e) => setModalPriority(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '8px', color: getPriorityColor(modalPriority), fontWeight: 700, fontSize: '0.84rem' }}
                  >
                    <option value="Urgent">Urgent</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px', fontWeight: 600 }}>Status</label>
                  <select
                    value={modalStatus}
                    onChange={(e) => setModalStatus(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '8px', color: "var(--text-primary)", fontSize: '0.84rem' }}
                  >
                    <option value="Pending">To do</option>
                    <option value="In Progress">In progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              {/* Due Date & Quick Chips */}
              <div>
                <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px', fontWeight: 600 }}>Due Date & Time</label>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="date"
                    value={modalDueDate}
                    onChange={(e) => setModalDueDate(e.target.value)}
                    style={{ padding: '8px 10px', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '6px', color: "var(--text-primary)", fontSize: '0.84rem' }}
                  />
                  <input
                    type="time"
                    value={modalDueTime}
                    onChange={(e) => setModalDueTime(e.target.value)}
                    style={{ padding: '8px 10px', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '6px', color: "var(--text-primary)", fontSize: '0.84rem' }}
                  />
                </div>

                {/* Quick Chips */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Today', offset: 0 },
                    { label: 'Tomorrow', offset: 1 },
                    { label: 'In 3 days', offset: 3 },
                    { label: 'Next week', offset: 7 },
                    { label: 'No date', offset: null }
                  ].map(chip => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => applyQuickDateChip(chip.offset)}
                      style={{
                        padding: '3px 8px',
                        background: "var(--input-bg)",
                        border: "1px solid var(--card-border)",
                        borderRadius: '4px',
                        color: "var(--text-secondary)",
                        fontSize: '0.72rem',
                        cursor: 'pointer'
                      }}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Repeat Rule & Reminder */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px', fontWeight: 600 }}>Repeat</label>
                  <select
                    value={modalRepeat}
                    onChange={(e) => setModalRepeat(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '8px', color: "var(--text-primary)", fontSize: '0.84rem' }}
                  >
                    <option value="none">No Repeat</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px', fontWeight: 600 }}>Reminder</label>
                  <select
                    value={modalReminder}
                    onChange={(e) => setModalReminder(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '8px', color: "var(--text-primary)", fontSize: '0.84rem' }}
                  >
                    <option value="none">None</option>
                    <option value="reminder">At Due Time</option>
                    <option value="15m">15 mins before</option>
                    <option value="1h">1 hour before</option>
                  </select>
                </div>
              </div>

              {/* Linked Lead / Unit / Booking */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px' }}>Linked Lead</label>
                  <select
                    value={modalLeadId}
                    onChange={(e) => setModalLeadId(e.target.value)}
                    style={{ width: '100%', padding: '7px', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '6px', color: "var(--text-primary)", fontSize: '0.8rem' }}
                  >
                    <option value="">None</option>
                    {leads.map(l => (
                      <option key={l._id || l.id} value={l._id || l.id}>{l.name || l.customerName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px' }}>Linked Unit</label>
                  <select
                    value={modalUnitId}
                    onChange={(e) => setModalUnitId(e.target.value)}
                    style={{ width: '100%', padding: '7px', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '6px', color: "var(--text-primary)", fontSize: '0.8rem' }}
                  >
                    <option value="">None</option>
                    {units.map(u => (
                      <option key={u._id} value={u._id}>Unit {u.unitCode || u.unitNumber}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px' }}>Linked Booking</label>
                  <select
                    value={modalBookingId}
                    onChange={(e) => setModalBookingId(e.target.value)}
                    style={{ width: '100%', padding: '7px', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '6px', color: "var(--text-primary)", fontSize: '0.8rem' }}
                  >
                    <option value="">None</option>
                    {bookings.map(b => (
                      <option key={b._id} value={b._id}>{b.bookingReference} ({b.customerName})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Checklist */}
              <div>
                <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Checklist ({checklist.filter(c => c.done).length}/{checklist.length})
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '6px' }}>
                  {checklist.map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: "var(--input-bg)", padding: '6px 10px', borderRadius: '6px' }}>
                      <div
                        onClick={() => handleToggleChecklistItem(item.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1 }}
                      >
                        {item.done ? <CheckCircle2 size={15} color="#10b981" /> : <Circle size={15} color="#94a3b8" />}
                        <span style={{ fontSize: '0.82rem', textDecoration: item.done ? 'line-through' : 'none', color: item.done ? '#64748b' : '#f8fafc' }}>
                          {item.text}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteChecklistItem(item.id)}
                        style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Add item + press Enter"
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  onKeyDown={handleAddChecklistItem}
                  style={{ width: '100%', padding: '7px 10px', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '6px', color: "var(--text-primary)", fontSize: '0.82rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: "var(--text-secondary)", display: 'block', marginBottom: '4px', fontWeight: 600 }}>Notes</label>
                <textarea
                  rows={2}
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  style={{ width: '100%', padding: '8px', background: "var(--input-bg)", border: "1px solid var(--card-border)", borderRadius: '6px', color: "var(--text-primary)", fontSize: '0.82rem', resize: 'vertical' }}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '11px',
                  borderRadius: '8px',
                  background: "var(--accent)", color: "var(--accent-contrast)",
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                {submitting ? 'Saving...' : (editingTask ? 'Save Changes' : 'Create Task')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── TASK CARD ROW COMPONENT ─────────────────────────────────────────────────
function TaskCardRow({ task, onToggle, onEdit, onDelete, getPriorityColor, isBoard = false }) {
  const isDone = task.status === 'Completed';
  const checklist = Array.isArray(task.checklist) ? task.checklist : [];
  const checklistDone = checklist.filter(c => c.done).length;

  return (
    <div style={{
      background: "var(--card-bg)",
      border: `1px solid ${task.isOverdue ? '#ef4444' : '#334155'}`,
      borderRadius: '8px',
      padding: '10px 12px',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: '10px'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1 }}>
        <button
          type="button"
          onClick={() => onToggle(task._id)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            marginTop: '2px',
            color: isDone ? '#10b981' : getPriorityColor(task.priority),
            cursor: 'pointer'
          }}
          title={isDone ? 'Mark as incomplete' : 'Mark as complete'}
        >
          {isDone ? (
            <CheckCircle2 size={18} fill="#10b981" color="#0f172a" />
          ) : (
            <Circle size={18} strokeWidth={2.5} />
          )}
        </button>

        <div style={{ flex: 1 }}>
          <div
            onClick={() => onEdit(task)}
            style={{
              fontSize: '0.88rem',
              fontWeight: 600,
              color: isDone ? '#64748b' : '#f8fafc',
              textDecoration: isDone ? 'line-through' : 'none',
              cursor: 'pointer'
            }}
          >
            {task.title}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap', fontSize: '0.74rem', color: "var(--text-secondary)" }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: getPriorityColor(task.priority), fontWeight: 700 }}>
              <Flag size={11} /> {task.priority}
            </span>

            {task.dueDateTime && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: task.isOverdue ? '#ef4444' : '#94a3b8' }}>
                <Clock size={11} />
                {new Date(task.dueDateTime).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
              </span>
            )}

            {task.repeat_rule && task.repeat_rule !== 'none' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#a78bfa' }}>
                <Repeat size={11} /> {task.repeat_rule}
              </span>
            )}

            {checklist.length > 0 && (
              <span style={{ background: "var(--input-bg)", padding: '1px 5px', borderRadius: '4px' }}>
                {checklistDone}/{checklist.length}
              </span>
            )}

            {task.customerName && (
              <span style={{ background: "var(--input-bg)", color: "var(--accent)", padding: '1px 5px', borderRadius: '4px' }}>
                👤 {task.customerName}
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button
          type="button"
          onClick={() => onDelete(task._id)}
          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
          title="Delete task"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}


import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import {
  Menu,
  X,
  PlusSquare,
  LogOut,
  LayoutDashboard,
  Package,
  ClipboardList,
  BookOpen,
  Users,
  Shield,
  Layers,
  ChevronDown,
  History,
  Ruler,
  Building2,
  Boxes,
  Warehouse,
  CalendarRange,
  Wallet,
  FileStack,
  HardHat,
  Home,
  UsersRound,
  UserRound,
  CalendarCheck2,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Calendar,
  Kanban,
  CheckSquare,
  CalendarDays,
  Clock,
  Building,
  FileText,
  Upload,
} from 'lucide-react';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
import ProjectSelector from '../ProjectSelector/ProjectSelector';
import cravetobuildMark from '../../assets/cravetobuild-mark.png';
import brandLogo from '../../assets/logo.png';
import './SideNavbar.css';

/**
 * Partner Admin nav allowlist (frontend UX only — API auth remains authoritative).
 * Intentional product subset: no Site Inventory, CRM, Users, Roles, Settings, Activity Logs.
 * Backend role grants may be broader; do not widen this list without product approval.
 */
const PARTNER_ALLOWED_MODULES = [
  'overview',
  'projects',
  'inventory',
  'ledger',
  'optimizer',
  'history',
  'bbs',
  'casting',
  'drawings',
  'contractors',
  'manpower',
  'attendance',
];

const ATTENDANCE_VIEWS = ['attendance-mark', 'attendance-history', 'attendance-reports'];
const STEEL_VIEWS = ['inventory', 'ledger', 'inputs', 'results', 'history'];
const MANPOWER_VIEWS = ['manpower-labour', 'manpower-contractor-labour'];
const DRAWINGS_VIEWS = [
  'drawings',
  'drawings-matrix',
  'drawings-versions',
  'drawings-viewer',
];
const CRM_VIEWS = [
  'crm',
  'crm-dashboard',
  'crm-today',
  'crm-leads',
  'crm-pipeline',
  'crm-tasks',
  'crm-calendar',
  'crm-followups',
  'crm-inventory',
  'crm-templates',
  'crm-import',
];

export default function SideNavbar({ currentView, onViewChange, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 1024px)').matches);
  const sidenavRef = useRef(null);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem('cravetobuild_sidebar_collapsed') === 'true';
    } catch (e) {
      return false;
    }
  });

  const [openGroups, setOpenGroups] = useState(() => ({
    steel: STEEL_VIEWS.includes(currentView),
    crm: CRM_VIEWS.includes(currentView),
    manpower: MANPOWER_VIEWS.includes(currentView),
    attendance: ATTENDANCE_VIEWS.includes(currentView),
    drawings: DRAWINGS_VIEWS.includes(currentView),
  }));

  const user = useSelector((state) => state.auth.user);
  const permissions = useSelector((state) => state.permissions.modules);

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('cravetobuild_sidebar_collapsed', String(next));
      } catch (e) { }
      return next;
    });
  };

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px)');
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [currentView]);

  useEffect(() => {
    if (!narrow || !isOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const root = sidenavRef.current;
    const focusable = root?.querySelector('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    focusable?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !root) return;
      const items = [...root.querySelectorAll('button, a, input, select, textarea')].filter((el) => !el.disabled);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [narrow, isOpen]);

  useEffect(() => {
    const handleToggleEvent = () => setIsOpen((prev) => !prev);
    const handleOpenEvent = () => setIsOpen(true);
    const handleCloseEvent = () => setIsOpen(false);
    window.addEventListener('toggle-mobile-menu', handleToggleEvent);
    window.addEventListener('open-mobile-menu', handleOpenEvent);
    window.addEventListener('close-mobile-menu', handleCloseEvent);
    return () => {
      window.removeEventListener('toggle-mobile-menu', handleToggleEvent);
      window.removeEventListener('open-mobile-menu', handleOpenEvent);
      window.removeEventListener('close-mobile-menu', handleCloseEvent);
    };
  }, []);

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      if (STEEL_VIEWS.includes(currentView)) next.steel = true;
      if (CRM_VIEWS.includes(currentView)) next.crm = true;
      if (MANPOWER_VIEWS.includes(currentView)) next.manpower = true;
      if (ATTENDANCE_VIEWS.includes(currentView)) next.attendance = true;
      if (DRAWINGS_VIEWS.includes(currentView)) next.drawings = true;
      return next;
    });
  }, [currentView]);

  const checkPermission = (moduleKey) => {
    if (!moduleKey) return true;
    const roleUpper = (user?.role || '').toUpperCase();
    if (roleUpper === 'ADMIN' || roleUpper === 'OWNER' || user?.accountType === 'developer') {
      return true;
    }
    if (roleUpper === 'PROJECT_PARTNER_ADMIN' || roleUpper === 'PROJECT PARTNER ADMIN') {
      return PARTNER_ALLOWED_MODULES.includes(moduleKey);
    }
    if (!permissions || Object.keys(permissions).length === 0) {
      return true;
    }
    return permissions[moduleKey] !== false;
  };

  const MENU_SECTIONS = [
    {
      sectionTitle: null,
      items: [
        {
          id: 'overview',
          label: 'Dashboard',
          icon: <LayoutDashboard size={18} />,
        },
        {
          id: 'projects',
          label: 'Projects',
          icon: <Building2 size={18} />,
          moduleKey: 'projects',
        },
      ],
    },
    {
      sectionTitle: 'Steel & BBS',
      items: [
        {
          id: 'steel',
          label: 'Steel',
          icon: <Layers size={18} />,
          targetView: 'inventory',
          moduleKey: 'inventory',
        },
        // {
        //   id: 'bbs',
        //   label: 'BBS Schedule',
        //   icon: <Ruler size={18} />,
        //   moduleKey: 'bbs',
        // },
        {
          id: 'casting',
          label: 'Casting Management',
          icon: <Boxes size={18} />,
          moduleKey: 'casting',
        },
      ],
    },
    {
      sectionTitle: 'Site operations',
      items: [
        {
          id: 'general-inventory',
          label: 'Site Inventory',
          icon: <Warehouse size={18} />,
          moduleKey: 'generalInventory',
        },
        {
          id: 'crm',
          label: 'Real Estate CRM',
          icon: <Home size={18} />,
          isGroup: true,
          moduleKey: 'crm',
          defaultView: 'crm-today',
          children: [
            {
              id: 'crm-dashboard',
              label: 'Dashboard',
              icon: <LayoutDashboard size={17} />,
              moduleKey: 'crm',
            },
            {
              id: 'crm-today',
              label: 'Today',
              icon: <Calendar size={17} />,
              moduleKey: 'crm',
            },
            {
              id: 'crm-leads',
              label: 'Leads',
              icon: <Users size={17} />,
              moduleKey: 'crm',
            },
            {
              id: 'crm-pipeline',
              label: 'Pipeline',
              icon: <Kanban size={17} />,
              moduleKey: 'crm',
            },
            {
              id: 'crm-tasks',
              label: 'Tasks',
              icon: <CheckSquare size={17} />,
              moduleKey: 'crm',
            },
            {
              id: 'crm-calendar',
              label: 'Calendar',
              icon: <CalendarDays size={17} />,
              moduleKey: 'crm',
            },
            {
              id: 'crm-followups',
              label: 'Follow-ups',
              icon: <Clock size={17} />,
              moduleKey: 'crm',
            },
            {
              id: 'crm-inventory',
              label: 'Unit Inventory',
              icon: <Building size={17} />,
              moduleKey: 'crm',
            },
            {
              id: 'crm-templates',
              label: 'Templates',
              icon: <FileText size={17} />,
              moduleKey: 'crm',
            },
            {
              id: 'crm-import',
              label: 'Import',
              icon: <Upload size={17} />,
              moduleKey: 'crm',
            },
          ],
        },
        {
          id: 'project-management',
          label: 'Projects & Tasks',
          icon: <CalendarRange size={18} />,
          moduleKey: 'projectManagement',
        },
        {
          id: 'drawings',
          label: 'Drawings',
          icon: <FileStack size={18} />,
          moduleKey: 'drawings',
        },
        {
          id: 'petty-cash',
          label: 'Petty Cash',
          icon: <Wallet size={18} />,
          moduleKey: 'pettyCash',
        },
      ],
    },
    {
      sectionTitle: 'Manpower & labour',
      items: [
        {
          id: 'contractors',
          label: 'Contractors',
          icon: <HardHat size={18} />,
          moduleKey: 'contractors',
        },
        {
          id: 'manpower',
          label: 'Manpower',
          icon: <UsersRound size={18} />,
          isGroup: true,
          moduleKey: 'manpower',
          defaultView: 'manpower-labour',
          children: [
            {
              id: 'manpower-labour',
              label: 'Labour',
              icon: <UserRound size={17} />,
              moduleKey: 'manpower',
            },
            {
              id: 'manpower-contractor-labour',
              label: 'Contractor Labour',
              icon: <HardHat size={17} />,
              moduleKey: 'manpower',
            },
          ],
        },
        {
          id: 'attendance',
          label: 'Attendance',
          icon: <CalendarCheck2 size={18} />,
          isGroup: true,
          moduleKey: 'attendance',
          defaultView: 'attendance-mark',
          children: [
            {
              id: 'attendance-mark',
              label: 'Mark Attendance',
              icon: <CalendarCheck2 size={17} />,
              moduleKey: 'attendance',
            },
            {
              id: 'attendance-history',
              label: 'History',
              icon: <History size={17} />,
              moduleKey: 'attendance',
            },
            {
              id: 'attendance-reports',
              label: 'Reports',
              icon: <ClipboardList size={17} />,
              moduleKey: 'attendance',
            },
          ],
        },
      ],
    },
    {
      sectionTitle: 'Administration',
      items: [
        {
          id: 'chat',
          label: 'Project Chat',
          icon: <MessageSquare size={18} />,
          moduleKey: 'chat',
        },
        {
          id: 'users',
          label: 'User Management',
          icon: <Users size={18} />,
          moduleKey: 'users',
        },
        {
          id: 'roles',
          label: 'Roles & Permissions',
          icon: <Shield size={18} />,
          moduleKey: 'roles',
        },
        {
          id: 'activity-logs',
          label: 'Activity Logs',
          icon: <History size={18} />,
          moduleKey: 'activityLogs',
        },
      ],
    },
  ];

  // Filter allowed items in each section
  const sections = MENU_SECTIONS.map((section) => {
    const filteredItems = section.items
      .map((item) => {
        if (item.isGroup && item.children) {
          if (item.moduleKey && !checkPermission(item.moduleKey)) return null;
          const allowedChildren = item.children.filter((child) => checkPermission(child.moduleKey));
          if (allowedChildren.length === 0) return null;
          return { ...item, children: allowedChildren };
        }
        if (!checkPermission(item.moduleKey)) return null;
        return item;
      })
      .filter(Boolean);

    if (filteredItems.length === 0) return null;
    return { ...section, items: filteredItems };
  }).filter(Boolean);

  const initials = user
    ? ((user.firstName?.[0] || '') + (user.lastName?.[0] || '')).toUpperCase()
    : 'CT';

  const isBbsActive = (currentView || '').startsWith('bbs-') || currentView === 'bbs';

  return (
    <>
      {/* Mobile Top Header */}
      <div className="mobile-header">
        <button
          type="button"
          className="menu-toggle-btn"
          onClick={() => setIsOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu size={24} />
        </button>
        <div className="mobile-logo-wrapper">
          <img src={brandLogo} alt="CraveToBuild" className="mobile-brand-img" />
        </div>
        <ThemeToggle compact />
      </div>

      {/* Main Sidenav (Dual Mode: Full vs Mini) */}
      <aside
        ref={sidenavRef}
        className={`sidenav ${isCollapsed ? 'collapsed' : ''} ${isOpen ? 'open' : ''}`}
        aria-label="Main navigation"
        inert={narrow && !isOpen ? true : undefined}
      >
        {/* Mobile Close Button */}
        <button
          type="button"
          className="sidenav-close-btn"
          onClick={() => setIsOpen(false)}
          aria-label="Close navigation menu"
        >
          <X size={20} />
        </button>

        {/* ── Top Header ── */}
        {!isCollapsed ? (
          <div className="sidenav-header-expanded">
            <div className="sidenav-brand-row">
              <div className="sidenav-brand-mark-box" title="CraveToBuild">
                <img src={cravetobuildMark} alt="CraveToBuild" className="sidenav-brand-mark-img" />
              </div>
              <div className="sidenav-brand-titles">
                <span className="sidenav-brand-title">CraveToBuild</span>
                <span className="sidenav-brand-subtitle">
                  {user?.accountType === 'developer' ? 'Developer Portal' : 'Admin Portal'}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="sidenav-collapse-btn"
              onClick={toggleCollapsed}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose size={18} />
            </button>
          </div>
        ) : (
          <div className="sidenav-header-collapsed">
            <div className="sidenav-brand-mark-box mini" title="CraveToBuild">
              <img src={cravetobuildMark} alt="CraveToBuild" className="sidenav-brand-mark-img" />
            </div>
            <button
              type="button"
              className="sidenav-expand-btn"
              onClick={toggleCollapsed}
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen size={18} />
            </button>
          </div>
        )}

        {/* Active Project Selector */}
        <ProjectSelector isCollapsed={isCollapsed} />

        {/* ── Scrollable Menu List ── */}
        <nav className="sidenav-menu">
          {
            sections.map((section, secIdx) => (
              <div key={secIdx} className="sidenav-section-container">
                {!isCollapsed && section.sectionTitle && (
                  <div className="sidenav-section-heading">{section.sectionTitle}</div>
                )}

                {section.items.map((item) => {
                  if (item.isGroup) {
                    const isGroupOpen = !!openGroups[item.id];
                    const toggleGroup = () => {
                      setOpenGroups((prev) => ({ ...prev, [item.id]: !prev[item.id] }));
                    };

                    const isGroupActive = item.children.some(
                      (child) =>
                        currentView === child.id ||
                        (item.id === 'crm' && (currentView === 'crm' || currentView === child.id)) ||
                        (item.id === 'drawings' &&
                          (currentView === 'drawings-plan-pass' || currentView === 'drawings-viewer'))
                    );

                    // In collapsed mode: render clean icon button
                    if (isCollapsed) {
                      return (
                        <button
                          type="button"
                          key={item.id}
                          className={`sidenav-item icon-only ${isGroupActive ? 'active' : ''}`}
                          onClick={() => {
                            const targetView = item.defaultView || item.children[0]?.id;
                            if (targetView) onViewChange(targetView);
                            setIsOpen(false);
                          }}
                          data-tooltip={item.label}
                          aria-label={item.label}
                        >
                          <span className="sidenav-icon">{item.icon}</span>
                        </button>
                      );
                    }

                    // In expanded mode: render accordion
                    return (
                      <div key={item.id} className="sidenav-group-container">
                        <button
                          type="button"
                          className={`sidenav-item sidenav-group-header ${isGroupActive && !isGroupOpen ? 'active-parent' : ''
                            }`}
                          onClick={toggleGroup}
                          aria-expanded={isGroupOpen}
                        >
                          <span className="sidenav-icon">{item.icon}</span>
                          <span className="sidenav-label">{item.label}</span>
                          <ChevronDown
                            size={15}
                            className={`sidenav-chevron ${isGroupOpen ? 'open' : ''}`}
                          />
                        </button>

                        <div className={`sidenav-submenu-wrapper ${isGroupOpen ? 'open' : ''}`}>
                          <div className="sidenav-submenu">
                            <div className="sidenav-submenu-content">
                              {item.children.map((child) => {
                                const isChildActive =
                                  currentView === child.id ||
                                  (currentView === 'results' && child.id === 'inputs');

                                return (
                                  <button
                                    type="button"
                                    key={child.id}
                                    className={`sidenav-item sidenav-subitem ${isChildActive ? 'active' : ''
                                      }`}
                                    onClick={() => {
                                      onViewChange(child.id);
                                      setIsOpen(false);
                                    }}
                                    tabIndex={isGroupOpen ? 0 : -1}
                                    aria-hidden={!isGroupOpen}
                                  >
                                    <span className="sidenav-icon">{child.icon}</span>
                                    <span className="sidenav-label">{child.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Regular single item
                  const isActive =
                    currentView === item.id ||
                    (item.id === 'steel' && STEEL_VIEWS.includes(currentView)) ||
                    (item.id === 'bbs' && isBbsActive) ||
                    (item.id === 'drawings' && DRAWINGS_VIEWS.includes(currentView)) ||
                    (currentView === 'results' && item.id === 'inputs');

                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={`sidenav-item ${isCollapsed ? 'icon-only' : ''} ${isActive ? 'active' : ''
                        }`}
                      onClick={() => {
                        onViewChange(item.targetView || item.id);
                        setIsOpen(false);
                      }}
                      data-tooltip={item.label}
                      aria-label={item.label}
                    >
                      <span className="sidenav-icon">{item.icon}</span>
                      {!isCollapsed && <span className="sidenav-label">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
        </nav>

        {/* ── Bottom User Footer ── */}
        {
          !isCollapsed ? (
            <div className="sidenav-footer-expanded">
              <div className="theme-toggle-row">
                <span className="sidenav-footer-lbl">Theme</span>
                <ThemeToggle />
              </div>

              {user && (
                <div className="user-profile-row">
                  <button
                    type="button"
                    className={`user-profile-badge-btn ${currentView === 'profile' ? 'active' : ''}`}
                    onClick={() => {
                      onViewChange('profile');
                      setIsOpen(false);
                    }}
                    title="View Profile"
                  >
                    {user.avatar ? (
                      <img src={user.avatar} alt="" className="profile-avatar-img" />
                    ) : (
                      <div className="profile-avatar-circle">{initials}</div>
                    )}
                    <div className="profile-text-group">
                      <div className="profile-name-text">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="profile-sub-text" title={user.email || user.role}>
                        {user.email || user.role}
                      </div>
                    </div>
                  </button>

                  {
                    onLogout && (
                      <button
                        type="button"
                        className="footer-logout-icon-btn"
                        onClick={() => {
                          setIsOpen(false);
                          onLogout();
                        }}
                        title="Sign Out"
                        aria-label="Sign Out"
                      >
                        <LogOut size={17} />
                      </button>
                    )
                  }
                </div>
              )}
            </div>
          ) : (
            <div className="sidenav-footer-collapsed">
              {user && (
                <button
                  type="button"
                  className={`user-profile-mini-btn ${currentView === 'profile' ? 'active' : ''}`}
                  onClick={() => {
                    onViewChange('profile');
                    setIsOpen(false);
                  }}
                  data-tooltip={`${user.firstName} ${user.lastName}`}
                  aria-label="View Profile"
                >
                  {user.avatar ? (
                    <img src={user.avatar} alt="" className="profile-avatar-img mini" />
                  ) : (
                    <div className="profile-avatar-circle mini">{initials}</div>
                  )}
                </button>
              )}

              {onLogout && (
                <button
                  type="button"
                  className="footer-logout-mini-btn"
                  onClick={() => {
                    setIsOpen(false);
                    onLogout();
                  }}
                  data-tooltip="Sign Out"
                  aria-label="Sign Out"
                >
                  <LogOut size={18} />
                </button>
              )}
            </div>
          )}
      </aside>

      {/* Mobile Drawer Overlay Backdrop */}
      {
        isOpen && (
          <div
            className="sidenav-backdrop"
            onClick={() => setIsOpen(false)}
            role="presentation"
            aria-hidden="true"
          />
        )
      }
    </>
  );
}

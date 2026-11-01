import React, { useState, useEffect } from 'react';
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
  Settings as SettingsIcon,
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
  FileSpreadsheet,
  MessageSquare,
} from 'lucide-react';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
import ProjectSelector from '../ProjectSelector/ProjectSelector';
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

export default function SideNavbar({ currentView, onViewChange, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState(() => ({
    steel: STEEL_VIEWS.includes(currentView),
    manpower: MANPOWER_VIEWS.includes(currentView),
    attendance: ATTENDANCE_VIEWS.includes(currentView),
  }));
  const user = useSelector((state) => state.auth.user);
  const permissions = useSelector((state) => state.permissions.modules);

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      if (STEEL_VIEWS.includes(currentView)) next.steel = true;
      if (MANPOWER_VIEWS.includes(currentView)) next.manpower = true;
      if (ATTENDANCE_VIEWS.includes(currentView)) next.attendance = true;
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

  const MENU_STRUCTURE = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <LayoutDashboard size={18} />,
    },
    {
      id: 'projects',
      label: 'Projects',
      icon: <Building2 size={18} />,
      moduleKey: 'projects',
    },
    {
      id: 'steel',
      label: 'Steel',
      icon: <Layers size={18} />,
      isGroup: true,
      children: [
        {
          id: 'inventory',
          label: 'Inventory',
          icon: <Package size={17} />,
          moduleKey: 'inventory',
        },
        {
          id: 'ledger',
          label: 'Ledger & Procurement',
          icon: <BookOpen size={17} />,
          moduleKey: 'ledger',
        },
        {
          id: 'inputs',
          label: 'Run Optimizer',
          icon: <PlusSquare size={17} />,
          moduleKey: 'optimizer',
        },
        {
          id: 'history',
          label: 'Batch History',
          icon: <ClipboardList size={17} />,
          moduleKey: 'history',
        },
      ],
    },
    {
      id: 'bbs',
      label: 'BBS',
      icon: <Ruler size={18} />,
      moduleKey: 'bbs',
    },
    {
      id: 'casting',
      label: 'Casting Management',
      icon: <Boxes size={18} />,
      moduleKey: 'casting',
    },
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
      moduleKey: 'crm',
    },
    {
      id: 'project-management',
      label: 'Projects & Tasks',
      icon: <CalendarRange size={18} />,
      moduleKey: 'projectManagement',
    },
    {
      id: 'drawings',
      label: 'Drawing & Files',
      icon: <FileStack size={18} />,
      moduleKey: 'drawings',
    },
    {
      id: 'petty-cash',
      label: 'Petty Cash',
      icon: <Wallet size={18} />,
      moduleKey: 'pettyCash',
    },
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
    {
      id: 'reports',
      label: 'Reports',
      icon: <FileSpreadsheet size={18} />,
      moduleKey: 'reports',
    },
    {
      id: 'chat',
      label: 'Project Chat',
      icon: <MessageSquare size={18} />,
      moduleKey: 'chat',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <SettingsIcon size={18} />,
      moduleKey: 'settings',
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
  ];

  const menuItems = MENU_STRUCTURE.map((item) => {
    if (item.isGroup && item.children) {
      if (item.moduleKey && !checkPermission(item.moduleKey)) return null;
      const allowedChildren = item.children.filter((child) => checkPermission(child.moduleKey));
      if (allowedChildren.length === 0) return null;
      return { ...item, children: allowedChildren };
    }
    if (!checkPermission(item.moduleKey)) return null;
    return item;
  }).filter(Boolean);

  const groupChildViews = {
    steel: STEEL_VIEWS,
    manpower: MANPOWER_VIEWS,
    attendance: ATTENDANCE_VIEWS,
  };

  const initials = user
    ? ((user.firstName?.[0] || '') + (user.lastName?.[0] || '')).toUpperCase()
    : 'U';

  return (
    <>
      <div className="mobile-header">
        <button
          type="button"
          className="menu-toggle-btn"
          onClick={() => setIsOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu size={24} />
        </button>
        <div className="mobile-logo-wrapper brand-logo-text">
          <span className="brand-rebar">Rebar</span>
          <span className="brand-optima">Optima</span>
        </div>
        <ThemeToggle />
      </div>

      <div className={`sidenav ${isOpen ? 'open' : ''}`} aria-label="Main navigation">
        <button
          type="button"
          className="sidenav-close-btn"
          onClick={() => setIsOpen(false)}
          aria-label="Close navigation menu"
        >
          <X size={24} />
        </button>

        <div className="sidenav-logo-container">
          <div className="brand-logo-text">
            <span className="brand-rebar">Rebar</span>
            <span className="brand-optima">Optima</span>
          </div>
        </div>

        <ProjectSelector />

        <nav className="sidenav-menu">
          {menuItems.map((item) => {
            if (item.isGroup) {
              const isGroupOpen = !!openGroups[item.id];
              const childIds = groupChildViews[item.id] || item.children.map((c) => c.id);
              const isGroupActive = childIds.includes(currentView);
              return (
                <div key={item.id} className="sidenav-group-container">
                  <button
                    type="button"
                    className={`sidenav-item sidenav-group-header ${isGroupActive && !isGroupOpen ? 'active-parent' : ''}`}
                    onClick={() =>
                      setOpenGroups((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                    }
                    aria-expanded={isGroupOpen}
                  >
                    <span className="sidenav-icon">{item.icon}</span>
                    <span className="sidenav-label">{item.label}</span>
                    <ChevronDown size={16} className={`sidenav-chevron ${isGroupOpen ? 'open' : ''}`} />
                  </button>
                  <div className={`sidenav-submenu-wrapper ${isGroupOpen ? 'open' : ''}`}>
                    <div className="sidenav-submenu">
                      <div className="sidenav-submenu-content">
                        {item.children.map((child) => (
                          <button
                            type="button"
                            key={child.id}
                            className={`sidenav-item sidenav-subitem ${
                              currentView === child.id ||
                              (currentView === 'results' && child.id === 'inputs')
                                ? 'active'
                                : ''
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
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            const isBbsChild = (currentView || '').startsWith('bbs-') && item.id === 'bbs';

            return (
              <button
                type="button"
                key={item.id}
                className={`sidenav-item ${
                  currentView === item.id ||
                  isBbsChild ||
                  (currentView === 'results' && item.id === 'inputs')
                    ? 'active'
                    : ''
                }`}
                onClick={() => {
                  onViewChange(item.id);
                  setIsOpen(false);
                }}
              >
                <span className="sidenav-icon">{item.icon}</span>
                <span className="sidenav-label">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidenav-footer">
          <div className="theme-toggle-row">
            <span className="sidenav-footer-lbl">Theme</span>
            <ThemeToggle />
          </div>

          {user && (
            <button
              type="button"
              className={`user-profile-badge ${currentView === 'profile' ? 'active' : ''}`}
              onClick={() => {
                onViewChange('profile');
                setIsOpen(false);
              }}
              title="View & Edit Profile"
            >
              {user.avatar ? (
                <img src={user.avatar} alt="" className="profile-avatar-img" />
              ) : (
                <div className="profile-initials">{initials}</div>
              )}
              <div className="profile-details">
                <div className="profile-name">
                  {user.firstName} {user.lastName}
                </div>
                <div className="profile-role-company">
                  <span className="profile-role">{user.role}</span>
                  <span className="profile-divider">•</span>
                  <span
                    className="profile-company"
                    title={`${user.companyName || 'Standard Firm'}${user.projectName ? ` (${user.projectName})` : ''}`}
                  >
                    {user.companyName || 'Standard Firm'}
                    {user.projectName ? ` • ${user.projectName}` : ''}
                  </span>
                </div>
              </div>
            </button>
          )}

          {onLogout && (
            <button
              type="button"
              className="sidenav-item logout-btn"
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
            >
              <span className="sidenav-icon">
                <LogOut size={18} />
              </span>
              <span className="sidenav-label">Logout</span>
            </button>
          )}
        </div>
      </div>

      {isOpen && (
        <div
          className="sidenav-backdrop"
          onClick={() => setIsOpen(false)}
          role="presentation"
          aria-hidden="true"
        />
      )}
    </>
  );
}

import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Menu, X, PlusSquare, LogOut, LayoutDashboard, Package, ClipboardList, BookOpen, Settings as SettingsIcon, Users, Shield, Layers, ChevronDown, History } from 'lucide-react';
import logo from '../../assets/logo.png';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
import './SideNavbar.css';

export default function SideNavbar({ currentView, onViewChange, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSteelOpen, setIsSteelOpen] = useState(true);
  const user = useSelector((state) => state.auth.user);
  const permissions = useSelector((state) => state.permissions.modules);

  const checkPermission = (moduleKey) => {
    if (!moduleKey) return true;
    const roleUpper = (user?.role || '').toUpperCase();
    if (roleUpper === 'ADMIN' || roleUpper === 'OWNER' || user?.accountType === 'developer') {
      return true;
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
      icon: <LayoutDashboard size={18} />
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
          moduleKey: 'inventory'
        },
        {
          id: 'inputs',
          label: 'Run Optimizer',
          icon: <PlusSquare size={17} />,
          moduleKey: 'optimizer'
        },
        {
          id: 'history',
          label: 'Batch History',
          icon: <ClipboardList size={17} />,
          moduleKey: 'history'
        }
      ]
    },
    {
      id: 'ledger',
      label: 'Ledger & Procurement',
      icon: <BookOpen size={18} />,
      moduleKey: 'ledger'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <SettingsIcon size={18} />,
      moduleKey: 'settings'
    },
    {
      id: 'users',
      label: 'User Management',
      icon: <Users size={18} />,
      moduleKey: 'users'
    },
    {
      id: 'roles',
      label: 'Roles & Permissions',
      icon: <Shield size={18} />,
      moduleKey: 'roles'
    },
    {
      id: 'activity-logs',
      label: 'Activity Logs',
      icon: <History size={18} />,
      moduleKey: 'activityLogs'
    }
  ];

  // Filter menu items based on permissions
  const menuItems = MENU_STRUCTURE.map(item => {
    if (item.isGroup && item.children) {
      const allowedChildren = item.children.filter(child => checkPermission(child.moduleKey));
      if (allowedChildren.length === 0) return null;
      return { ...item, children: allowedChildren };
    }
    if (!checkPermission(item.moduleKey)) return null;
    return item;
  }).filter(Boolean);

  const isSteelActive = ['inventory', 'inputs', 'results', 'history'].includes(currentView);

  const initials = user 
    ? ((user.firstName?.[0] || '') + (user.lastName?.[0] || '')).toUpperCase() 
    : 'U';

  return (
    <>
      {/* Mobile Header */}
      <div className="mobile-header">
        <button className="menu-toggle-btn" onClick={() => setIsOpen(true)}>
          <Menu size={24} />
        </button>
        <div className="mobile-logo-wrapper">
          <img src={logo} alt="RebarOptima" className="mobile-header-logo" />
        </div>
        <ThemeToggle />
      </div>

      {/* Sidenavbar */}
      <div className={`sidenav ${isOpen ? 'open' : ''}`}>
        {/* Close button for Mobile Drawer */}
        <button className="sidenav-close-btn" onClick={() => setIsOpen(false)}>
          <X size={24} />
        </button>

        {/* Logo Section */}
        <div className="sidenav-logo-container">
          <img src={logo} alt="RebarOptima" className="sidenav-logo" />
        </div>

        {/* Menu Links */}
        <nav className="sidenav-menu">
          {menuItems.map(item => {
            if (item.isGroup) {
              return (
                <div key={item.id} className="sidenav-group-container">
                  <button
                    className={`sidenav-item sidenav-group-header ${isSteelActive && !isSteelOpen ? 'active-parent' : ''}`}
                    onClick={() => setIsSteelOpen(prev => !prev)}
                    aria-expanded={isSteelOpen}
                  >
                    <span className="sidenav-icon">{item.icon}</span>
                    <span className="sidenav-label">{item.label}</span>
                    <ChevronDown size={16} className={`sidenav-chevron ${isSteelOpen ? 'open' : ''}`} />
                  </button>
                  {isSteelOpen && (
                    <div className="sidenav-submenu">
                      {item.children.map(child => (
                        <button
                          key={child.id}
                          className={`sidenav-item sidenav-subitem ${currentView === child.id || (currentView === 'results' && child.id === 'inputs') ? 'active' : ''}`}
                          onClick={() => {
                            onViewChange(child.id);
                            setIsOpen(false);
                          }}
                        >
                          <span className="sidenav-icon">{child.icon}</span>
                          <span className="sidenav-label">{child.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <button
                key={item.id}
                className={`sidenav-item ${currentView === item.id || (currentView === 'results' && item.id === 'inputs') ? 'active' : ''}`}
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

        {/* Sidebar Footer with Theme Toggle, User Profile & Logout */}
        <div className="sidenav-footer">
          <div className="theme-toggle-row">
            <span className="sidenav-footer-lbl">Theme</span>
            <ThemeToggle />
          </div>
          
          {user && (
            <button 
              className={`user-profile-badge ${currentView === 'profile' ? 'active' : ''}`}
              onClick={() => {
                onViewChange('profile');
                setIsOpen(false);
              }}
              title="View & Edit Profile"
            >
              {user.avatar ? (
                <img src={user.avatar} alt={user.firstName} className="profile-avatar-img" />
              ) : (
                <div className="profile-initials">{initials}</div>
              )}
              <div className="profile-details">
                <div className="profile-name">{user.firstName} {user.lastName}</div>
                <div className="profile-role-company">
                  <span className="profile-role">{user.role}</span>
                  <span className="profile-divider">•</span>
                  <span className="profile-company" title={`${user.companyName || 'Standard Firm'}${user.projectName ? ` (${user.projectName})` : ''}`}>
                    {user.companyName || 'Standard Firm'}{user.projectName ? ` • ${user.projectName}` : ''}
                  </span>
                </div>
              </div>
            </button>
          )}

          {onLogout && (
            <button 
              className="sidenav-item logout-btn" 
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
            >
              <span className="sidenav-icon"><LogOut size={18} /></span>
              <span className="sidenav-label">Logout</span>
            </button>
          )}
        </div>
      </div>

      {/* Backdrop overlay for Mobile Drawer */}
      {isOpen && <div className="sidenav-backdrop" onClick={() => setIsOpen(false)}></div>}
    </>
  );
}

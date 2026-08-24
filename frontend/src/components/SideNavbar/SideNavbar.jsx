import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Menu, X, PlusSquare, LogOut, LayoutDashboard, Package, ClipboardList, BookOpen, Settings as SettingsIcon, Users, Shield } from 'lucide-react';
import logo from '../../assets/logo.png';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
import './SideNavbar.css';

export default function SideNavbar({ currentView, onViewChange, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);
  const user = useSelector((state) => state.auth.user);
  const permissions = useSelector((state) => state.permissions.modules);

  const ALL_MENU_ITEMS = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <LayoutDashboard size={18} />
    },
    {
      id: 'inventory',
      label: 'Inventory',
      icon: <Package size={18} />,
      moduleKey: 'inventory'
    },
    {
      id: 'inputs',
      label: 'Run Optimizer',
      icon: <PlusSquare size={18} />,
      moduleKey: 'optimizer'
    },
    {
      id: 'history',
      label: 'Batch History',
      icon: <ClipboardList size={18} />,
      moduleKey: 'history'
    },
    {
      id: 'ledger',
      label: 'Ledger & Orders',
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
    }
  ];

  // Filter menu items based on permissions
  // If modules object is empty (e.g. initial load or legacy), default to showing everything except users/roles
  const menuItems = ALL_MENU_ITEMS.filter(item => {
    if (!item.moduleKey) return true; // Always show overview/dashboard if no key
    if (Object.keys(permissions || {}).length === 0) {
      return item.moduleKey !== 'users' && item.moduleKey !== 'roles';
    }
    return permissions[item.moduleKey] !== false;
  });

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
          {menuItems.map(item => (
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
          ))}
        </nav>

        {/* Sidebar Footer with Theme Toggle, User Profile & Logout */}
        <div className="sidenav-footer">
          <div className="theme-toggle-row">
            <span className="sidenav-footer-lbl">Theme</span>
            <ThemeToggle />
          </div>
          
          {user && (
            <div className="user-profile-badge">
              <div className="profile-initials">{initials}</div>
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
            </div>
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

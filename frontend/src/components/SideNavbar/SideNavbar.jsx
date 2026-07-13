import React, { useState } from 'react';
import { Menu, X, PlusSquare, LogOut, LayoutDashboard, Package, ClipboardList, BookOpen } from 'lucide-react';
import logo from '../../assets/logo.png';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
import './SideNavbar.css';

export default function SideNavbar({ currentView, onViewChange, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <LayoutDashboard size={18} />
    },
    {
      id: 'inventory',
      label: 'Inventory',
      icon: <Package size={18} />
    },
    {
      id: 'inputs',
      label: 'Run Optimizer',
      icon: <PlusSquare size={18} />
    },
    {
      id: 'history',
      label: 'Batch History',
      icon: <ClipboardList size={18} />
    },
    {
      id: 'ledger',
      label: 'Ledger & Orders',
      icon: <BookOpen size={18} />
    }
  ];


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

        {/* Sidebar Footer with Theme Toggle & Logout */}
        <div className="sidenav-footer">
          <div className="theme-toggle-row">
            <span className="sidenav-footer-lbl">Theme</span>
            <ThemeToggle />
          </div>
          
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


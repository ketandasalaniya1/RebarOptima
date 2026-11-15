import React, { useEffect } from 'react';
import { Layers, Warehouse, Boxes, FileStack, Menu } from 'lucide-react';
import './BottomNavBar.css';

const STEEL_VIEWS = ['inventory', 'ledger', 'inputs', 'results', 'history'];
const DRAWINGS_VIEWS = ['drawings', 'drawings-matrix', 'drawings-versions', 'drawings-viewer'];

export default function BottomNavBar({ currentView, onViewChange }) {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return undefined;
    const onResize = () => {
      const keyboard = window.innerHeight - viewport.height > 120;
      document.documentElement.classList.toggle('keyboard-open', keyboard);
    };
    viewport.addEventListener('resize', onResize);
    return () => viewport.removeEventListener('resize', onResize);
  }, []);
  const isSteelActive = STEEL_VIEWS.includes(currentView);
  const isDrawingsActive = DRAWINGS_VIEWS.includes(currentView);
  const isSiteInvActive = currentView === 'general-inventory';
  const isCastingActive = currentView === 'casting';

  const handleOpenMenu = () => {
    window.dispatchEvent(new CustomEvent('toggle-mobile-menu'));
  };

  return (
    <nav className="ro-bottom-nav" aria-label="Mobile quick navigation">
      {/* 1. Steel Suite */}
      <button
        type="button"
        className={`ro-bottom-nav-item ${isSteelActive ? 'active' : ''}`}
        onClick={() => onViewChange('inventory')}
        aria-label="Steel module"
      >
        <Layers size={18} />
        <span className="ro-bottom-nav-label">Steel</span>
      </button>

      {/* 2. Site Inventory */}
      <button
        type="button"
        className={`ro-bottom-nav-item ${isSiteInvActive ? 'active' : ''}`}
        onClick={() => onViewChange('general-inventory')}
        aria-label="Site inventory module"
      >
        <Warehouse size={18} />
        <span className="ro-bottom-nav-label">Site Stock</span>
      </button>

      {/* 3. Casting Management */}
      <button
        type="button"
        className={`ro-bottom-nav-item ${isCastingActive ? 'active' : ''}`}
        onClick={() => onViewChange('casting')}
        aria-label="Casting module"
      >
        <Boxes size={18} />
        <span className="ro-bottom-nav-label">Casting</span>
      </button>

      {/* 4. Drawings */}
      <button
        type="button"
        className={`ro-bottom-nav-item ${isDrawingsActive ? 'active' : ''}`}
        onClick={() => onViewChange('drawings')}
        aria-label="Drawings module"
      >
        <FileStack size={18} />
        <span className="ro-bottom-nav-label">Drawings</span>
      </button>

      {/* 5. Slide-in Full Menu Trigger */}
      <button
        type="button"
        className="ro-bottom-nav-item"
        onClick={handleOpenMenu}
        aria-label="Open complete menu"
      >
        <Menu size={18} />
        <span className="ro-bottom-nav-label">Menu</span>
      </button>
    </nav>
  );
}


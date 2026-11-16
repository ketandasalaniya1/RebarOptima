import React, { useState } from 'react';
import SearchInput from './SearchInput';
import Button from './Button';
import Drawer from './Drawer';
import './ui.css';

export default function FilterBar({
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search…',
  filters = null,
  onReset,
  activeCount = 0,
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ro-filterbar">
      <SearchInput
        value={searchValue}
        onChange={onSearchChange}
        onClear={() => onSearchChange && onSearchChange('')}
        placeholder={searchPlaceholder}
      />
      {filters ? <div className="ro-filterbar__inline">{filters}</div> : null}
      {filters ? (
        <Button variant="secondary" className="ro-filterbar__open" onClick={() => setOpen(true)}>
          {activeCount > 0 ? `Filters (${activeCount})` : 'Filters'}
        </Button>
      ) : null}
      {onReset ? (
        <Button variant="secondary" onClick={onReset}>
          Reset
        </Button>
      ) : null}
      <Drawer isOpen={open} onClose={() => setOpen(false)} title="Filters" size="sm">
        <div className="ro-filterbar__sheet">{filters}</div>
      </Drawer>
    </div>
  );
}

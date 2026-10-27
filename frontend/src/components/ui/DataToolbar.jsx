import React from 'react';
import { Search } from 'lucide-react';
import './ui.css';

export default function DataToolbar({
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search…',
  filters,
  countLabel,
  className = '',
}) {
  return (
    <div className={`ro-toolbar${className ? ` ${className}` : ''}`}>
      {onSearchChange ? (
        <div className="ro-toolbar__search">
          <Search size={16} className="ro-toolbar__search-icon" aria-hidden />
          <input
            type="search"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
        </div>
      ) : null}
      {filters ? <div className="ro-toolbar__filters">{filters}</div> : null}
      {countLabel != null ? <div className="ro-toolbar__count">{countLabel}</div> : null}
    </div>
  );
}

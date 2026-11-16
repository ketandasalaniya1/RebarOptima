import React from 'react';
import SearchInput from './SearchInput';
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
          <SearchInput
            value={searchValue}
            onChange={onSearchChange}
            onClear={() => onSearchChange('')}
            placeholder={searchPlaceholder}
          />
        </div>
      ) : null}
      {filters ? <div className="ro-toolbar__filters">{filters}</div> : null}
      {countLabel != null ? <div className="ro-toolbar__count">{countLabel}</div> : null}
    </div>
  );
}

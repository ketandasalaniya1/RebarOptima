import React from 'react';
import { Search, X } from 'lucide-react';
import './ui.css';

export default function SearchInput({
  value = '',
  onChange,
  onClear,
  placeholder = 'Search...',
  className = '',
  disabled = false,
  autoFocus = false,
}) {
  return (
    <div className={`ro-search-box ${className}`}>
      <Search size={15} className="ro-search-icon" aria-hidden="true" />
      <input
        type="text"
        className="ro-search-input"
        value={value}
        onChange={(e) => onChange && onChange(e.target.value, e)}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
      />
      {value && onClear && (
        <button
          type="button"
          className="ro-search-clear"
          onClick={onClear}
          aria-label="Clear search"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}


import React from 'react';
import { Users, X } from 'lucide-react';
import { formatINR, plural } from '../../../utils/money';

export default function ProviderRail({
  providers = [],
  selectedPerson = '',
  onSelectPerson
}) {
  if (!providers || providers.length === 0) return null;

  return (
    <div className="pc-provider-rail-wrap">
      <div className="pc-provider-rail-header">
        <div className="pc-provider-rail-title">
          <Users size={14} className="pc-provider-icon" />
          <span>Money Providers</span>
          <span className="pc-provider-count-pill">{providers.length}</span>
        </div>

        {selectedPerson && (
          <button
            type="button"
            className="pc-btn-clear-person"
            onClick={() => onSelectPerson('')}
            title="Clear person filter"
          >
            <span>Showing: {selectedPerson}</span>
            <X size={12} />
          </button>
        )}
      </div>

      <div className="pc-provider-chips-scroll">
        {providers.map((p, idx) => {
          const isSelected = selectedPerson === p.personName;
          return (
            <button
              key={p.personName || idx}
              type="button"
              className={`pc-provider-chip ${isSelected ? 'active' : ''}`}
              onClick={() => onSelectPerson(isSelected ? '' : p.personName)}
              title={`Filter by ${p.personName}`}
            >
              <div className="pc-provider-chip-top">
                <span className="pc-provider-chip-name">{p.personName}</span>
                <span className="pc-provider-chip-entries">{plural(p.count, 'entry', 'entries')}</span>
              </div>
              <div className="pc-provider-chip-amount">
                {formatINR(p.totalAmount)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}


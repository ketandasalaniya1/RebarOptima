export const SALARY_UNITS = [
  { value: 'per_month', label: 'Per month' },
  { value: 'per_day', label: 'Per day' },
  { value: 'per_hour', label: 'Per hour' },
];

export function salaryUnitLabel(unit) {
  return SALARY_UNITS.find((u) => u.value === unit)?.label || unit || '—';
}

export function formatSalary(amount, unit) {
  if (amount == null || amount === '') return '—';
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  return `₹${n.toLocaleString('en-IN')} / ${salaryUnitLabel(unit).replace(/^Per /i, '').toLowerCase()}`;
}

export function SalaryControl({ amount, unit, onAmountChange, onUnitChange, required = true }) {
  return (
    <div className="mp-salary-row">
      <div className="mp-field">
        <label>
          Salary amount {required && <span className="req">*</span>}
        </label>
        <input
          type="number"
          min="0"
          step="any"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          required={required}
        />
      </div>
      <div className="mp-field">
        <label>
          Salary unit {required && <span className="req">*</span>}
        </label>
        <select value={unit} onChange={(e) => onUnitChange(e.target.value)} required={required}>
          {SALARY_UNITS.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

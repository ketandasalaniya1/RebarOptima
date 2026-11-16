import React from 'react';
import './ui.css';

export default function Field({ label, htmlFor, children }) {
  return (
    <label className="ro-field" htmlFor={htmlFor}>
      {label ? <span className="ro-field__label">{label}</span> : null}
      {children}
    </label>
  );
}

import React from 'react';
import './ui.css';

export default function Select({ className = '', children, ...props }) {
  const cls = ['ro-select', className].filter(Boolean).join(' ');
  return (
    <select className={cls} {...props}>
      {children}
    </select>
  );
}

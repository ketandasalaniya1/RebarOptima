import React from 'react';
import './ui.css';

const BARE = new Set(['checkbox', 'radio', 'hidden', 'file', 'range', 'color']);

export default function Input({ className = '', type, ...props }) {
  const bare = BARE.has(type);
  const cls = [bare ? '' : 'ro-input', className].filter(Boolean).join(' ');
  return <input type={type} className={cls} {...props} />;
}

import React from 'react';
import './ui.css';

export default function Textarea({ className = '', ...props }) {
  const cls = ['ro-textarea', className].filter(Boolean).join(' ');
  return <textarea className={cls} {...props} />;
}

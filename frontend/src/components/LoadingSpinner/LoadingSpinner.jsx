import React from 'react';
import './LoadingSpinner.css';

export default function LoadingSpinner({ 
  message = 'Loading...', 
  minHeight = '55vh',
  size = 'medium' // 'small' | 'medium' | 'large'
}) {
  return (
    <div className="app-loading-container" style={{ minHeight }}>
      <div className={`app-loader-wrapper size-${size}`}>
        <div className="app-loader-glow"></div>
        <div className="app-loader-spinner"></div>
      </div>
      {message && <p className="app-loading-text">{message}</p>}
    </div>
  );
}

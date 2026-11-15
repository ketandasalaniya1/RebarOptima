import React from 'react';
import './LoadingSpinner.css';
import pulseLoaderSvg from '../../assets/rebaroptima-loader-pulse-glow.svg';

export default function LoadingSpinner({
  message = 'Loading...',
  minHeight = '55vh',
  size = 'medium' // 'small' | 'medium' | 'large' | 'xlarge'
}) {
  return (
    <div className="app-loading-container" style={{ minHeight }}>
      <div className={`app-loader-wrapper size-${size}`}>
        <img
          src={pulseLoaderSvg}
          alt="CraveToBuild Loading..."
          className="app-pulse-loader-svg"
          loading="eager"
        />
      </div>
      {message && <p className="app-loading-text">{message}</p>}
    </div>
  );
}

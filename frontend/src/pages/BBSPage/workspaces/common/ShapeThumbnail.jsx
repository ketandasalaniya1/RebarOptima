import React from 'react';

/**
 * ShapeThumbnail: Renders clean vector sketches of standard rebar shapes
 * Supports Shape 00 (Straight), Shape 11 (L-Bar), Shape 21 (U-Bar),
 * Shape 41 (Cranked), Shape 51 (Rectangular Stirrup), Shape 61 (Diamond Stirrup),
 * and Shape 31 (Link / Cross-tie).
 */
export default function ShapeThumbnail({ shapeCode, parameters = {}, width = 64, height = 40 }) {
  const code = (shapeCode || '').toLowerCase().replace(/[\s_-]/g, '');

  // Render SVG paths based on shape code
  let pathContent = null;

  if (code.includes('00') || code.includes('straight')) {
    // Shape 00: Straight bar
    pathContent = (
      <>
        <line x1="8" y1="20" x2="56" y2="20" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
        <circle cx="8" cy="20" r="2.5" fill="#2563eb" />
        <circle cx="56" cy="20" r="2.5" fill="#2563eb" />
      </>
    );
  } else if (code.includes('11') || code.includes('lbar') || code.includes('lbend')) {
    // Shape 11: 90° L-Bar
    pathContent = (
      <>
        <path d="M 12 8 L 12 28 L 52 28" fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="8" r="2" fill="#2563eb" />
        <circle cx="52" cy="28" r="2" fill="#2563eb" />
      </>
    );
  } else if (code.includes('21') || code.includes('ubar')) {
    // Shape 21: U-Bar
    pathContent = (
      <>
        <path d="M 14 10 L 14 30 L 50 30 L 50 10" fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="14" cy="10" r="2" fill="#2563eb" />
        <circle cx="50" cy="10" r="2" fill="#2563eb" />
      </>
    );
  } else if (code.includes('41') || code.includes('crank')) {
    // Shape 41: Cranked Bar
    pathContent = (
      <>
        <path d="M 8 26 L 24 26 L 40 14 L 56 14" fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="8" cy="26" r="2" fill="#2563eb" />
        <circle cx="56" cy="14" r="2" fill="#2563eb" />
      </>
    );
  } else if (code.includes('51') || code.includes('stirrup') || code.includes('tie') || code.includes('closed')) {
    // Shape 51: Closed Rectangular Stirrup with 135° hooks
    pathContent = (
      <>
        <rect x="12" y="8" width="40" height="24" rx="3" fill="none" stroke="#0284c7" strokeWidth="2.5" />
        {/* 135° hook overlaps at top-left corner */}
        <path d="M 14 14 L 20 20" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" />
        <path d="M 18 10 L 22 16" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" />
      </>
    );
  } else if (code.includes('61') || code.includes('diamond')) {
    // Shape 61: Diamond Stirrup
    pathContent = (
      <>
        <polygon points="32,6 54,20 32,34 10,20" fill="none" stroke="#0284c7" strokeWidth="2.5" strokeLinejoin="round" />
        <line x1="32" y1="12" x2="36" y2="17" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" />
      </>
    );
  } else if (code.includes('31') || code.includes('link') || code.includes('cross')) {
    // Shape 31: Cross-tie / Open link
    pathContent = (
      <>
        <path d="M 12 14 L 12 24 L 52 24 L 52 14" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Hook returns */}
        <line x1="12" y1="14" x2="8" y2="18" stroke="#2563eb" strokeWidth="2" />
        <line x1="52" y1="14" x2="48" y2="10" stroke="#2563eb" strokeWidth="2" />
      </>
    );
  } else {
    // Generic fallback shape
    pathContent = (
      <rect x="10" y="10" width="44" height="20" rx="2" fill="none" stroke="#64748b" strokeWidth="2" strokeDasharray="3 2" />
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 64 40"
      className="bbs-shape-thumbnail-svg"
      title={`${shapeCode || 'Rebar Shape'}`}
    >
      <rect x="1" y="1" width="62" height="38" rx="4" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
      {pathContent}
    </svg>
  );
}


import React from 'react';
import './ShapeRenderer.css';

/**
 * ShapeRenderer
 * Dynamically draws an SVG representation of an IS code rebar shape based on its shape_code.
 * 
 * Supports:
 * - 20 (Straight)
 * - 37 (L-Shape / Bend)
 * - 38 (U-Shape)
 * - 41 (Cranked / Offset)
 * - 51 (Link / Stirrup)
 * - Fallback / Custom (Generic polygonal)
 */
export default function ShapeRenderer({ shapeCode, className = '', color = 'var(--text-secondary)' }) {
  
  // Generic box bounds
  const width = 120;
  const height = 80;

  let pathData = '';
  let viewBox = `0 0 ${width} ${height}`;

  const codeLower = String(shapeCode).toLowerCase().trim();

  // Match by IS code or common names (including 'Streight')
  if (codeLower === '20' || codeLower === 'straight' || codeLower === 'streight') {
    // A simple straight line with tiny hooks at the end to denote a bar
    pathData = `M 10,${height/2} L ${width-10},${height/2}`;
  } else if (codeLower === '37' || codeLower.includes('l-shape') || codeLower.includes('l shape')) {
    // L shape
    pathData = `M 20,20 L 20,${height-20} L ${width-20},${height-20}`;
  } else if (codeLower === '38' || codeLower.includes('u-shape') || codeLower.includes('u shape')) {
    // U shape
    pathData = `M 20,20 L 20,${height-20} L ${width-20},${height-20} L ${width-20},20`;
  } else if (codeLower === '41' || codeLower.includes('crank')) {
    // A cranked bar
    pathData = `M 10,${height-20} L 40,${height-20} L 80,20 L ${width-10},20`;
  } else if (codeLower === '51' || codeLower.includes('link') || codeLower.includes('stirrup')) {
    // Rectangular link with two inward overlapping 135° hooks
    pathData = `M 35,35 L 20,20 L ${width-20},20 L ${width-20},${height-20} L 20,${height-20} L 20,20 L 35,25`;
  } else if (codeLower === '13' || codeLower.includes('semi')) {
    // Semi-circular
    pathData = `M 20,${height-20} A ${(width-40)/2} ${(height-40)/2} 0 0 1 ${width-20} ${height-20}`;
  } else {
    // Custom / Generic Polygon
    pathData = `M 20,${height-20} L 30,30 L 60,10 L ${width-30},40 L ${width-20},${height-30}`;
  }

  return (
    <div className={`shape-renderer-wrapper ${className}`}>
      <svg 
        viewBox={viewBox} 
        className="shape-renderer-svg"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Shadow / Glow effect for aesthetics */}
        <path 
          d={pathData} 
          fill="none" 
          stroke={color} 
          strokeWidth="6" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          opacity="0.1"
          transform="translate(2, 2)"
        />
        {/* Main Bar */}
        <path 
          d={pathData} 
          fill="none" 
          stroke={color} 
          strokeWidth="4" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
      </svg>
    </div>
  );
}

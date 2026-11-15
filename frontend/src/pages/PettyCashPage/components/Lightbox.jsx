import React, { useEffect, useState } from 'react';
import { X, Download, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Lightbox({ photos = [], initialIndex = 0, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') {
        setCurrentIndex(prev => (prev > 0 ? prev - 1 : photos.length - 1));
      }
      if (e.key === 'ArrowRight') {
        setCurrentIndex(prev => (prev < photos.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photos, onClose]);

  if (!photos || photos.length === 0) return null;

  const currentPhoto = photos[currentIndex] || photos[0];

  return (
    <div className="pc-modal-backdrop pc-lightbox-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="pc-lightbox-container" onClick={(e) => e.stopPropagation()}>
        {/* Top Header */}
        <div className="pc-lightbox-header">
          <div className="pc-lightbox-title-wrap">
            <h4>{currentPhoto.name || `Photo ${currentIndex + 1}`}</h4>
            {photos.length > 1 && (
              <span className="pc-lightbox-pager">
                {currentIndex + 1} of {photos.length}
              </span>
            )}
          </div>
          <div className="pc-lightbox-actions">
            <a
              href={currentPhoto.dataUrl || currentPhoto.url}
              download={currentPhoto.name || `receipt_${currentIndex + 1}.jpg`}
              className="pc-lightbox-btn-download"
              title="Download image"
              aria-label="Download image"
            >
              <Download size={16} />
              <span>Download</span>
            </a>
            <button
              type="button"
              className="pc-lightbox-btn-close"
              onClick={onClose}
              title="Close viewer (Esc)"
              aria-label="Close viewer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Image Display */}
        <div className="pc-lightbox-stage">
          {photos.length > 1 && (
            <button
              type="button"
              className="pc-lightbox-nav pc-lightbox-nav-prev"
              onClick={() => setCurrentIndex(prev => (prev > 0 ? prev - 1 : photos.length - 1))}
              title="Previous photo (Left arrow)"
              aria-label="Previous photo"
            >
              <ChevronLeft size={24} />
            </button>
          )}

          <div className="pc-lightbox-image-wrap">
            <img
              src={currentPhoto.dataUrl || currentPhoto.url}
              alt={currentPhoto.name || 'Receipt photograph'}
              className="pc-lightbox-img"
            />
          </div>

          {photos.length > 1 && (
            <button
              type="button"
              className="pc-lightbox-nav pc-lightbox-nav-next"
              onClick={() => setCurrentIndex(prev => (prev < photos.length - 1 ? prev + 1 : 0))}
              title="Next photo (Right arrow)"
              aria-label="Next photo"
            >
              <ChevronRight size={24} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


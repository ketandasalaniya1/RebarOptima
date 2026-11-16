import React, { useRef } from 'react';
import { Camera, Image as ImageIcon, X } from 'lucide-react';
import { compressImage } from '../../../utils/money';
import { Input } from '../../../components/ui';

export default function PhotoPicker({ photos = [], onChange, disabled = false }) {
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const handleFiles = async (filesList) => {
    const files = Array.from(filesList || []);
    if (files.length === 0) return;

    try {
      const compressedList = await Promise.all(
        files.map(file => compressImage(file, 1280, 1280, 0.75))
      );
      onChange([...photos, ...compressedList]);
    } catch (err) {
      console.error('Error compressing image:', err);
      // Fallback: load without compression
      const fallbackList = [];
      for (const file of files) {
        const reader = new FileReader();
        reader.onload = (e) => {
          fallbackList.push({ dataUrl: e.target.result, name: file.name, size: file.size });
          if (fallbackList.length === files.length) {
            onChange([...photos, ...fallbackList]);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const removePhoto = (index) => {
    onChange(photos.filter((_, i) => i !== index));
  };

  return (
    <div className="pc-photo-picker">
      {/* Hidden File Inputs */}
      <Input
        type="file"
        accept="image/*"
        capture="environment"
        ref={cameraInputRef}
        style={{ display: 'none' }}
        disabled={disabled}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <Input
        type="file"
        accept="image/*"
        multiple
        ref={galleryInputRef}
        style={{ display: 'none' }}
        disabled={disabled}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <div className="pc-photo-actions-row">
        <button
          type="button"
          className="pc-btn-camera"
          onClick={() => cameraInputRef.current?.click()}
          disabled={disabled}
          title="Take photo with camera"
          aria-label="Take photo with camera"
        >
          <Camera size={18} />
          <span>Camera</span>
        </button>

        <button
          type="button"
          className="pc-btn-gallery"
          onClick={() => galleryInputRef.current?.click()}
          disabled={disabled}
          title="Upload from gallery"
          aria-label="Upload from gallery"
        >
          <ImageIcon size={18} />
          <span>Gallery</span>
        </button>

        {photos.length > 0 && (
          <span className="pc-photo-count-badge">
            {photos.length} attached
          </span>
        )}
      </div>

      {photos.length > 0 && (
        <div className="pc-photo-thumbnails-grid">
          {photos.map((photo, idx) => (
            <div key={idx} className="pc-photo-thumb-card">
              <img
                src={photo.dataUrl}
                alt={photo.name || `Receipt ${idx + 1}`}
                className="pc-photo-thumb-img"
              />
              <button
                type="button"
                className="pc-photo-remove-btn"
                onClick={() => removePhoto(idx)}
                disabled={disabled}
                title="Remove photo"
                aria-label="Remove photo"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


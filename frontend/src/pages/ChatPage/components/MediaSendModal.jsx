import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  Send,
  Smile,
  RotateCw,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Trash2,
  FileText,
  Loader2,
  Play,
} from 'lucide-react';
import ReactionPickerModal from './ReactionPickerModal';
import { chatApi } from '../../../utils/api';
import { validateChatFile, CHAT_FILE_ACCEPT } from '../utils/chatFileSecurity';

/**
 * Format bytes into readable string: e.g. "6 KB", "2.4 MB"
 */
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Get clean file extension in uppercase: e.g. "PDF", "PNG", "DOCX"
 */
function getFileExtension(filename = '') {
  const parts = filename.split('.');
  if (parts.length > 1) {
    return parts.pop().toUpperCase();
  }
  return 'FILE';
}

/**
 * Rotate an image using HTML5 Canvas so the uploaded binary has the rotation baked in
 */
function getRotatedBase64(dataUrl, rotationDegree) {
  return new Promise((resolve) => {
    if (!rotationDegree || rotationDegree % 360 === 0) {
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const rads = (rotationDegree * Math.PI) / 180;
      const is90or270 = Math.abs(rotationDegree % 180) === 90;

      canvas.width = is90or270 ? img.height : img.width;
      canvas.height = is90or270 ? img.width : img.height;

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rads);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export default function MediaSendModal({
  isOpen,
  onClose,
  initialFiles = [],
  onSendMedia,
}) {
  const [fileItems, setFileItems] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [caption, setCaption] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const addFilesInputRef = useRef(null);
  const captionInputRef = useRef(null);

  // Initialize file items when modal opens
  useEffect(() => {
    if (isOpen && initialFiles && initialFiles.length > 0) {
      loadInitialFiles(initialFiles);
      setCaption('');
      setShowEmojiPicker(false);
      setIsUploading(false);
    }
  }, [isOpen, initialFiles]);

  const loadInitialFiles = (files) => {
    const validFiles = [];
    for (const file of files) {
      const check = validateChatFile(file);
      if (!check.valid) {
        alert(check.error);
      } else {
        validFiles.push(file);
      }
    }

    if (validFiles.length === 0) {
      onClose();
      return;
    }

    const items = [];
    let processed = 0;

    validFiles.forEach((file, index) => {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      const isAudio = file.type.startsWith('audio/');

      const item = {
        id: `file-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 7)}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        isImage,
        isVideo,
        isAudio,
        rotation: 0,
        zoom: 1,
        previewUrl: '',
        base64Data: '',
      };

      const reader = new FileReader();
      reader.onload = () => {
        item.previewUrl = reader.result;
        item.base64Data = reader.result;
        items.push(item);
        processed += 1;
        if (processed === validFiles.length) {
          setFileItems([...items]);
          setActiveIndex(0);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const currentItem = fileItems[activeIndex] || null;

  // Add more files from input
  const handleAddMoreFiles = (e) => {
    const rawFiles = Array.from(e.target.files || []);
    if (rawFiles.length === 0) return;

    const validFiles = [];
    for (const file of rawFiles) {
      const check = validateChatFile(file);
      if (!check.valid) {
        alert(check.error);
      } else {
        validFiles.push(file);
      }
    }

    if (validFiles.length === 0) {
      if (addFilesInputRef.current) addFilesInputRef.current.value = '';
      return;
    }

    const newItems = [];
    let count = 0;

    validFiles.forEach((file, index) => {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      const isAudio = file.type.startsWith('audio/');

      const item = {
        id: `file-add-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 7)}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        isImage,
        isVideo,
        isAudio,
        rotation: 0,
        zoom: 1,
        previewUrl: '',
        base64Data: '',
      };

      const reader = new FileReader();
      reader.onload = () => {
        item.previewUrl = reader.result;
        item.base64Data = reader.result;
        newItems.push(item);
        count += 1;
        if (count === validFiles.length) {
          setFileItems((prev) => {
            const combined = [...prev, ...newItems];
            setActiveIndex(combined.length - 1);
            return combined;
          });
        }
      };
      reader.readAsDataURL(file);
    });

    if (addFilesInputRef.current) addFilesInputRef.current.value = '';
  };

  // Remove a file from list
  const handleRemoveFile = (indexToRemove, e) => {
    if (e) e.stopPropagation();
    const updated = fileItems.filter((_, idx) => idx !== indexToRemove);
    if (updated.length === 0) {
      onClose();
      return;
    }
    setFileItems(updated);
    if (activeIndex >= updated.length) {
      setActiveIndex(updated.length - 1);
    }
  };

  // Image manipulation tools
  const handleRotate = () => {
    if (!currentItem || !currentItem.isImage) return;
    setFileItems((prev) =>
      prev.map((item, idx) =>
        idx === activeIndex ? { ...item, rotation: (item.rotation + 90) % 360 } : item
      )
    );
  };

  const handleZoomIn = () => {
    if (!currentItem || !currentItem.isImage) return;
    setFileItems((prev) =>
      prev.map((item, idx) =>
        idx === activeIndex ? { ...item, zoom: Math.min((item.zoom || 1) + 0.25, 3) } : item
      )
    );
  };

  const handleZoomOut = () => {
    if (!currentItem || !currentItem.isImage) return;
    setFileItems((prev) =>
      prev.map((item, idx) =>
        idx === activeIndex ? { ...item, zoom: Math.max((item.zoom || 1) - 0.25, 0.5) } : item
      )
    );
  };

  const handleResetImage = () => {
    if (!currentItem || !currentItem.isImage) return;
    setFileItems((prev) =>
      prev.map((item, idx) => (idx === activeIndex ? { ...item, rotation: 0, zoom: 1 } : item))
    );
  };

  const handleInsertEmoji = (emoji) => {
    setCaption((prev) => prev + emoji);
    if (captionInputRef.current) {
      captionInputRef.current.focus();
    }
  };

  // Handle final Send
  const handleSendAll = async () => {
    if (fileItems.length === 0 || isUploading) return;
    setIsUploading(true);

    try {
      const uploadedAttachments = [];

      for (const item of fileItems) {
        let finalData = item.base64Data;
        if (item.isImage && item.rotation !== 0) {
          finalData = await getRotatedBase64(item.base64Data, item.rotation);
        }

        const uploadRes = await chatApi.uploadAttachment({
          fileName: item.name,
          mimeType: item.type,
          sizeBytes: item.size,
          dataBase64: finalData,
        });

        if (uploadRes.success && uploadRes.data) {
          uploadedAttachments.push(uploadRes.data);
        } else {
          throw new Error(uploadRes.message || `Failed to upload ${item.name}`);
        }
      }

      // Determine main message type
      let mainType = 'document';
      if (fileItems.length === 1) {
        if (fileItems[0].isImage) mainType = 'image';
        else if (fileItems[0].isVideo) mainType = 'video';
        else if (fileItems[0].isAudio) mainType = 'audio';
      } else {
        const allImages = fileItems.every((f) => f.isImage);
        const hasVideo = fileItems.some((f) => f.isVideo);
        if (allImages) mainType = 'image';
        else if (hasVideo) mainType = 'video';
      }

      onSendMedia({
        content: caption.trim(),
        type: mainType,
        attachments: uploadedAttachments,
      });

      onClose();
    } catch (err) {
      alert(`Send failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendAll();
    }
  };

  if (!isOpen || fileItems.length === 0) return null;

  return (
    <div className="chat-media-modal-backdrop" onKeyDown={handleKeyDown}>
      {/* ── 1. TOP HEADER BAR ───────────────────────────────────────────────── */}
      <div className="chat-media-modal-header">
        <button
          type="button"
          className="chat-media-modal-close-btn"
          onClick={onClose}
          title="Close (Esc)"
        >
          <X size={22} />
        </button>

        <div className="chat-media-modal-title">
          {currentItem ? currentItem.name : 'Preview'}
        </div>

        {/* Image manipulation tools (Rotate, Zoom, Reset, Delete) */}
        <div className="chat-media-modal-tools">
          {currentItem && currentItem.isImage && (
            <>
              <button
                type="button"
                className="chat-media-tool-btn"
                onClick={handleRotate}
                title="Rotate 90°"
              >
                <RotateCw size={18} />
              </button>
              <button
                type="button"
                className="chat-media-tool-btn"
                onClick={handleZoomIn}
                title="Zoom In"
              >
                <ZoomIn size={18} />
              </button>
              <button
                type="button"
                className="chat-media-tool-btn"
                onClick={handleZoomOut}
                title="Zoom Out"
              >
                <ZoomOut size={18} />
              </button>
              <button
                type="button"
                className="chat-media-tool-btn"
                onClick={handleResetImage}
                title="Reset View"
              >
                <RotateCcw size={18} />
              </button>
            </>
          )}

          {fileItems.length > 1 && (
            <button
              type="button"
              className="chat-media-tool-btn danger"
              onClick={(e) => handleRemoveFile(activeIndex, e)}
              title="Remove File"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>

      {/* ── 2. CENTER PREVIEW AREA ─────────────────────────────────────────── */}
      <div className="chat-media-modal-body">
        {currentItem && (
          <>
            {currentItem.isImage ? (
              /* Image Preview with rotation and zoom */
              <div className="chat-media-image-viewport">
                <img
                  src={currentItem.previewUrl}
                  alt={currentItem.name}
                  className="chat-media-preview-img"
                  style={{
                    transform: `rotate(${currentItem.rotation || 0}deg) scale(${currentItem.zoom || 1})`,
                    transition: 'transform 0.2s ease',
                  }}
                />
              </div>
            ) : currentItem.isVideo ? (
              /* Video Preview */
              <div className="chat-media-video-viewport">
                <video
                  src={currentItem.previewUrl}
                  controls
                  className="chat-media-preview-video"
                />
              </div>
            ) : currentItem.isAudio ? (
              /* Audio Preview */
              <div className="chat-media-audio-viewport">
                <audio src={currentItem.previewUrl} controls />
                <div style={{ color: '#cbd5e1', marginTop: '12px', fontSize: '14px' }}>
                  {currentItem.name}
                </div>
              </div>
            ) : (
              /* Document Preview (Matching Reference Image exactly) */
              <div className="chat-media-doc-card">
                {/* Large white folded page icon */}
                <div className="chat-media-doc-sheet-icon">
                  <div className="sheet-fold"></div>
                </div>
                <div className="chat-media-doc-heading">No preview available</div>
                <div className="chat-media-doc-subheading">
                  {formatFileSize(currentItem.size)} · {getFileExtension(currentItem.name)}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── 3. BOTTOM CAPTION & THUMBNAIL ROW ─────────────────────────────────── */}
      <div className="chat-media-modal-footer">
        {/* Caption Input with Emoji Button */}
        <div className="chat-media-caption-box">
          <input
            type="text"
            ref={captionInputRef}
            placeholder="Type a message"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="chat-media-caption-input"
            autoFocus
          />
          <button
            type="button"
            className="chat-media-caption-emoji-btn"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Emoji"
          >
            <Smile size={22} />
          </button>

          {/* Emoji Picker Popup opening directly above caption input */}
          <ReactionPickerModal
            isOpen={showEmojiPicker}
            onClose={() => setShowEmojiPicker(false)}
            onSelectEmoji={handleInsertEmoji}
            placement="above"
          />
        </div>

        {/* Thumbnails Strip + Add Button + Send Button */}
        <div className="chat-media-footer-bottom-row">
          <div className="chat-media-thumbnails-strip">
            {fileItems.map((item, index) => {
              const isActive = index === activeIndex;
              const isPdf = item.name.toLowerCase().endsWith('.pdf');

              return (
                <div
                  key={item.id}
                  className={`chat-media-thumb-item ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveIndex(index)}
                  title={item.name}
                >
                  {item.isImage ? (
                    <img
                      src={item.previewUrl}
                      alt={item.name}
                      className="chat-media-thumb-img"
                      style={{
                        transform: `rotate(${item.rotation || 0}deg)`,
                      }}
                    />
                  ) : item.isVideo ? (
                    <div className="chat-media-thumb-video">
                      <video
                        src={item.previewUrl}
                        className="chat-media-thumb-img"
                        muted
                      />
                      <span className="chat-media-video-overlay-badge">
                        <Play size={10} fill="#ffffff" color="#ffffff" />
                      </span>
                    </div>
                  ) : (
                    <div className="chat-media-thumb-doc">
                      {isPdf ? (
                        <span className="chat-media-pdf-badge">PDF</span>
                      ) : (
                        <FileText size={18} color="#94a3b8" />
                      )}
                    </div>
                  )}

                  {fileItems.length > 1 && (
                    <button
                      type="button"
                      className="chat-media-thumb-remove"
                      onClick={(e) => handleRemoveFile(index, e)}
                      title="Remove"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              );
            })}

            {/* "+" Add more files button (Matching Reference Image) */}
            <button
              type="button"
              className="chat-media-add-more-btn"
              onClick={() => addFilesInputRef.current?.click()}
              title="Add more photos, videos or documents"
              disabled={isUploading}
            >
              <Plus size={20} />
            </button>

            <input
              type="file"
              ref={addFilesInputRef}
              onChange={handleAddMoreFiles}
              style={{ display: 'none' }}
              multiple
              accept={CHAT_FILE_ACCEPT}
            />
          </div>

          {/* WhatsApp Green Circular Send Button */}
          <button
            type="button"
            className="chat-media-send-btn"
            onClick={handleSendAll}
            disabled={isUploading}
            title="Send"
          >
            {isUploading ? (
              <Loader2 size={24} className="chat-spin-anim" />
            ) : (
              <Send size={22} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

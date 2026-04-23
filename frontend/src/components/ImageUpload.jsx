import React, { useState, useRef } from 'react';
import { validateImage, processImage } from '../utils/imageProcessor';

const ImageUpload = ({ onImageSelect, disabled = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const fileInputRef = useRef(null);

  const handlePaste = (e) => {
    if (disabled) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) { e.preventDefault(); handleFile(file); break; }
      }
    }
  };

  const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); if (!disabled) setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };

  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    if (disabled) return;
    const files = e.dataTransfer.files;
    if (files && files[0]) handleFile(files[0]);
  };

  const handleFileInput = (e) => {
    const files = e.target.files;
    if (files && files[0]) handleFile(files[0]);
    e.target.value = '';
  };

  const handleFile = async (file) => {
    const validation = validateImage(file);
    if (!validation.valid) { alert(validation.error); return; }
    try {
      setIsProcessing(true);
      const processedFile = await processImage(file);
      onImageSelect(processedFile);
    } catch (error) {
      alert(error.message || '图片处理失败');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUploadClick = (e) => {
    e.stopPropagation();
    if (!disabled) fileInputRef.current?.click();
  };

  const handleZoneClick = () => { if (!disabled) setIsFocused(true); };
  const handleFocus = () => { if (!disabled) setIsFocused(true); };
  const handleBlur = () => setIsFocused(false);

  return (
    <div
      className={`upload-zone ${isDragging ? 'drag-over' : ''} ${disabled ? 'disabled' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleZoneClick}
      onPaste={handlePaste}
      onFocus={handleFocus}
      onBlur={handleBlur}
      tabIndex={disabled ? -1 : 0}
      style={{ opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileInput} style={{ display: 'none' }} disabled={disabled} />
      <div className="upload-placeholder upload-placeholder-large">
        <div className="upload-icon-shell">
          <div className="upload-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
              <circle cx="9" cy="9" r="2"/>
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
            </svg>
          </div>
        </div>

        {isProcessing ? (
          <div className="upload-copy">
            <div className="upload-title">处理中</div>
            <div className="upload-text">正在校验并压缩图片，请稍等。</div>
          </div>
        ) : (
          <>
            <div className="upload-copy">
              <div className="upload-title">上传图片素材</div>
              <div className="upload-text">
                {isFocused ? '已激活，可直接粘贴图片。' : '拖拽图片到此处，或点击后激活粘贴。'}
              </div>
            </div>
            <div className="upload-actions">
              <button
                className="glass-button upload-primary-btn"
                onClick={handleUploadClick}
                disabled={disabled}
              >
                选择图片文件
              </button>
              <span className="upload-chip">JPG / PNG</span>
              <span className="upload-chip">Max 10MB</span>
            </div>
          </>
        )}

        <div className="upload-hint">支持拖拽、点击选择，以及 Ctrl+V 粘贴截图。</div>
      </div>
    </div>
  );
};

export default ImageUpload;

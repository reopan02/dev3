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
      style={{ opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer', textAlign: 'center' }}
    >
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileInput} style={{ display: 'none' }} disabled={disabled} />

      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35, marginBottom: '12px', display: 'block', margin: '0 auto 12px' }}>
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
        <circle cx="9" cy="9" r="2"/>
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
      </svg>

      {isProcessing ? (
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>处理中...</div>
      ) : (
        <>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
            {isFocused ? '已激活 — 按 Ctrl+V 粘贴图片' : '拖拽图片到此处，或点击激活粘贴'}
          </div>
          <button
            className="glass-button"
            onClick={handleUploadClick}
            disabled={disabled}
            style={{ padding: '7px 14px', fontSize: '12px', minHeight: '36px' }}
          >
            选择图片文件
          </button>
        </>
      )}

      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px' }}>
        JPG · PNG · 最大 10MB
      </div>
    </div>
  );
};

export default ImageUpload;

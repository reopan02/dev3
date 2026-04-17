import React, { useState, useEffect } from 'react';

const ImagePreview = ({ image, loading = false, placeholder = '图片预览' }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleImageClick = () => {
    if (image) {
      setIsModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      handleCloseModal();
    }
  };

  // ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isModalOpen) {
        handleCloseModal();
      }
    };

    if (isModalOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isModalOpen]);

  return (
    <>
      <div className="image-preview">
        {loading ? (
          <div style={{ textAlign: 'center' }}>
            <div className="loading-spinner" style={{ marginBottom: '16px' }}></div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>处理中...</div>
          </div>
        ) : image ? (
          <img
            src={image}
            alt="Preview"
            onClick={handleImageClick}
            style={{ cursor: 'pointer' }}
            title="点击放大预览"
          />
        ) : (
          <div style={{ textAlign: 'center', opacity: 0.4 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 8px' }}>
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
              <circle cx="9" cy="9" r="2"/>
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
            </svg>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{placeholder}</div>
          </div>
        )}
      </div>

      {/* Modal for enlarged preview */}
      {isModalOpen && (
        <div className="image-modal-backdrop" onClick={handleBackdropClick}>
          <div className="image-modal-content">
            <button className="image-modal-close" onClick={handleCloseModal}>
              ✕
            </button>
            <img src={image} alt="Enlarged Preview" className="image-modal-image" />
          </div>
        </div>
      )}
    </>
  );
};

export default ImagePreview;

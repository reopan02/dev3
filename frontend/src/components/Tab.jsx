import React from 'react';

function Tab({ tab, isActive, onClick, onClose, canClose }) {
  const getStatusColor = () => {
    switch (tab.status) {
      case 'generating':
        return 'generating';
      case 'complete':
        return 'complete';
      case 'error':
        return 'error';
      default:
        return '';
    }
  };

  const handleClose = (e) => {
    e.stopPropagation();
    if (tab.status === 'generating') {
      if (window.confirm('生成正在进行中，确定要关闭此标签吗？')) {
        onClose(tab.id);
      }
    } else {
      onClose(tab.id);
    }
  };

  return (
    <button
      className={`tab ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="tab-icon">
        {tab.status === 'generating' ? (
          <div className="loading-spinner" style={{ width: '14px', height: '14px' }}></div>
        ) : (
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z"/>
          </svg>
        )}
      </div>
      <span>{tab.label}</span>
      <div className={`tab-status ${getStatusColor()}`}></div>
      {canClose && (
        <button className="tab-close" onClick={handleClose}>
          ×
        </button>
      )}
    </button>
  );
}

export default Tab;

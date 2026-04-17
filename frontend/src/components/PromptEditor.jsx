import React from 'react';

const PromptEditor = ({ value, onChange, disabled = false, placeholder = '卡面风格提示词将显示在这里...' }) => {
  const charCount = value ? value.length : 0;

  return (
    <div className="glass-card" style={{ marginTop: '16px' }}>
      <div style={{
        fontSize: '12px',
        fontWeight: '600',
        marginBottom: '12px',
        opacity: 0.8,
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        卡面风格提示词
      </div>
      <textarea
        className="prompt-editor"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
      />
      <div style={{
        textAlign: 'right',
        fontSize: '11px',
        marginTop: '8px',
        opacity: 0.6
      }}>
        {charCount} 字符
      </div>
    </div>
  );
};

export default PromptEditor;

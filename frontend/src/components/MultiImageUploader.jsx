import { useCallback, useRef, useState } from 'react'

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function filesToImages(files) {
  const accepted = Array.from(files || []).filter((file) => file.type.startsWith('image/'))
  return Promise.all(accepted.map(async (file, index) => ({
    id: `${Date.now()}-${index}-${file.name}`,
    name: file.name,
    dataUrl: await readFileAsDataUrl(file),
  })))
}

export default function MultiImageUploader({ label, value, onChange, maxCount = 4, disabled = false }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  const appendFiles = useCallback(async (files) => {
    const images = await filesToImages(files)
    if (!images.length) return
    onChange([...(value || []), ...images].slice(0, maxCount))
  }, [maxCount, onChange, value])

  const handleChange = async (event) => {
    await appendFiles(event.target.files)
    event.target.value = ''
  }

  const handleDrop = async (event) => {
    event.preventDefault()
    setDragOver(false)
    if (disabled) return
    await appendFiles(event.dataTransfer.files)
  }

  const handlePaste = useCallback(async (event) => {
    if (disabled) return
    const images = Array.from(event.clipboardData?.items || [])
      .filter((item) => item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter(Boolean)
    if (!images.length) return
    event.preventDefault()
    await appendFiles(images)
  }, [appendFiles, disabled])

  const removeImage = (id) => {
    onChange((value || []).filter((item) => item.id !== id))
  }

  return (
    <div className="image-uploader">
      <div className="image-uploader-label">{label}</div>
      <div
        className={`image-uploader-area${dragOver ? ' drag-over' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onPaste={handlePaste}
        tabIndex={disabled ? -1 : 0}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleChange}
          style={{ display: 'none' }}
          disabled={disabled}
        />

        <div className="upload-toolbar">
          <div className="upload-toolbar-copy">
            <div className="upload-toolbar-title">Reference Set</div>
            <div className="upload-toolbar-text">
              最多 {maxCount} 张，支持上传、拖拽和粘贴。多图时按 `image` 数组发送。
            </div>
          </div>
          <button type="button" className="glass-button upload-primary-btn" disabled={disabled || (value || []).length >= maxCount} onClick={() => inputRef.current?.click()}>
            添加图片
          </button>
        </div>

        {(value || []).length > 0 ? (
          <div className="multi-upload-grid">
            {(value || []).map((item, index) => (
              <div key={item.id} className="multi-upload-card">
                <img
                  src={item.dataUrl}
                  alt={item.name || `参考图 ${index + 1}`}
                  className="multi-upload-image"
                />
                <div className="multi-upload-meta">
                  <span>图 {index + 1}</span>
                  <span className="multi-upload-name" title={item.name}>{item.name}</span>
                </div>
                <button
                  type="button"
                  className="image-clear-btn"
                  onClick={() => removeImage(item.id)}
                  title="移除图片"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" x2="6" y1="6" y2="18" />
                    <line x1="6" x2="18" y1="6" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="upload-placeholder upload-placeholder-large">
            <div className="upload-icon-shell">
              <div className="upload-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" x2="12" y1="3" y2="15" />
                </svg>
              </div>
            </div>
            <div className="upload-copy">
              <div className="upload-title">上传多张参考图</div>
              <div className="upload-text">适合图生图、多图融合与多参考混合生成。</div>
            </div>
            <div className="upload-actions">
              <button type="button" className="glass-button upload-primary-btn" onClick={() => inputRef.current?.click()}>
                选择多张图片
              </button>
              <span className="upload-chip">Max {maxCount}</span>
              <span className="upload-chip">Drag & Paste</span>
            </div>
            <div className="upload-hint">支持拖拽到此处，或点击后直接粘贴截图。</div>
          </div>
        )}
      </div>
    </div>
  )
}

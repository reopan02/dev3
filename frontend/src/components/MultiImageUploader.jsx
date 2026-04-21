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
        style={{ padding: '16px' }}
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

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            最多 {maxCount} 张，支持上传、拖拽和粘贴。多图时按文档作为 `image` 数组发送。
          </div>
          <button type="button" className="glass-button" disabled={disabled || (value || []).length >= maxCount} onClick={() => inputRef.current?.click()}>
            添加图片
          </button>
        </div>

        {(value || []).length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
            {(value || []).map((item, index) => (
              <div key={item.id} style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                <img
                  src={item.dataUrl}
                  alt={item.name || `参考图 ${index + 1}`}
                  style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block' }}
                />
                <div style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  图 {index + 1}
                </div>
                <button
                  type="button"
                  className="image-clear-btn"
                  onClick={() => removeImage(item.id)}
                  title="移除图片"
                  style={{ position: 'absolute', top: '8px', right: '8px' }}
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
          <div className="upload-placeholder" style={{ minHeight: '180px' }}>
            <div className="upload-text">
              <button type="button" className="upload-btn" onClick={() => inputRef.current?.click()}>
                点击上传多张参考图
              </button>
              <span> 或拖拽到此处</span>
            </div>
            <div className="upload-hint">支持单图图生图、多图融合和多参考图生图</div>
          </div>
        )}
      </div>
    </div>
  )
}

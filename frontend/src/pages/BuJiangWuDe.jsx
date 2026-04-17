import React, { useCallback, useRef, useState } from 'react'
import { getWatermarkApiBase } from '../services/runtimeConfig'

const DEFAULT_PROMPT = 'Remove all watermarks, logos, subtitles, and visible text while preserving the original composition, subject details, lighting, texture, and edges.'

function useDropzone(onFile) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  const readFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => onFile(reader.result)
    reader.readAsDataURL(file)
  }, [onFile])

  const handleDrop = useCallback((event) => {
    event.preventDefault()
    setDragOver(false)
    readFile(event.dataTransfer.files?.[0])
  }, [readFile])

  const handleChange = useCallback((event) => {
    readFile(event.target.files?.[0])
    event.target.value = ''
  }, [readFile])

  return {
    dragOver,
    inputRef,
    dropProps: {
      onDragOver: (event) => {
        event.preventDefault()
        setDragOver(true)
      },
      onDragLeave: () => setDragOver(false),
      onDrop: handleDrop,
    },
    inputProps: {
      ref: inputRef,
      type: 'file',
      accept: 'image/*',
      onChange: handleChange,
      style: { display: 'none' },
    },
    open: () => inputRef.current?.click(),
  }
}

function UploadCard({ image, loading, onFile }) {
  const dropzone = useDropzone(onFile)

  return (
    <div
      {...dropzone.dropProps}
      className={`drop-zone${dropzone.dragOver ? ' drag-over' : ''}`}
      onClick={image ? undefined : dropzone.open}
      style={{
        minHeight: '320px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        cursor: image ? 'default' : 'pointer',
      }}
    >
      <input {...dropzone.inputProps} />
      {loading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(255, 255, 255, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          zIndex: 2,
        }}>
          <div className="loading-spinner" style={{ width: '36px', height: '36px', borderWidth: '2px' }} />
          <div style={{ fontWeight: 500, fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
            Processing
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {'\u9884\u8ba1 30-120 \u79d2'}
          </div>
        </div>
      )}

      {image ? (
        <img
          src={image}
          alt="source"
          style={{ maxWidth: '100%', maxHeight: '420px', objectFit: 'contain', borderRadius: '18px' }}
        />
      ) : (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem', pointerEvents: 'none' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.45, marginBottom: '12px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
          </svg>
          <p style={{ fontSize: '14px', marginBottom: '8px' }}>{'\u70b9\u51fb\u4e0a\u4f20\u6216\u62d6\u62fd\u56fe\u7247\u5230\u6b64\u5904'}</p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{'\u4ec5\u652f\u6301\u5355\u5f20\u56fe\u7247'}</p>
        </div>
      )}
    </div>
  )
}

export default function BuJiangWuDe() {
  const apiBase = getWatermarkApiBase()
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT)
  const [image, setImage] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const canSubmit = Boolean(image) && !loading

  const download = useCallback(() => {
    if (!result) return
    const link = document.createElement('a')
    link.href = result
    link.download = `bujiangwude_${Date.now()}.png`
    link.click()
  }, [result])

  const handleSubmit = useCallback(async () => {
    if (!image) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch(`${apiBase}/task1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: image,
          prompt,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || `HTTP ${response.status}`)
      }

      const data = await response.json()
      setResult(data.result_image_base64)
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setLoading(false)
    }
  }, [apiBase, image, prompt])

  return (
    <main className="page-shell">
      <section className="hero-block" style={{ marginBottom: '24px' }}>
        <p className="hero-kicker">Grok Retouch</p>
        <h1 className="hero-title">{'\u4e0d\u8bb2\u6b66\u5fb7'}</h1>
        <p className="hero-description">
          {'\u5355\u56fe\u8f93\u5165\uff0c\u5355\u6b65\u53bb\u6c34\u5370\u3002\u4fdd\u7559\u57fa\u7840\u63d0\u793a\u8bcd\u548c\u56fe\u7247\u4e0a\u4f20\uff0c\u76f4\u63a5\u8c03\u7528 Grok \u53bb\u9664\u753b\u9762\u4e2d\u7684\u6c34\u5370\u3001\u6587\u5b57\u548c logo\u3002'}
        </p>
      </section>

      <section className="studio-panel" style={{ maxWidth: '980px', margin: '0 auto' }}>
        <div className="panel-heading">
          <div>
            <div className="panel-eyebrow">{'\u6781\u7b80\u6d41\u7a0b'}</div>
            <h2 className="panel-title">{'\u63d0\u793a\u8bcd + \u56fe\u7247'}</h2>
            <p className="panel-description">
              {'\u5982\u679c\u6ca1\u6709\u7279\u6b8a\u9700\u6c42\uff0c\u76f4\u63a5\u4f7f\u7528\u9ed8\u8ba4 prompt \u5373\u53ef\u3002'}
            </p>
          </div>
          <span className="panel-badge">Grok</span>
        </div>

        <div style={{ display: 'grid', gap: '18px', position: 'relative', zIndex: 1 }}>
          <div>
            <label className="image-uploader-label" htmlFor="bujiangwude-prompt">
              {'\u63d0\u793a\u8bcd'}
            </label>
            <textarea
              id="bujiangwude-prompt"
              className="studio-textarea"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={DEFAULT_PROMPT}
            />
          </div>

          <div>
            <div className="image-uploader-label" style={{ marginBottom: '8px' }}>
              {'\u56fe\u7247'}
            </div>
            <UploadCard image={image} loading={loading} onFile={setImage} />
          </div>

          <button className="glass-button primary" onClick={handleSubmit} disabled={!canSubmit} style={{ width: '100%' }}>
            {loading ? '\u6b63\u5728\u53bb\u6c34\u5370...' : '\u5f00\u59cb\u53bb\u6c34\u5370'}
          </button>

          {error && <div className="inline-error">{error}</div>}

          {result && (
            <div
              style={{
                display: 'grid',
                gap: '12px',
                borderTop: '1px dashed var(--border-strong)',
                paddingTop: '18px',
              }}
            >
              <div className="panel-eyebrow">Output</div>
              <img
                src={result}
                alt="result"
                style={{
                  width: '100%',
                  maxHeight: '640px',
                  objectFit: 'contain',
                  borderRadius: '18px',
                  background: 'var(--bg-secondary)',
                }}
              />
              <button className="glass-button" onClick={download}>
                {'\u4e0b\u8f7d\u7ed3\u679c'}
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

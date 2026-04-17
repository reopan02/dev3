import React, { useState, useRef, useCallback } from 'react'
import { ASPECT_RATIO_OPTIONS, QUALITY_OPTIONS } from '../constants/imageOptions'
import { getWatermarkApiBase } from '../services/runtimeConfig'

function useDropzone(onFile) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  const handleDrop = useCallback(async (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => onFile(reader.result)
      reader.readAsDataURL(file)
    }
  }, [onFile])

  const handleChange = useCallback((e) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = () => onFile(reader.result)
      reader.readAsDataURL(file)
    }
    e.target.value = ''
  }, [onFile])

  return {
    dragOver,
    inputRef,
    dropProps: {
      onDragOver: (e) => { e.preventDefault(); setDragOver(true) },
      onDragLeave: () => setDragOver(false),
      onDrop: handleDrop,
    },
    inputProps: { ref: inputRef, type: 'file', accept: 'image/*', onChange: handleChange, style: { display: 'none' } },
    open: () => inputRef.current?.click(),
  }
}

function DropZone({ image, onFile, loading, label }) {
  const dz = useDropzone(onFile)

  return (
    <div
      {...dz.dropProps}
      className={`drop-zone${dz.dragOver ? ' drag-over' : ''}`}
      onClick={image ? undefined : dz.open}
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
      <input {...dz.inputProps} />
      {loading && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(255, 255, 255, 0.88)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', zIndex: 10,
        }}>
          <div className="loading-spinner" style={{ width: '36px', height: '36px', borderWidth: '2px' }} />
          <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase' }}>Processing</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>预计 30-120 秒</div>
        </div>
      )}

      {image ? (
        <img src={image} alt={label} style={{ maxWidth: '100%', maxHeight: '420px', objectFit: 'contain', borderRadius: '18px' }} />
      ) : (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem', pointerEvents: 'none' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.45, marginBottom: '12px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
          </svg>
          <p style={{ fontSize: '14px' }}>{label}</p>
        </div>
      )}
    </div>
  )
}

export default function Watermark() {
  const apiBase = getWatermarkApiBase()
  const [step1Image, setStep1Image] = useState(null)
  const [step1Result, setStep1Result] = useState(null)
  const [step1Loading, setStep1Loading] = useState(false)
  const [step1Error, setStep1Error] = useState(null)

  const [step2Image, setStep2Image] = useState(null)
  const [step2Result, setStep2Result] = useState(null)
  const [step2Loading, setStep2Loading] = useState(false)
  const [step2Error, setStep2Error] = useState(null)
  const [step2AspectRatio, setStep2AspectRatio] = useState('auto')
  const [step2Quality, setStep2Quality] = useState('2K')

  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const download = (dataUrl, name) => {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = name
    a.click()
  }

  const runTask1 = async () => {
    if (!step1Image) return
    setStep1Loading(true)
    setStep1Error(null)
    setStep1Result(null)
    try {
      const res = await fetch(`${apiBase}/task1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: step1Image }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || 'HTTP ' + res.status) }
      const data = await res.json()
      setStep1Result(data.result_image_base64)
      showToast('文字或水印去除成功')
    } catch (e) {
      setStep1Error(e.message)
      showToast(`处理失败: ${e.message}`, 'error')
    } finally {
      setStep1Loading(false)
    }
  }

  const runTask2 = async () => {
    if (!step2Image) return
    setStep2Loading(true)
    setStep2Error(null)
    setStep2Result(null)
    try {
      const res = await fetch(`${apiBase}/task2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: step2Image,
          aspect_ratio: step2AspectRatio,
          quality: step2Quality,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || 'HTTP ' + res.status) }
      const data = await res.json()
      setStep2Result(data.result_image_base64)
      showToast('画面补全完成')
    } catch (e) {
      setStep2Error(e.message)
      showToast(`处理失败: ${e.message}`, 'error')
    } finally {
      setStep2Loading(false)
    }
  }

  const chainToStep2 = () => {
    if (step1Result) {
      setStep2Image(step1Result)
      setStep2Result(null)
      setStep2Error(null)
    }
  }

  return (
    <main className="page-shell">
      <section className="hero-block" style={{ marginBottom: '24px' }}>
        <h1 className="hero-title">水印去除与补全</h1>
      </section>

      <section className="section-grid-2">
        <section className="studio-panel">
          <div className="panel-heading">
            <div>
              <h2 className="panel-title">去除文字 / 水印</h2>
            </div>
            <span className="panel-badge">Grok</span>
          </div>

          <DropZone image={step1Image} onFile={setStep1Image} loading={step1Loading} label="上传图片或拖拽到此处" />

          {step1Image && !step1Loading && (
            <button className="glass-button primary" onClick={runTask1} disabled={step1Loading} style={{ width: '100%', marginTop: '16px' }}>
              去除文字 / 水印
            </button>
          )}

          {step1Error && <div className="inline-error" style={{ marginTop: '14px' }}>{step1Error}</div>}

          {step1Result && (
            <div style={{ borderTop: '1px dashed var(--border-strong)', paddingTop: '16px', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="panel-eyebrow">Output 01</div>
              <img src={step1Result} alt="Step 1 Result" style={{ maxWidth: '100%', borderRadius: '18px', boxShadow: 'var(--shadow-soft)' }} />
              <button className="glass-button" onClick={() => download(step1Result, `watermark_removed_${Date.now()}.png`)}>
                下载结果
              </button>
              <button className="glass-button primary" onClick={chainToStep2}>
                送入第二步补全 →
              </button>
            </div>
          )}
        </section>

        <section className="studio-panel">
          <div className="panel-heading">
            <div>
              <h2 className="panel-title">补全画面</h2>
            </div>
            <span className="panel-badge">Gemini</span>
          </div>

          <DropZone image={step2Image} onFile={setStep2Image} loading={step2Loading} label="上传图片或从左侧导入" />

          <div className="section-grid-2" style={{ gap: '14px', marginTop: '16px' }}>
            <div>
              <label className="r2r-label">图像比例</label>
              <select className="studio-select" value={step2AspectRatio} onChange={e => setStep2AspectRatio(e.target.value)} disabled={step2Loading}>
                {ASPECT_RATIO_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div>
              <label className="r2r-label">清晰度</label>
              <select className="studio-select" value={step2Quality} onChange={e => setStep2Quality(e.target.value)} disabled={step2Loading}>
                {QUALITY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          </div>

          {step2Image && !step2Loading && (
            <button className="glass-button primary" onClick={runTask2} disabled={step2Loading} style={{ width: '100%', marginTop: '16px' }}>
              补全画面
            </button>
          )}

          {step2Error && <div className="inline-error" style={{ marginTop: '14px' }}>{step2Error}</div>}

          {step2Result && (
            <div style={{ borderTop: '1px dashed var(--border-strong)', paddingTop: '16px', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="panel-eyebrow">Output 02</div>
              <img src={step2Result} alt="Step 2 Result" style={{ maxWidth: '100%', borderRadius: '18px', boxShadow: 'var(--shadow-soft)' }} />
              <button className="glass-button" onClick={() => download(step2Result, `expanded_${Date.now()}.png`)}>
                下载最终结果
              </button>
            </div>
          )}
        </section>
      </section>

      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000,
          padding: '12px 18px', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-medium)',
          background: toast.type === 'error' ? '#991b1b' : '#0a0a0a', color: '#ffffff',
          fontSize: '13px', fontWeight: 500,
        }}>
          {toast.msg}
        </div>
      )}
    </main>
  )
}

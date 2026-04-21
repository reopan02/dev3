import React, { useMemo, useState } from 'react'
import GlassCard from '../components/GlassCard'
import ImagePreview from '../components/ImagePreview'
import MultiImageUploader from '../components/MultiImageUploader'
import { generateSeedreamImage } from '../services/api'
import '../styles/seedream.css'

const RESOLUTION_OPTIONS = [
  { value: '2K', label: '2K' },
  { value: '3K', label: '3K' },
]

const OUTPUT_FORMAT_OPTIONS = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
]

const ASPECT_RATIO_OPTIONS = [
  { value: '1:1', label: '1:1' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '3:2', label: '3:2' },
  { value: '2:3', label: '2:3' },
  { value: '21:9', label: '21:9' },
]

const SIZE_MAP = {
  '2K': {
    '1:1': '2048x2048',
    '4:3': '2304x1728',
    '3:4': '1728x2304',
    '16:9': '2848x1600',
    '9:16': '1600x2848',
    '3:2': '2496x1664',
    '2:3': '1664x2496',
    '21:9': '3136x1344',
  },
  '3K': {
    '1:1': '3072x3072',
    '4:3': '3456x2592',
    '3:4': '2592x3456',
    '16:9': '4096x2304',
    '9:16': '2304x4096',
    '3:2': '3744x2496',
    '2:3': '2496x3744',
    '21:9': '4704x2016',
  },
}

export default function Seedream() {
  const [prompt, setPrompt] = useState('')
  const [images, setImages] = useState([])
  const [resolution, setResolution] = useState('2K')
  const [aspectRatio, setAspectRatio] = useState('3:4')
  const [outputFormat, setOutputFormat] = useState('png')
  const [watermark, setWatermark] = useState(false)
  const [loading, setLoading] = useState(false)
  const [concurrency, setConcurrency] = useState(1)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [generatedImages, setGeneratedImages] = useState([])
  const [error, setError] = useState('')

  const effectiveSize = useMemo(() => SIZE_MAP[resolution]?.[aspectRatio] || resolution, [aspectRatio, resolution])

  const canSubmit = prompt.trim().length > 0 && !loading

  const handleSubmit = async () => {
    if (!canSubmit) return

    setLoading(true)
    setError('')
    setGeneratedImages([])
    setProgress({ done: 0, total: Math.max(1, Number(concurrency) || 1) })

    try {
      const count = Math.max(1, Number(concurrency) || 1)
      let doneCount = 0
      const imagePayload = images.length === 0 ? null : images.length === 1 ? images[0].dataUrl : images.map((item) => item.dataUrl)
      const tasks = Array.from({ length: count }, () =>
        generateSeedreamImage({
          prompt: prompt.trim(),
          image: imagePayload,
          size: effectiveSize,
          outputFormat,
          watermark,
        }).then((result) => {
          doneCount += 1
          setProgress({ done: doneCount, total: count })
          return result.generated_image
        })
      )

      const results = await Promise.all(tasks)
      setGeneratedImages(results)
    } catch (submitError) {
      setError(submitError.message || '生成失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = (generatedImage, index = 0) => {
    if (!generatedImage) return
    const link = document.createElement('a')
    link.href = generatedImage
    link.download = `seedream_${Date.now()}_${index + 1}.${outputFormat === 'jpeg' ? 'jpg' : 'png'}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <main className="page-shell seedream-page">
      <section className="hero-block" style={{ marginBottom: '24px' }}>
        <p className="hero-kicker">Seedream</p>
        <h1 className="hero-title">Doubao Seedream 5.0</h1>
        <p className="hero-description">文生图、多图参考、并发输出。</p>
      </section>

      <section className="seedream-layout">
        <GlassCard
          title="Generate"
          eyebrow="Workspace"
          description="模型固定为 doubao-seedream-5-0-260128。"
          badge="5.0"
          className="seedream-panel"
        >
          <div className="seedream-compact">
            <div className="seedream-field">
              <label className="seedream-label">Prompt</label>
              <textarea
                className="prompt-editor"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                disabled={loading}
                placeholder="描述你要生成的画面。"
              />
            </div>

            <MultiImageUploader label="参考图（可选，最多 4 张）" value={images} onChange={setImages} disabled={loading} />

            <div className="seedream-toolbar">
              <div className="seedream-field">
                <label className="seedream-label">Scale</label>
                <select className="studio-select" value={resolution} onChange={(event) => setResolution(event.target.value)} disabled={loading}>
                  {RESOLUTION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="seedream-field">
                <label className="seedream-label">Ratio</label>
                <select className="studio-select" value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value)} disabled={loading}>
                  {ASPECT_RATIO_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="seedream-field">
                <label className="seedream-label">Format</label>
                <select className="studio-select" value={outputFormat} onChange={(event) => setOutputFormat(event.target.value)} disabled={loading}>
                  {OUTPUT_FORMAT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="seedream-note">
              <span>Output size</span>
              <span className="seedream-size">{effectiveSize}</span>
            </div>

            <div className="seedream-meta">
              <div className="seedream-field">
                <label className="seedream-label">Copies</label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={concurrency}
                  onChange={(event) => setConcurrency(Math.min(8, Math.max(1, Number(event.target.value) || 1)))}
                  disabled={loading}
                  className="studio-select"
                  style={{ width: '88px' }}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-primary)', paddingTop: '20px' }}>
                <input
                  type="checkbox"
                  checked={watermark}
                  onChange={(event) => setWatermark(event.target.checked)}
                  disabled={loading}
                />
                Watermark
              </label>
            </div>

            <div className="seedream-actions">
              <button className="glass-button primary" onClick={handleSubmit} disabled={!canSubmit} style={{ minWidth: '168px' }}>
                {loading ? <><span className="loading-spinner" />{progress.done}/{progress.total}</> : 'Generate'}
              </button>
            </div>

            {error && <div className="inline-error">{error}</div>}
          </div>
        </GlassCard>

        <GlassCard
          title="Result"
          eyebrow="Output"
          description=""
          className="seedream-panel seedream-result-card"
        >
          {generatedImages.length > 1 ? (
            <div className="r2r-results-grid">
              {generatedImages.map((item, index) => (
                <div key={`${index}-${item.slice(0, 24)}`} className="r2r-result-item">
                  <div className="r2r-result-image-wrapper">
                    <img
                      src={item}
                      alt={`结果 ${index + 1}`}
                      className="r2r-result-image"
                    />
                  </div>
                  <button className="glass-button" onClick={() => handleDownload(item, index)} style={{ width: '100%' }}>
                    下载第 {index + 1} 张
                  </button>
                </div>
              ))}
            </div>
          ) : (
            generatedImages[0] || loading ? (
              <ImagePreview
                image={generatedImages[0] || null}
                loading={loading}
                placeholder="结果将显示在这里"
              />
            ) : (
              <div className="seedream-empty">
                <div>
                  <strong>Ready</strong>
                  <span>输入提示词后开始生成。</span>
                </div>
              </div>
            )
          )}

          {generatedImages.length === 1 && (
            <button className="glass-button" onClick={() => handleDownload(generatedImages[0], 0)} style={{ width: '100%', marginTop: '16px' }}>
              下载图片
            </button>
          )}
        </GlassCard>
      </section>
    </main>
  )
}

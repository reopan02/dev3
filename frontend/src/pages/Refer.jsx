import React, { useState, useEffect } from 'react'
import ImageUploader from '../components/ImageUploader'
import { ASPECT_RATIO_OPTIONS, QUALITY_OPTIONS } from '../constants/imageOptions'
import { getReferApiBase } from '../services/runtimeConfig'
import '../styles/refer.css'

const DEFAULT_REFER_CONFIG = {
  model: 'gemini-3-pro-image-preview',
  recognize_model: 'gemini-3.1-flash-lite-preview',
  aspect_ratio: '1:1',
  quality: '1K',
  concurrency: 1,
}

const SENSITIVE_CONFIG_HINTS = [
  'api_key',
  'apikey',
  'base_url',
  '.env',
  'refer_',
  'gemini_',
  'grok_',
  '未配置',
  'not configured',
]

function toUserFacingErrorMessage(detail) {
  if (!detail) return '请求失败，请稍后重试。'

  const normalizedDetail = String(detail).toLowerCase()
  if (SENSITIVE_CONFIG_HINTS.some(token => normalizedDetail.includes(token))) {
    return '后端服务当前不可用，请检查服务端配置。'
  }

  return detail
}

export default function Refer() {
  const apiBase = getReferApiBase()
  const [referConfig, setReferConfig] = useState(DEFAULT_REFER_CONFIG)
  const [selectedAspectRatio, setSelectedAspectRatio] = useState(DEFAULT_REFER_CONFIG.aspect_ratio)
  const [selectedQuality, setSelectedQuality] = useState(DEFAULT_REFER_CONFIG.quality)
  const [userConcurrency, setUserConcurrency] = useState(null)
  const [backendReady, setBackendReady] = useState(false)
  const [configErrors, setConfigErrors] = useState([])
  const [configLoadError, setConfigLoadError] = useState('')
  const [targetImage, setTargetImage] = useState(null)
  const [referImage, setReferImage] = useState(null)
  const [resultImages, setResultImages] = useState([])
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState('')
  const aspectRatioValues = ASPECT_RATIO_OPTIONS.filter(option => option.value !== 'auto').map(option => option.value)
  const qualityValues = QUALITY_OPTIONS.map(option => option.value)

  useEffect(() => {
    fetch(`${apiBase}/models`)
      .then(r => r.json())
      .then(data => {
        const config = { ...DEFAULT_REFER_CONFIG, ...(data.config || {}) }
        const nextAspectRatio = aspectRatioValues.includes(config.aspect_ratio) ? config.aspect_ratio : DEFAULT_REFER_CONFIG.aspect_ratio
        const nextQuality = qualityValues.includes(config.quality) ? config.quality : DEFAULT_REFER_CONFIG.quality
        setReferConfig(config)
        setSelectedAspectRatio(nextAspectRatio)
        setSelectedQuality(nextQuality)
        setBackendReady(
          Boolean(data.base_url_configured)
          && Boolean(data.image_api_key_configured)
          && Boolean(data.recognize_api_key_configured)
        )
        setConfigErrors(data.config_errors || [])
        setConfigLoadError('')
      })
      .catch(() => {
        setReferConfig(DEFAULT_REFER_CONFIG)
        setSelectedAspectRatio(DEFAULT_REFER_CONFIG.aspect_ratio)
        setSelectedQuality(DEFAULT_REFER_CONFIG.quality)
        setBackendReady(false)
        setConfigErrors([])
        setConfigLoadError('无法连接后端服务，请检查后端是否已启动。')
      })
  }, [apiBase])

  const handleSubmit = async () => {
    if (!targetImage || !referImage) return setError('请上传目标图和参考图')

    const count = Math.max(1, Number(userConcurrency ?? referConfig.concurrency) || 1)
    setLoading(true)
    setError('')
    setResultImages([])
    setProgress({ done: 0, total: count })

    const payload = {
      target_image: targetImage,
      refer_image: referImage,
      aspect_ratio: selectedAspectRatio,
      quality: selectedQuality,
    }

    const runOne = async () => {
      const res = await fetch(`${apiBase}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(toUserFacingErrorMessage(err.detail))
      }
      const data = await res.json()
      if (!data.image) throw new Error('模型未返回图像结果')
      return data.image
    }

    let doneCount = 0
    const promises = Array.from({ length: count }, () =>
      runOne().then(img => {
        doneCount++
        setProgress(p => ({ ...p, done: doneCount }))
        setResultImages(prev => [...prev, img])
        return img
      }).catch(err => {
        doneCount++
        setProgress(p => ({ ...p, done: doneCount }))
        return err
      })
    )

    const results = await Promise.all(promises)
    const successes = results.filter(r => typeof r === 'string')
    const failures = results.filter(r => r instanceof Error)
    if (!successes.length) setError(failures[0]?.message || '全部生成任务失败')
    else if (failures.length) setError(`部分成功：${successes.length}/${count} 张已生成`)
    setLoading(false)
  }

  const handleDownload = (image, index) => {
    const link = document.createElement('a')
    link.href = image
    link.download = `refer2result_${Date.now()}_${index + 1}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleDownloadAll = () => resultImages.forEach((img, i) => handleDownload(img, i))
  const serviceReady = backendReady && configErrors.length === 0 && !configLoadError
  const canSubmit = !loading && targetImage && referImage && serviceReady

  return (
    <main className="page-shell">
      <section className="hero-block" style={{ marginBottom: '24px' }}>
        <h1 className="hero-title">风格迁移</h1>
      </section>

      <section className="r2r-studio-layout">
        <aside className="studio-panel r2r-settings-panel">
          <div className="panel-heading">
            <div>
              <h2 className="panel-title">生成设置</h2>
            </div>
          </div>

          <div className="r2r-settings-section">
            <div className="r2r-config-list">
              <div className="r2r-config-item">
                <label className="r2r-label">图像比例</label>
                <select className="studio-select" value={selectedAspectRatio} onChange={e => setSelectedAspectRatio(e.target.value)} disabled={loading}>
                  {ASPECT_RATIO_OPTIONS.filter(option => option.value !== 'auto').map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div className="r2r-config-item">
                <label className="r2r-label">清晰度</label>
                <select className="studio-select" value={selectedQuality} onChange={e => setSelectedQuality(e.target.value)} disabled={loading}>
                  {QUALITY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div className="r2r-config-item">
                <label className="r2r-label">并发数量</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={userConcurrency ?? referConfig.concurrency}
                    onChange={e => setUserConcurrency(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
                    disabled={loading}
                    className="studio-select"
                    style={{ width: '72px' }}
                  />
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>张</span>
                </div>
              </div>
            </div>

            {configLoadError && (
              <div className="inline-error" style={{ marginTop: '14px' }}>{configLoadError}</div>
            )}
            {configErrors.length > 0 && (
              <div className="inline-error" style={{ marginTop: '14px' }}>
                服务端当前不可用，请检查后端配置后重试。
              </div>
            )}
            {!serviceReady && !configLoadError && configErrors.length === 0 && (
              <div className="inline-warning" style={{ marginTop: '14px' }}>
                服务端尚未就绪，暂时无法发起风格迁移。
              </div>
            )}
          </div>
        </aside>

        <div className="r2r-main-panel">
          <section className="studio-panel" style={{ marginBottom: '22px' }}>
            <div className="panel-heading">
              <div>
                <h2 className="panel-title">上传素材</h2>
              </div>
            </div>

            <div className="section-grid-2">
              <ImageUploader label="目标图 (Target)" value={targetImage} onChange={setTargetImage} />
              <ImageUploader label="参考图 (Reference)" value={referImage} onChange={setReferImage} />
            </div>
          </section>

          <section className="studio-panel" style={{ marginBottom: '22px' }}>
            <div className="panel-heading">
              <div>
                <h2 className="panel-title">开始风格迁移</h2>
              </div>
            </div>

            <button className="glass-button primary" onClick={handleSubmit} disabled={!canSubmit} style={{ width: '100%' }}>
              {loading ? <><span className="loading-spinner" />生成中 {progress.done}/{progress.total}</> : '开始风格迁移'}
            </button>

            {error && !error.startsWith('部分成功') && (
              <div className="inline-error" style={{ marginTop: '14px' }}>{error}</div>
            )}
          </section>

          {(resultImages.length > 0 || (loading && progress.total > 0)) && (
            <section className="studio-panel">
              <div className="panel-heading">
                <div>
                  <h2 className="panel-title">生成结果</h2>
                </div>
              </div>

              <div className="r2r-results-grid">
                {resultImages.map((img, idx) => (
                  <div key={`${idx}-${img.slice(0, 32)}`} className="r2r-result-item">
                    <div className="r2r-result-image-wrapper">
                      <img src={img} alt={`结果 ${idx + 1}`} className="r2r-result-image" />
                    </div>
                    <button type="button" className="glass-button" onClick={() => handleDownload(img, idx)} style={{ width: '100%' }}>
                      下载第 {idx + 1} 张
                    </button>
                  </div>
                ))}
                {loading && Array.from({ length: progress.total - resultImages.length }, (_, i) => (
                  <div key={`pending-${i}`} className="r2r-result-item r2r-result-item-pending">
                    <div className="r2r-result-placeholder"><span className="loading-spinner r2r-spinner-lg" /><span>生成中...</span></div>
                  </div>
                ))}
              </div>

              {resultImages.length > 1 && !loading && (
                <div style={{ marginTop: '18px' }}>
                  <button type="button" className="glass-button primary" onClick={handleDownloadAll}>
                    下载全部结果
                  </button>
                </div>
              )}

              {error.startsWith('部分成功') && <div className="inline-warning" style={{ marginTop: '14px' }}>{error}</div>}
            </section>
          )}
        </div>
      </section>
    </main>
  )
}

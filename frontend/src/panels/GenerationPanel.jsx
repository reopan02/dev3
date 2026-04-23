import React, { useState, useEffect, useRef } from 'react'
import GlassCard from '../components/GlassCard'
import MultiImageUploader from '../components/MultiImageUploader'
import ImagePreview from '../components/ImagePreview'
import { ASPECT_RATIO_OPTIONS, QUALITY_OPTIONS } from '../constants/imageOptions'
import { generateImage, downloadBase64Image, recognizeProductStream } from '../services/api'

const SEEDREAM_MODELS = new Set(['doubao-seedream-5-0-260128'])
const SEEDREAM_ASPECT_RATIOS = new Set(['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9'])
const SEEDREAM_QUALITY_OPTIONS = [{ value: '2K', label: '2K' }, { value: '3K', label: '3K' }]

const GPT2_ASPECT_RATIOS = new Set(['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3'])
const GPT2_QUALITY_OPTIONS = [
  { value: '1K', label: '标准 (1024px)' },
  { value: '2K', label: '2K (2048px)' },
  { value: '4K', label: '4K (3840px)' },
]

const GenerationPanel = ({ prompt, tabData, onUpdateTab, onProductInfoRecognized }) => {
  const [localPrompt, setLocalPrompt] = useState(tabData.prompt || '')
  const [recognizing, setRecognizing] = useState(false)
  const [recognizeError, setRecognizeError] = useState(null)
  const [textOnlyMode, setTextOnlyMode] = useState(false)
  const [concurrency, setConcurrency] = useState(1)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const abortControllerRef = useRef(null)

  const isSeedreamModel = SEEDREAM_MODELS.has(tabData.model)
  const isGpt2Model = tabData.model === 'gpt-image-2'
  const isNonGemini = isSeedreamModel || isGpt2Model

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  useEffect(() => {
    if (prompt) {
      setLocalPrompt(prompt)
      onUpdateTab({ prompt })
    }
  }, [prompt])

  useEffect(() => {
    const updates = {}
    if (isSeedreamModel) {
      if (!SEEDREAM_ASPECT_RATIOS.has(tabData.aspectRatio)) updates.aspectRatio = '3:4'
      if (tabData.imageSize !== '2K' && tabData.imageSize !== '3K') updates.imageSize = '2K'
    } else if (isGpt2Model) {
      if (!GPT2_ASPECT_RATIOS.has(tabData.aspectRatio)) updates.aspectRatio = '3:4'
      if (!['1K', '2K', '4K'].includes(tabData.imageSize)) updates.imageSize = '1K'
    }
    if (Object.keys(updates).length > 0) onUpdateTab(updates)
  }, [tabData.model])

  const handleImagesChange = (newImages) => {
    onUpdateTab({ targetImages: newImages, error: null })
  }

  const handleGenerate = async () => {
    if (!localPrompt || localPrompt.trim().length === 0) {
      onUpdateTab({ error: '请输入生成提示词' })
      return
    }

    const count = Math.max(1, Number(concurrency) || 1)
    setProgress({ done: 0, total: count })
    onUpdateTab({
      status: 'generating',
      error: null,
      generatedImage: null,
      generatedImages: null,
    })

    const targetImages = textOnlyMode ? [] : (tabData.targetImages || []).map(item => item.dataUrl)

    const runOne = () => generateImage(
      targetImages,
      localPrompt,
      tabData.aspectRatio,
      tabData.imageSize,
      tabData.model,
    )

    try {
      if (count === 1) {
        const result = await runOne()
        setProgress({ done: 1, total: 1 })
        onUpdateTab({ generatedImage: result.generated_image, generatedImages: null, status: 'complete' })
      } else {
        let doneCount = 0
        const promises = Array.from({ length: count }, () =>
          runOne().then(r => {
            doneCount++
            setProgress(p => ({ ...p, done: doneCount }))
            return r.generated_image
          })
        )
        const images = await Promise.all(promises)
        onUpdateTab({ generatedImages: images, generatedImage: images[0], status: 'complete' })
      }
    } catch (err) {
      onUpdateTab({ error: err.message, status: 'error' })
    }
  }

  const handleDownload = () => {
    if (tabData.generatedImage) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      downloadBase64Image(tabData.generatedImage, `generated-${timestamp}.png`)
    }
  }

  const handleRecognize = async () => {
    const images = tabData.targetImages || []
    if (images.length === 0) {
      setRecognizeError('请先上传目标角色图片')
      return
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    setRecognizing(true)
    setRecognizeError(null)

    let accumulated = ''
    await recognizeProductStream(
      images[0].dataUrl,
      (chunk) => { accumulated += chunk },
      () => {
        if (onProductInfoRecognized) onProductInfoRecognized(accumulated)
        setRecognizing(false)
      },
      (err) => {
        setRecognizeError(err.message || '识别失败')
        setRecognizing(false)
      },
      abortControllerRef.current.signal,
    )
  }

  const isGenerating = tabData.status === 'generating'
  const targetImages = tabData.targetImages || []

  const aspectRatioOptions = isSeedreamModel
    ? ASPECT_RATIO_OPTIONS.filter(o => SEEDREAM_ASPECT_RATIOS.has(o.value))
    : isGpt2Model
      ? ASPECT_RATIO_OPTIONS.filter(o => GPT2_ASPECT_RATIOS.has(o.value))
      : ASPECT_RATIO_OPTIONS

  const qualityOptions = isSeedreamModel
    ? SEEDREAM_QUALITY_OPTIONS
    : isGpt2Model
      ? GPT2_QUALITY_OPTIONS
      : QUALITY_OPTIONS

  const maxImages = isGpt2Model ? 16 : 4

  return (
    <GlassCard
      title="卡片生成"
      eyebrow="Generation"
      description="当前标签内独立设置模型、比例与分辨率，便于快速迭代不同版本。"
      badge={tabData.label}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '16px', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>文生图模式</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {textOnlyMode ? '当前仅使用提示词生成，不读取参考图。' : '当前会结合参考图与提示词共同生成。'}
          </div>
        </div>
        <button
          type="button"
          className="glass-button"
          onClick={() => !isGenerating && setTextOnlyMode(!textOnlyMode)}
          disabled={isGenerating}
          style={{ minWidth: '108px' }}
        >
          {textOnlyMode ? '已开启' : '未开启'}
        </button>
      </div>

      {!textOnlyMode && (
        <>
          <MultiImageUploader
            label={`参考图（可选，最多 ${maxImages} 张）`}
            value={targetImages}
            onChange={handleImagesChange}
            maxCount={maxImages}
            disabled={isGenerating}
          />

          {targetImages.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <button className="glass-button" onClick={handleRecognize} disabled={recognizing || isGenerating} style={{ width: '100%' }}>
                {recognizing ? <><span className="loading-spinner" />识别中...</> : '识别角色信息到左侧输入框'}
              </button>
              {recognizeError && <div className="inline-error" style={{ marginTop: '10px' }}>{recognizeError}</div>}
            </div>
          )}
        </>
      )}

      <div className="section-grid-3" style={{ marginTop: '16px' }}>
        <div>
          <label className="r2r-label">生成模型</label>
          <select className="studio-select" value={tabData.model || 'gemini-3-pro-image-preview'} onChange={(e) => onUpdateTab({ model: e.target.value })} disabled={isGenerating}>
            <option value="gemini-3-pro-image-preview">Gemini 3 Pro</option>
            <option value="gemini-3.1-flash-image-preview">Gemini 3.1 Flash</option>
            <option value="doubao-seedream-5-0-260128">Seedream 5.0</option>
            <option value="gpt-image-2">GPT Image 2</option>
          </select>
        </div>
        <div>
          <label className="r2r-label">宽高比</label>
          <select className="studio-select" value={tabData.aspectRatio} onChange={(e) => onUpdateTab({ aspectRatio: e.target.value })} disabled={isGenerating}>
            {aspectRatioOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div>
          <label className="r2r-label">清晰度</label>
          <select className="studio-select" value={tabData.imageSize} onChange={(e) => onUpdateTab({ imageSize: e.target.value })} disabled={isGenerating}>
            {qualityOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginTop: '12px' }}>
        <label className="r2r-label">并发数量</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
          <input
            type="number"
            min={1}
            max={10}
            value={concurrency}
            onChange={e => setConcurrency(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
            disabled={isGenerating}
            className="studio-select"
            style={{ width: '80px' }}
          />
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {concurrency > 1 ? `同时生成 ${concurrency} 张` : '单张生成'}
          </span>
        </div>
      </div>

      <div style={{ marginTop: '16px' }}>
        <div className="panel-eyebrow" style={{ marginBottom: '10px' }}>Prompt</div>
        <textarea
          className="prompt-editor"
          value={localPrompt}
          onChange={(e) => setLocalPrompt(e.target.value)}
          disabled={isGenerating}
          placeholder="输入或粘贴生成提示词，也可从左侧分析参考卡后自动得到。"
          style={{ minHeight: '160px' }}
        />
        <div style={{ textAlign: 'right', fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
          {localPrompt.length} 字符
        </div>
      </div>

      <button className="glass-button primary" onClick={handleGenerate} disabled={!localPrompt || isGenerating} style={{ width: '100%', marginTop: '16px' }}>
        {isGenerating
          ? <><span className="loading-spinner" />{progress.total > 1 ? `生成中 ${progress.done}/${progress.total}` : '生成中...'}</>
          : concurrency > 1 ? `生成 ${concurrency} 张` : '生成图片'}
      </button>

      {tabData.error && <div className="inline-error" style={{ marginTop: '16px' }}>{tabData.error}</div>}

      {tabData.generatedImages && tabData.generatedImages.length > 1 ? (
        <div style={{ marginTop: '16px' }}>
          <div className="r2r-results-grid">
            {tabData.generatedImages.map((img, idx) => (
              <div key={idx} className="r2r-result-item">
                <div className="r2r-result-image-wrapper">
                  <img src={`data:image/png;base64,${img}`} alt={`结果 ${idx + 1}`} className="r2r-result-image" />
                </div>
                <button className="glass-button" onClick={() => downloadBase64Image(img, `generated-${Date.now()}-${idx + 1}.png`)} style={{ width: '100%' }}>
                  下载第 {idx + 1} 张
                </button>
              </div>
            ))}
          </div>
          <button className="glass-button" onClick={handleDownload} style={{ width: '100%', marginTop: '12px' }}>
            下载第 1 张
          </button>
        </div>
      ) : (
        <div style={{ marginTop: '16px' }}>
          <ImagePreview image={tabData.generatedImage ? `data:image/png;base64,${tabData.generatedImage}` : null} loading={isGenerating} placeholder="生成结果将显示在这里" />
        </div>
      )}

      {tabData.generatedImage && !(tabData.generatedImages && tabData.generatedImages.length > 1) && (
        <button className="glass-button" onClick={handleDownload} style={{ width: '100%', marginTop: '16px' }}>
          下载图片
        </button>
      )}
    </GlassCard>
  )
}

export default GenerationPanel

import React, { useState, useRef, useEffect } from 'react'
import GlassCard from '../components/GlassCard'
import ImageUpload from '../components/ImageUpload'
import ImagePreview from '../components/ImagePreview'
import PromptEditor from '../components/PromptEditor'
import ProductInfoInput from '../components/ProductInfoInput'
import { fileToBase64, analyzeImageStream } from '../services/api'

const CompetitorPanel = ({ onPromptGenerated, onFusedPromptGenerated, productInfo, onProductInfoChange }) => {
  const [competitorImage, setCompetitorImage] = useState(null)
  const [competitorImagePreview, setCompetitorImagePreview] = useState(null)
  const [prompt, setPrompt] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState(null)
  const abortControllerRef = useRef(null)

  useEffect(() => {
    return () => { if (abortControllerRef.current) abortControllerRef.current.abort() }
  }, [])

  const handleImageSelect = async (file) => {
    try {
      setError(null)
      if (competitorImagePreview) URL.revokeObjectURL(competitorImagePreview)
      setCompetitorImagePreview(URL.createObjectURL(file))
      setCompetitorImage(await fileToBase64(file))
    } catch (err) {
      setError('图片加载失败')
    }
  }

  const handleAnalyze = async () => {
    if (!competitorImage) {
      setError('请先上传参考卡片图片')
      return
    }
    if (abortControllerRef.current) abortControllerRef.current.abort()
    abortControllerRef.current = new AbortController()
    setAnalyzing(true)
    setError(null)
    setPrompt('')
    let accumulated = ''
    await analyzeImageStream(
      competitorImage,
      (chunk) => { accumulated += chunk; setPrompt(accumulated) },
      () => { onPromptGenerated(accumulated); setAnalyzing(false) },
      (err) => { setError(err.message || '分析失败'); setAnalyzing(false) },
      abortControllerRef.current.signal
    )
  }

  const handlePromptChange = (newPrompt) => {
    setPrompt(newPrompt)
    onPromptGenerated(newPrompt)
  }

  return (
    <GlassCard
      title="参考卡片分析"
      style={{ position: 'sticky', top: '76px', alignSelf: 'start' }}
      eyebrow="Analysis"
      description="先提取卡面视觉特征，再把目标角色信息融合进最终生成提示词。"
      badge="Step 01"
    >
      <ImageUpload onImageSelect={handleImageSelect} disabled={analyzing} />

      <div style={{ marginTop: '16px' }}>
        <ImagePreview image={competitorImagePreview} loading={false} placeholder="上传参考卡片后显示" />
      </div>

      <button className="glass-button primary" onClick={handleAnalyze} disabled={!competitorImage || analyzing} style={{ width: '100%', marginTop: '16px' }}>
        {analyzing ? <><span className="loading-spinner" />分析中...</> : '分析卡面风格'}
      </button>

      {error && <div className="inline-error" style={{ marginTop: '16px' }}>{error}</div>}

      <PromptEditor value={prompt} onChange={handlePromptChange} disabled={analyzing} placeholder="分析后的卡面风格描述将显示在这里，可继续编辑优化。" />
      <ProductInfoInput analysisResult={prompt} onFusedPromptGenerated={onFusedPromptGenerated} productInfo={productInfo} onProductInfoChange={onProductInfoChange} />
    </GlassCard>
  )
}

export default CompetitorPanel

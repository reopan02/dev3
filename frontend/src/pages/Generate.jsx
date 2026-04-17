import React, { useState } from 'react'
import CompetitorPanel from '../panels/CompetitorPanel'
import GenerationTabContainer from '../components/GenerationTabContainer'

export default function Generate() {
  const [prompt, setPrompt] = useState('')
  const [productInfo, setProductInfo] = useState('')

  return (
    <main className="page-shell">
      <section className="hero-block" style={{ marginBottom: '24px' }}>
        <h1 className="hero-title">卡片生成</h1>
      </section>

      <section className="section-grid-2" style={{ alignItems: 'start' }}>
        <CompetitorPanel
          onPromptGenerated={() => {}}
          onFusedPromptGenerated={setPrompt}
          productInfo={productInfo}
          onProductInfoChange={setProductInfo}
        />
        <GenerationTabContainer
          prompt={prompt}
          onProductInfoRecognized={setProductInfo}
        />
      </section>
    </main>
  )
}

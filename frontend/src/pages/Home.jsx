import React from 'react'
import { Link } from 'react-router-dom'

const TOOLS = [
  {
    path: '/generate',
    title: '动漫卡片生成器',
    desc: '参考卡拆解后，直接生成角色卡面。支持 Gemini、Seedream 5.0、GPT Image 2 多模型可选。',
    tag: '01',
    highlight: '角色融合',
    meta: '拆解 / 生成',
  },
  {
    path: '/refer',
    title: '风格迁移',
    desc: '按参考画风重绘，同时保留角色特征。',
    tag: '02',
    highlight: '风格重绘',
    meta: '识别 / 对齐',
  },
  {
    path: '/watermark',
    title: '水印去除与补全',
    desc: '去除水印并补全缺失画面。',
    tag: '03',
    highlight: '画面修复',
    meta: '清理 / 补画',
  },
  {
    path: '/bujiangwude',
    title: '不讲武德',
    desc: '仅保留 prompt 和图片上传，直接调用 Grok 做单步去水印。',
    tag: '04',
    highlight: '极简去印',
    meta: 'Prompt / Upload',
  },
]

export default function Home() {
  return (
    <main className="page-shell">
      <section className="hero-block">
        <p className="hero-kicker">AI Studio</p>
        <h1 className="hero-title">图像工作台</h1>
        <p className="hero-description">
          提供卡片生成、风格迁移、水印处理等常用工具。
        </p>
      </section>

      <section className="tool-card-grid" style={{ marginBottom: '28px' }}>
        {TOOLS.map((tool) => (
          <Link key={tool.path} to={tool.path} className="tool-card-link">
            <article className="glass-card tool-card">
              <div className="tool-card-topline">
                <span className="tool-card-index">{tool.tag}</span>
                <span className="tool-card-meta">{tool.meta}</span>
              </div>

              <div className="tool-card-body">
                <h2 className="tool-card-title">{tool.title}</h2>
                <p className="tool-card-description">{tool.desc}</p>
              </div>

              <div className="tool-card-footer">
                <div className="tool-card-cta">
                  进入工作区
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </article>
          </Link>
        ))}
      </section>
    </main>
  )
}

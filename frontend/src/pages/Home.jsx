import React from 'react'
import { Link } from 'react-router-dom'

const TOOLS = [
  {
    path: '/generate',
    title: '\u52a8\u6f2b\u5361\u7247\u751f\u6210\u5668',
    desc: '\u53c2\u8003\u5361\u62c6\u89e3\u540e\uff0c\u76f4\u63a5\u751f\u6210\u89d2\u8272\u5361\u9762\u3002',
    tag: '01',
    highlight: '\u89d2\u8272\u878d\u5408',
    meta: '\u62c6\u89e3 / \u751f\u6210',
  },
  {
    path: '/refer',
    title: '\u98ce\u683c\u8fc1\u79fb',
    desc: '\u6309\u53c2\u8003\u753b\u98ce\u91cd\u7ed8\uff0c\u540c\u65f6\u4fdd\u7559\u89d2\u8272\u7279\u5f81\u3002',
    tag: '02',
    highlight: '\u98ce\u683c\u91cd\u7ed8',
    meta: '\u8bc6\u522b / \u5bf9\u9f50',
  },
  {
    path: '/watermark',
    title: '\u6c34\u5370\u53bb\u9664\u4e0e\u8865\u5168',
    desc: '\u53bb\u9664\u6c34\u5370\u5e76\u8865\u5168\u7f3a\u5931\u753b\u9762\u3002',
    tag: '03',
    highlight: '\u753b\u9762\u4fee\u590d',
    meta: '\u6e05\u7406 / \u8865\u753b',
  },
  {
    path: '/bujiangwude',
    title: '\u4e0d\u8bb2\u6b66\u5fb7',
    desc: '\u4ec5\u4fdd\u7559 prompt \u548c\u56fe\u7247\u4e0a\u4f20\uff0c\u76f4\u63a5\u8c03\u7528 Grok \u505a\u5355\u6b65\u53bb\u6c34\u5370\u3002',
    tag: '04',
    highlight: '\u6781\u7b80\u53bb\u5370',
    meta: 'Prompt / Upload',
  },
]

export default function Home() {
  return (
    <main className="page-shell">
      <section className="hero-block">
        <p className="hero-kicker">Image Atelier</p>
        <h1 className="hero-title">AI Studio</h1>
        <p className="hero-description">
          {'\u5361\u7247\u751f\u6210\u3001\u98ce\u683c\u8fc1\u79fb\u4e0e\u56fe\u50cf\u4fee\u590d\u5de5\u4f5c\u53f0\u3002'}
        </p>
      </section>

      <section className="tool-card-grid" style={{ marginBottom: '28px' }}>
        {TOOLS.map((tool) => (
          <Link key={tool.path} to={tool.path} className="tool-card-link">
            <article className="glass-card tool-card">
              <div className="tool-card-topline">
                <span className="tool-card-index">{tool.tag}</span>
                <span className="tool-card-highlight">{tool.highlight}</span>
              </div>

              <div className="tool-card-body">
                <h2 className="tool-card-title">{tool.title}</h2>
                <p className="tool-card-description">{tool.desc}</p>
              </div>

              <div className="tool-card-footer">
                <div className="tool-card-meta">{tool.meta}</div>
                <div className="tool-card-cta">
                  {'\u8fdb\u5165\u5de5\u4f5c\u533a'}
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

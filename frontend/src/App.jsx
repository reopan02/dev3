import React from 'react'
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import Generate from './pages/Generate'
import Home from './pages/Home'
import Refer from './pages/Refer'
import BuJiangWuDe from './pages/BuJiangWuDe'
import Watermark from './pages/Watermark'

const NAV_ITEMS = [
  { path: '/', label: '\u9996\u9875' },
  { path: '/generate', label: '\u5361\u7247\u751f\u6210' },
  { path: '/refer', label: '\u98ce\u683c\u8fc1\u79fb' },
  { path: '/watermark', label: '\u6c34\u5370\u53bb\u9664' },
  { path: '/bujiangwude', label: '\u4e0d\u8bb2\u6b66\u5fb7' },
]

function NavBar() {
  const location = useLocation()

  return (
    <header className="app-nav">
      <Link to="/" className="app-brand">
        <span className="app-brand-mark">AI Studio</span>
        <span className="app-brand-subtitle">Image Atelier</span>
      </Link>

      <nav className="app-nav-links">
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`app-nav-link${active ? ' active' : ''}`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <NavBar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/generate" element={<Generate />} />
          <Route path="/refer" element={<Refer />} />
          <Route path="/watermark" element={<Watermark />} />
          <Route path="/bujiangwude" element={<BuJiangWuDe />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

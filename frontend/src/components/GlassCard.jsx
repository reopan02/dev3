import React from 'react'

const GlassCard = ({ children, title, eyebrow, description, badge, className = '', style = {} }) => {
  return (
    <div className={`glass-card ${className}`.trim()} style={style}>
      {(title || eyebrow || description || badge) && (
        <div className="panel-heading">
          <div>
            {eyebrow && <div className="panel-eyebrow">{eyebrow}</div>}
            {title && <h2 className="panel-title panel-title-large">{title}</h2>}
            {description && <p className="panel-description">{description}</p>}
          </div>
          {badge && <span className="panel-badge">{badge}</span>}
        </div>
      )}
      {children}
    </div>
  )
}

export default GlassCard

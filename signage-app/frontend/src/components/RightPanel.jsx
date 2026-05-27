import React, { useEffect } from 'react'

const PANEL_TITLES = {
  compare: '清单同步',
  'new-project': '新建项目',
  projects: '项目管理',
  settings: '设置',
}

function RightPanel({ open, panelId, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  return (
    <>
      <div
        className={`right-panel-backdrop ${open ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={`right-panel ${open ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        aria-label={PANEL_TITLES[panelId] || '侧滑面板'}
      >
        <header className="right-panel-header">
          <h2 className="right-panel-title">{PANEL_TITLES[panelId] || ''}</h2>
          <button
            type="button"
            className="right-panel-close"
            onClick={onClose}
            aria-label="关闭面板"
          >
            ×
          </button>
        </header>
        <div className="right-panel-body">{open ? children : null}</div>
      </aside>
    </>
  )
}

export default RightPanel

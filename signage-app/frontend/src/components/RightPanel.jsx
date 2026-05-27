import React, { useEffect } from 'react'

const PANEL_TITLES = {
  chat: '聊天',
  dashboard: '项目仪表盘',
  matching: '旧项目匹配',
  compare: '清单对比',
  merge: '合并预览',
  settings: '设置',
  cad: 'CAD辅助',
  'new-project': '新建项目',
  projects: '项目管理',
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

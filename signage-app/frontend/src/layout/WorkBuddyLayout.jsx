import React, { useState, useCallback } from 'react'
import { useColumnResize } from '../hooks/useColumnResize'
import RightPanel from '../components/RightPanel'

function ResizeHandle({ onMouseDown, className = '' }) {
  return (
    <div
      className={`column-resize-handle ${className}`}
      onMouseDown={onMouseDown}
      role="separator"
      aria-orientation="vertical"
      title="拖拽调整宽度"
    />
  )
}

function WorkBuddyLayout({
  leftSidebar,
  centerChat,
  mainContent,
  renderRightToolbar,
  renderSlidePanel,
  viewMode,
  onPanelOpen,
}) {
  const left = useColumnResize('layout-left-width', 260, 200, 400)

  const [activePanel, setActivePanel] = useState(null)

  const handleSlideSelect = useCallback(
    (panelId) => {
      setActivePanel((prev) => {
        const next = prev === panelId ? null : panelId
        if (next && onPanelOpen) {
          onPanelOpen(next)
        }
        return next
      })
    },
    [onPanelOpen]
  )

  const handleClose = useCallback(() => {
    setActivePanel(null)
  }, [])

  return (
    <div className="workbuddy-layout">
      <div className="workbuddy-columns">
        <div className="workbuddy-col-left" style={{ width: left.width, flexShrink: 0 }}>
          {leftSidebar}
        </div>
        <ResizeHandle onMouseDown={left.startDrag} />

        <div className="workbuddy-col-center">
          {viewMode === 'chat' ? centerChat : mainContent}
          <RightPanel open={!!activePanel} panelId={activePanel} onClose={handleClose}>
            {activePanel && renderSlidePanel ? renderSlidePanel(activePanel) : null}
          </RightPanel>
        </div>
      </div>

      {/* 固定定位的工具条 — 硬编码验证容器可见性 */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '50px',
          height: '100vh',
          background: '#1e293b',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '60px 0 8px',
          gap: '8px',
        }}
      >
        {/* 硬编码按钮，不依赖任何 props */}
        <button
          type="button"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: '#3b82f6',
            color: '#fff',
            fontSize: '20px',
            border: 'none',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          💬
        </button>

        {/* 调试：renderRightToolbar 是否传入 */}
        <div
          style={{
            background: '#fbbf24',
            padding: '2px 4px',
            fontSize: '10px',
            color: '#000',
            textAlign: 'center',
            flexShrink: 0,
          }}
        >
          {renderRightToolbar ? 'HAS FUNC' : 'NO FUNC'}
        </div>

        {renderRightToolbar ? renderRightToolbar(handleSlideSelect) : null}
      </div>
    </div>
  )
}

export default WorkBuddyLayout

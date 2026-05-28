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
  const right = useColumnResize('layout-right-width', 180, 150, 300)

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
      {/* === 终极调试：如果看不到这个红色块，说明 React 根本没渲染 === */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          right: 0,
          width: '200px',
          height: '200px',
          background: 'red',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '20px',
          fontWeight: 'bold',
        }}
      >
        DEBUG
      </div>
      {/* === 调试结束 === */}

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

        <ResizeHandle onMouseDown={right.startDragReverse} />

        <div
          className="workbuddy-col-right"
          style={{
            width: right.width,
            flexShrink: 0,
            minWidth: '180px',
            background: '#0f172a',
            border: '2px solid blue',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* 第一层调试：容器本身 */}
          <div style={{ background: '#fbbf24', padding: '4px', fontSize: '10px', flexShrink: 0 }}>
            COL-RIGHT: {right.width}px | hasFunc: {String(!!renderRightToolbar)}
          </div>

          {/* 第二层调试：直接硬编码内容 */}
          <div style={{ background: '#3b82f6', color: '#fff', padding: '10px', flexShrink: 0 }}>
            HARD CODED BUTTON
          </div>

          {/* 第三层：尝试调用 renderRightToolbar */}
          {renderRightToolbar ? (
            <>
              <div style={{ background: '#10b981', padding: '4px', flexShrink: 0 }}>
                CALLING renderRightToolbar...
              </div>
              {renderRightToolbar(handleSlideSelect)}
            </>
          ) : (
            <div style={{ background: '#ef4444', color: '#fff', padding: '10px', flexShrink: 0 }}>
              NO RENDER FUNC!
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default WorkBuddyLayout

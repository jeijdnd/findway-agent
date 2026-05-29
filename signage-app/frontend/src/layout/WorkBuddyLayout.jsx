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

      <div className="workbuddy-fixed-toolbar">
        {renderRightToolbar ? (
          renderRightToolbar(handleSlideSelect)
        ) : (
          <>
            {[
              { id: 'chat', icon: '💬' },
              { id: 'dashboard', icon: '📊' },
              { id: 'matching', icon: '🔍' },
              { id: 'compare', icon: '📋' },
              { id: 'merge', icon: '🔗' },
              { id: 'settings', icon: '⚙️' },
              { id: 'cad', icon: '📐' },
            ].map(({ id, icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleSlideSelect(id)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'transparent',
                  color: '#fff',
                  fontSize: '18px',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                {icon}
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

export default WorkBuddyLayout

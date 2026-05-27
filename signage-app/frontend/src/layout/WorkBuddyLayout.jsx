import React, { useState, useCallback } from 'react'
import { useColumnResize } from '../hooks/useColumnResize'
import RightPanel from '../components/RightPanel'
import Compare from '../pages/Compare'
import Dashboard from '../pages/Dashboard'
import Settings from '../pages/Settings'

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
  rightToolbar,
  viewMode,
  onPanelOpen,
}) {
  const left = useColumnResize('layout-left-width', 260, 200, 400)
  const right = useColumnResize('layout-right-width', 180, 150, 300)

  const [activePanel, setActivePanel] = useState(null)
  const [newProjectNonce, setNewProjectNonce] = useState(0)

  const handleSlideSelect = useCallback(
    (panelId) => {
      setActivePanel(panelId)
      if (panelId === 'new-project') {
        setNewProjectNonce(Date.now())
      }
      if (panelId && onPanelOpen) {
        onPanelOpen(panelId)
      }
    },
    [onPanelOpen]
  )

  const handleClose = useCallback(() => {
    setActivePanel(null)
  }, [])

  const renderPanelContent = () => {
    switch (activePanel) {
      case 'compare':
        return <Compare key="right-panel-compare" />
      case 'new-project':
        return (
          <Dashboard
            key={`right-panel-new-${newProjectNonce}`}
            commandTrigger={{ type: 'new-project', nonce: newProjectNonce }}
          />
        )
      case 'projects':
        return <Dashboard key="right-panel-projects" />
      case 'settings':
        return <Settings key="right-panel-settings" />
      default:
        return null
    }
  }

  const toolbarWithSlide =
    rightToolbar &&
    React.cloneElement(rightToolbar, {
      onSlidePanel: handleSlideSelect,
    })

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
            {renderPanelContent()}
          </RightPanel>
        </div>

        <ResizeHandle onMouseDown={right.startDragReverse} />

        <div className="workbuddy-col-right" style={{ width: right.width, flexShrink: 0 }}>
          {toolbarWithSlide}
        </div>
      </div>
    </div>
  )
}

export default WorkBuddyLayout

import React, { useState, useCallback } from 'react'
import RightSidebar from '../components/RightSidebar'
import RightPanel from '../components/RightPanel'
import Compare from '../pages/Compare'
import Dashboard from '../pages/Dashboard'
import Settings from '../pages/Settings'

function WorkBuddyLayout({ left, main, onPanelOpen }) {
  const [activePanel, setActivePanel] = useState(null)
  const [newProjectNonce, setNewProjectNonce] = useState(0)

  const handleSelect = useCallback(
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

  return (
    <div className="workbuddy-layout">
      <div className="workbuddy-left">{left}</div>
      <div className="workbuddy-main-wrap">
        {main}
        <RightPanel open={!!activePanel} panelId={activePanel} onClose={handleClose}>
          {renderPanelContent()}
        </RightPanel>
      </div>
      <RightSidebar activePanel={activePanel} onSelect={handleSelect} />
    </div>
  )
}

export default WorkBuddyLayout

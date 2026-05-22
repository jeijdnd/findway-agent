import React, { useState } from 'react'
import ChatPanel from './ChatPanel'
import Dashboard from '../pages/Dashboard'
import Matching from '../pages/Matching'
import Compare from '../pages/Compare'
import '../App.css'

function AppLayout() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [refreshKey, setRefreshKey] = useState(0)

  const handleAction = (action, data) => {
    if (action === 'create_project') {
      setActiveTab('dashboard')
      setRefreshKey(prev => prev + 1)
    } else if (action === 'search_old_project') {
      setActiveTab('matching')
      setRefreshKey(prev => prev + 1)
    } else if (action === 'compare_list') {
      setActiveTab('compare')
      setRefreshKey(prev => prev + 1)
    }
  }

  const renderPanel = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard key={refreshKey} />
      case 'matching':
        return <Matching key={refreshKey} />
      case 'compare':
        return <Compare key={refreshKey} />
      case 'settings':
        return <div className="empty-state"><h2>设置</h2><p>功能开发中...</p></div>
      default:
        return <Dashboard key={refreshKey} />
    }
  }

  return (
    <div className="app-layout">
      <div className="chat-panel">
        <div className="chat-header">FindWay Agent</div>
        <ChatPanel onAction={handleAction} />
      </div>
      <div className="main-panel">
        <div className="panel-header">
          <button
            className={`panel-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            项目仪表盘
          </button>
          <button
            className={`panel-tab ${activeTab === 'matching' ? 'active' : ''}`}
            onClick={() => setActiveTab('matching')}
          >
            旧项目匹配
          </button>
          <button
            className={`panel-tab ${activeTab === 'compare' ? 'active' : ''}`}
            onClick={() => setActiveTab('compare')}
          >
            清单对比
          </button>
          <button
            className={`panel-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            设置
          </button>
        </div>
        <div className="panel-content">
          {renderPanel()}
        </div>
        <div className="status-bar">
          <span>API: 已连接</span>
          <span>3个项目待办</span>
        </div>
      </div>
    </div>
  )
}

export default AppLayout
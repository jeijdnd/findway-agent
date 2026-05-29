import React, { useState, useEffect, useCallback } from 'react'
import CommandPalette from './CommandPalette'
import WorkBuddyLayout from '../layout/WorkBuddyLayout'
import LeftSidebar from './LeftSidebar'
import CenterChat from './CenterChat'
import RightToolbar from './RightToolbar'
import Dashboard from '../pages/Dashboard'
import Matching from '../pages/Matching'
import Compare from '../pages/Compare'
import MergePreview from '../pages/MergePreview'
import Settings from '../pages/Settings'
import { chatActionToTrigger } from '../api/dashboardCommands'
import '../App.css'

// CAD辅助面板组件（最小化实现）
function CADPanel() {
  const [filePath, setFilePath] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [cadInfo, setCadInfo] = useState(null)

  const handleReadInfo = async () => {
    if (!filePath.trim()) {
      setError('请输入DWG文件路径')
      return
    }

    try {
      setLoading(true)
      setError(null)
      setCadInfo(null)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      const response = await fetch('/api/cad/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.detail || `HTTP ${response.status}`)
      }

      const data = await response.json()
      setCadInfo(data)
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('请求超时，请检查文件路径是否正确')
      } else {
        setError('读取CAD文件失败: ' + err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="loading">正在读取CAD文件...</div>
  }

  if (error) {
    return (
      <div className="error-state">
        <h2>读取失败</h2>
        <p>{error}</p>
        <button className="btn-primary" onClick={handleReadInfo} style={{ marginTop: '12px' }}>
          重试
        </button>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>CAD辅助</h2>

      <div style={{ background: 'white', padding: '16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: '15px', marginBottom: '12px' }}>DWG文件读取</h3>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input
            type="text"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            placeholder="输入DWG/DXF文件完整路径，例如：C:\\Projects\\drawing.dwg"
            style={{ flex: 1, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px' }}
          />
          <button className="btn-primary" onClick={handleReadInfo}>
            读取信息
          </button>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
          支持DWG/DXF格式，只读不修改原文件
        </p>
      </div>

      {cadInfo && (
        <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '15px', marginBottom: '12px' }}>文件信息</h3>

          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
              文字内容 ({cadInfo.texts.length}个)
            </h4>
            {cadInfo.texts.length > 0 ? (
              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>文字</th>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>图层</th>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>坐标</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cadInfo.texts.map((text, index) => (
                      <tr key={index}>
                        <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{text.text}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{text.layer}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>
                          ({text.x.toFixed(1)}, {text.y.toFixed(1)})
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>未找到文字内容</p>
            )}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
              图块列表 ({cadInfo.blocks.length}种)
            </h4>
            {cadInfo.blocks.length > 0 ? (
              <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>块名</th>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>图层</th>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>数量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cadInfo.blocks.map((block, index) => (
                      <tr key={index}>
                        <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{block.name}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{block.layer}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{block.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>未找到图块引用</p>
            )}
          </div>

          <div>
            <h4 style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
              图层列表 ({cadInfo.layers.length}个)
            </h4>
            {cadInfo.layers.length > 0 ? (
              <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>图层名</th>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cadInfo.layers.map((layer, index) => (
                      <tr key={index}>
                        <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{layer.name}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>
                          {layer.on ? '开启' : '关闭'}
                          {layer.frozen ? ' | 冻结' : ''}
                          {layer.locked ? ' | 锁定' : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>未找到图层信息</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function AppLayout() {
  const [viewMode, setViewMode] = useState('chat')
  const [activeTab, setActiveTab] = useState('dashboard')
  const [refreshKey, setRefreshKey] = useState(0)
  const [chatHistoryList, setChatHistoryList] = useState([])
  const [currentChatId, setCurrentChatId] = useState(null)
  const [newChatSignal, setNewChatSignal] = useState(0)
  const [skillInvokeSignal, setSkillInvokeSignal] = useState({ nonce: 0 })
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [commandTrigger, setCommandTrigger] = useState({ type: null, nonce: 0 })
  const [activePanel, setActivePanel] = useState(null)

  const fetchChatHistoryList = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/history')
      if (!res.ok) return
      const data = await res.json()
      setChatHistoryList(data.chats || [])
    } catch {
      // 忽略
    }
  }, [])

  useEffect(() => {
    fetchChatHistoryList()
  }, [fetchChatHistoryList])

  const handleNewChat = useCallback(() => {
    setCurrentChatId(null)
    setNewChatSignal((n) => n + 1)
    setViewMode('chat')
  }, [])

  const handleToolbarSelect = useCallback((mode, tabId) => {
    setViewMode(mode)
    if (mode === 'tool' && tabId) {
      setActiveTab(tabId)
    }
  }, [])

  const handleSkillInvoke = useCallback((skill) => {
    setViewMode('chat')
    setSkillInvokeSignal({
      nonce: Date.now(),
      name: skill.name,
      displayName: skill.display_name || skill.name,
    })
  }, [])

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(true)
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        handleNewChat()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleNewChat])

  const handleCommand = (commandId) => {
    switch (commandId) {
      case 'scan':
        setViewMode('tool')
        setActiveTab('dashboard')
        setCommandTrigger({ type: 'scan', nonce: Date.now() })
        break
      case 'filter-projects':
        setViewMode('tool')
        setActiveTab('dashboard')
        setCommandTrigger({ type: 'dashboard-filter', nonce: Date.now(), query: '' })
        break
      case 'matching':
        setViewMode('tool')
        setActiveTab('matching')
        setRefreshKey((prev) => prev + 1)
        break
      case 'new-project':
        setViewMode('tool')
        setActiveTab('dashboard')
        setCommandTrigger({ type: 'new-project', nonce: Date.now() })
        break
      case 'settings':
        setViewMode('tool')
        setActiveTab('settings')
        break
      case 'new-chat':
        handleNewChat()
        break
      default:
        break
    }
  }

  const handleAction = (action, data) => {
    const dashTrigger = chatActionToTrigger(action, data)
    if (dashTrigger) {
      setViewMode('tool')
      setActiveTab('dashboard')
      setCommandTrigger(dashTrigger)
    } else if (action === 'search_old_project') {
      setViewMode('tool')
      setActiveTab('matching')
      setRefreshKey((prev) => prev + 1)
    } else if (action === 'compare_list') {
      setViewMode('tool')
      setActiveTab('compare')
      setRefreshKey((prev) => prev + 1)
    } else if (action === 'merge_tuding') {
      setViewMode('tool')
      setActiveTab('merge')
      setRefreshKey((prev) => prev + 1)
    } else if (action === 'open_scan') {
      setViewMode('tool')
      setActiveTab('dashboard')
      setCommandTrigger(chatActionToTrigger('open_scan', data) || {
        type: 'scan',
        nonce: Date.now(),
      })
    }
    if (data?.chat_id) {
      setCurrentChatId(data.chat_id)
    }
  }

  const handleSidebarPanelOpen = useCallback((panelId) => {
    setViewMode('tool')
    const tabMap = {
      compare: 'compare',
      settings: 'settings',
      matching: 'matching',
      merge: 'merge',
      cad: 'cad',
      dashboard: 'dashboard',
      projects: 'dashboard',
      'new-project': 'dashboard',
    }
    if (tabMap[panelId]) setActiveTab(tabMap[panelId])
  }, [])

  const handleSlidePanel = useCallback(
    (panelId) => {
      setActivePanel((prev) => {
        const next = prev === panelId ? null : panelId
        if (next) handleSidebarPanelOpen(next)
        return next
      })
    },
    [handleSidebarPanelOpen]
  )

  const handleClosePanel = useCallback(() => {
    setActivePanel(null)
  }, [])

  const handleDeleteChat = async (e, id) => {
    e.stopPropagation()
    try {
      await fetch(`/api/chat/history/${id}`, { method: 'DELETE' })
      if (currentChatId === id) {
        handleNewChat()
      }
      fetchChatHistoryList()
    } catch {
      // 忽略
    }
  }

  const renderPanel = (keyPrefix = 'main') => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            key={`${keyPrefix}-dashboard-${refreshKey}`}
            commandTrigger={commandTrigger}
          />
        )
      case 'matching':
        return <Matching key={`${keyPrefix}-matching-${refreshKey}`} />
      case 'compare':
        return <Compare key={`${keyPrefix}-compare-${refreshKey}`} />
      case 'merge':
        return <MergePreview key={`${keyPrefix}-merge-${refreshKey}`} />
      case 'settings':
        return <Settings key={`${keyPrefix}-settings-${refreshKey}`} />
      case 'cad':
        return <CADPanel key={`${keyPrefix}-cad-${refreshKey}`} />
      default:
        return (
          <Dashboard
            key={`${keyPrefix}-dashboard-${refreshKey}`}
            commandTrigger={commandTrigger}
          />
        )
    }
  }

  const renderSlidePanel = (panelId) => {
    switch (panelId) {
      case 'dashboard':
        return (
          <Dashboard
            key={`slide-dashboard-${refreshKey}`}
            commandTrigger={commandTrigger}
          />
        )
      case 'matching':
        return <Matching key={`slide-matching-${refreshKey}`} />
      case 'compare':
        return <Compare key={`slide-compare-${refreshKey}`} />
      case 'merge':
        return <MergePreview key={`slide-merge-${refreshKey}`} />
      case 'settings':
        return <Settings key={`slide-settings-${refreshKey}`} />
      case 'cad':
        return <CADPanel key={`slide-cad-${refreshKey}`} />
      default:
        return null
    }
  }

  const tabTitles = {
    dashboard: '项目仪表盘',
    matching: '旧项目匹配',
    compare: '清单对比',
    merge: '合并预览',
    settings: '设置',
    cad: 'CAD辅助',
  }

  const mainPanel = (
    <div className="main-panel">
      <div className="main-panel-title-bar">
        <h2 className="main-panel-title">{tabTitles[activeTab] || '工具'}</h2>
      </div>
      <div className="panel-content">
        {renderPanel('main')}
      </div>
      <div className="status-bar">
        <span>API: 已连接</span>
        <span>Ctrl+K 命令面板</span>
      </div>
    </div>
  )

  return (
    <>
      <WorkBuddyLayout
        leftSidebar={
          <LeftSidebar
            chatHistoryList={chatHistoryList}
            currentChatId={currentChatId}
            onSelectChat={(id) => {
              setCurrentChatId(id)
              setViewMode('chat')
            }}
            onNewChat={handleNewChat}
            onDeleteChat={handleDeleteChat}
            onSkillInvoke={handleSkillInvoke}
          />
        }
        centerChat={
          <CenterChat
            onAction={handleAction}
            chatId={currentChatId}
            onChatIdChange={setCurrentChatId}
            onHistoryChange={fetchChatHistoryList}
            newChatSignal={newChatSignal}
            skillInvokeSignal={skillInvokeSignal}
          />
        }
        mainContent={mainPanel}
        renderSlidePanel={renderSlidePanel}
        viewMode={viewMode}
        activePanel={activePanel}
        onPanelClose={handleClosePanel}
      />
      <RightToolbar
        activeTab={activeTab}
        viewMode={viewMode}
        onSelect={handleToolbarSelect}
        onSlidePanel={handleSlidePanel}
      />
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onExecute={handleCommand}
      />
    </>
  )
}

export default AppLayout

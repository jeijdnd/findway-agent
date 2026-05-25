import React, { useState, useEffect } from 'react'
import ChatPanel from './ChatPanel'
import Dashboard from '../pages/Dashboard'
import Matching from '../pages/Matching'
import Compare from '../pages/Compare'
import MergePreview from '../pages/MergePreview'
import Settings from '../pages/Settings'
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
        signal: controller.signal
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
      
      {/* 文件路径输入 */}
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

      {/* 显示读取结果 */}
      {cadInfo && (
        <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '15px', marginBottom: '12px' }}>文件信息</h3>
          
          {/* 文字信息 */}
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

          {/* 图块信息 */}
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

          {/* 图层信息 */}
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
    } else if (action === 'merge_tuding') {
      setActiveTab('merge')
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
      case 'merge':
        return <MergePreview key={refreshKey} />
      case 'settings':
        return <Settings key={refreshKey} />
      case 'cad':
        return <CADPanel key={refreshKey} />
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
            className={`panel-tab ${activeTab === 'merge' ? 'active' : ''}`}
            onClick={() => setActiveTab('merge')}
          >
            合并预览
          </button>
          <button
            className={`panel-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            设置
          </button>
          <button
            className={`panel-tab ${activeTab === 'cad' ? 'active' : ''}`}
            onClick={() => setActiveTab('cad')}
          >
            CAD辅助
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
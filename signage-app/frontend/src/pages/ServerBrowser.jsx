import React, { useState, useEffect, useCallback } from 'react'
import { fetchLocalServerConfig } from '../api/localServer'
import ServerFileTree from '../components/ServerFileTree'

function ServerBrowser() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [treeError, setTreeError] = useState('')

  const loadConfig = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchLocalServerConfig()
      setConfig(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  if (loading) {
    return <div className="loading">加载配置…</div>
  }

  if (error) {
    return (
      <div className="error-state">
        <p>{error}</p>
        <button type="button" className="btn-primary" onClick={loadConfig}>重试</button>
      </div>
    )
  }

  if (!config?.enabled) {
    return (
      <div className="server-browser-page">
        <h2>本地服务器</h2>
        <div className="empty-state">
          <p>本地服务器功能未启用</p>
          <p className="form-hint">请在「设置 → 常规配置」中启用并配置局域网路径（如 \\192.168.74.246\共享名）</p>
        </div>
      </div>
    )
  }

  if (!config.path) {
    return (
      <div className="server-browser-page">
        <h2>本地服务器</h2>
        <div className="empty-state">
          <p>未配置局域网路径</p>
          <p className="form-hint">请在设置中填写 UNC 路径</p>
        </div>
      </div>
    )
  }

  return (
    <div className="server-browser-page">
      <div className="dashboard-header">
        <div>
          <h2>本地服务器</h2>
          <p className="dashboard-subtitle">浏览局域网共享文件夹</p>
        </div>
        <button type="button" className="btn-secondary" onClick={loadConfig}>
          刷新
        </button>
      </div>

      {treeError && <p className="form-error server-browser-error">{treeError}</p>}

      <ServerFileTree
        key={config.path}
        rootPath={config.path}
        onError={setTreeError}
      />
    </div>
  )
}

export default ServerBrowser

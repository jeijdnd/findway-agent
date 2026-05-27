import React, { useState, useEffect, useCallback } from 'react'

function SettingsLogsPanel() {
  const [logs, setLogs] = useState([])
  const [errors, setErrors] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [summarizeLoading, setSummarizeLoading] = useState(false)
  const [errorDoc, setErrorDoc] = useState('')

  const showMessage = (msg) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), 3000)
  }

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true)
      const q = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''
      const [logsRes, errorsRes] = await Promise.all([
        fetch(`/api/logs${q}`),
        fetch('/api/errors?limit=100'),
      ])
      if (logsRes.ok) {
        const data = await logsRes.json()
        setLogs(data.logs || [])
      }
      if (errorsRes.ok) {
        const data = await errorsRes.json()
        setErrors(data.errors || [])
      }
    } catch (err) {
      showMessage('加载失败: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleExportLogs = () => {
    const q = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''
    window.open(`/api/logs/export${q}`, '_blank')
  }

  const handleClearLogs = async () => {
    if (!confirm('确定清空所有对话日志吗？此操作不可恢复。')) return
    try {
      const res = await fetch('/api/logs', { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setLogs([])
      showMessage(`已清空 ${data.removed ?? 0} 条对话日志`)
    } catch (err) {
      showMessage('清空失败: ' + err.message)
    }
  }

  const handleExportErrors = () => {
    window.open('/api/errors/export', '_blank')
  }

  const handleClearErrors = async () => {
    if (!confirm('确定清空所有错误日志吗？')) return
    try {
      const res = await fetch('/api/errors', { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setErrors([])
      setErrorDoc('')
      showMessage(`已清空 ${data.removed ?? 0} 条错误记录`)
    } catch (err) {
      showMessage('清空失败: ' + err.message)
    }
  }

  const handleSummarizeErrors = async () => {
    try {
      setSummarizeLoading(true)
      setErrorDoc('')
      const res = await fetch('/api/errors/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 50 }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || errData.message || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setErrorDoc(data.document || '')
      showMessage('错误文档已生成')
    } catch (err) {
      showMessage('生成失败: ' + err.message)
    } finally {
      setSummarizeLoading(false)
    }
  }

  const formatTime = (iso) => {
    if (!iso) return '-'
    try {
      return new Date(iso).toLocaleString('zh-CN')
    } catch {
      return iso
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <h2 style={{ fontSize: '18px', margin: 0 }}>对话与错误日志</h2>
        {message && (
          <span
            style={{
              fontSize: '13px',
              padding: '4px 10px',
              borderRadius: '6px',
              background: message.includes('失败') ? '#fef2f2' : '#f0fdf4',
              color: message.includes('失败') ? '#dc2626' : '#16a34a',
            }}
          >
            {message}
          </span>
        )}
      </div>

      {/* 对话日志 */}
      <div
        style={{
          background: 'white',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '16px',
          border: '1px solid var(--border)',
        }}
      >
        <h3 style={{ fontSize: '15px', margin: '0 0 12px 0' }}>对话请求/响应记录</h3>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索消息内容..."
            style={{
              flex: '1 1 200px',
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              fontSize: '14px',
            }}
            onKeyDown={(e) => e.key === 'Enter' && fetchLogs()}
          />
          <button className="btn-primary" onClick={fetchLogs} disabled={loading}>
            搜索
          </button>
          <button
            className="btn-primary"
            onClick={handleExportLogs}
            style={{ background: '#6b7280' }}
          >
            导出
          </button>
          <button
            className="btn-primary"
            onClick={handleClearLogs}
            style={{ background: '#dc2626' }}
          >
            清空
          </button>
        </div>

        {loading ? (
          <div className="loading">加载中...</div>
        ) : logs.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
            暂无对话日志
          </p>
        ) : (
          <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
            {logs.map((log) => (
              <div
                key={log.id}
                style={{
                  padding: '12px',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '13px',
                }}
              >
                <div style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  {formatTime(log.time)}
                  {log.action && (
                    <span
                      style={{
                        marginLeft: '8px',
                        padding: '1px 6px',
                        background: '#eff6ff',
                        borderRadius: '4px',
                        color: '#1d4ed8',
                      }}
                    >
                      {log.action}
                    </span>
                  )}
                </div>
                <div style={{ marginBottom: '4px' }}>
                  <strong>用户：</strong>
                  <span style={{ whiteSpace: 'pre-wrap' }}>{log.request_message}</span>
                </div>
                <div>
                  <strong>回复：</strong>
                  <span style={{ whiteSpace: 'pre-wrap' }}>{log.response_reply}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 错误日志 */}
      <div
        style={{
          background: 'white',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
        }}
      >
        <h3 style={{ fontSize: '15px', margin: '0 0 12px 0' }}>API 错误记录</h3>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={handleExportErrors}>
            导出错误报告
          </button>
          <button
            className="btn-primary"
            onClick={handleSummarizeErrors}
            disabled={summarizeLoading || errors.length === 0}
            style={{ background: '#6b7280' }}
          >
            {summarizeLoading ? '生成中...' : '自动生成错误文档'}
          </button>
          <button
            className="btn-primary"
            onClick={handleClearErrors}
            style={{ background: '#dc2626' }}
          >
            清空错误
          </button>
        </div>

        {errors.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 0 12px 0' }}>
            暂无 API 错误记录
          </p>
        ) : (
          <div
            style={{
              maxHeight: '200px',
              overflowY: 'auto',
              marginBottom: '12px',
              fontSize: '12px',
              fontFamily: 'monospace',
              background: '#f8fafc',
              padding: '10px',
              borderRadius: '6px',
            }}
          >
            {errors.slice(0, 20).map((err, i) => (
              <div key={i} style={{ marginBottom: '8px' }}>
                [{formatTime(err.time)}] {err.endpoint} — {err.error_type}: {err.message}
              </div>
            ))}
            {errors.length > 20 && (
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                另有 {errors.length - 20} 条，请导出完整报告查看
              </p>
            )}
          </div>
        )}

        {errorDoc && (
          <div>
            <h4 style={{ fontSize: '14px', margin: '0 0 8px 0' }}>LLM 错误分析文档</h4>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                fontSize: '13px',
                lineHeight: 1.5,
                background: '#f8fafc',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                maxHeight: '320px',
                overflowY: 'auto',
                margin: 0,
              }}
            >
              {errorDoc}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

export default SettingsLogsPanel

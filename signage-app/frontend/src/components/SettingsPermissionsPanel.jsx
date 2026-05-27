import React, { useState, useEffect, useCallback } from 'react'

const OPERATION_LABELS = {
  scan: '扫描',
  read: '读取',
}

function SettingsPermissionsPanel() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState('')

  const showMessage = (msg) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), 3000)
  }

  const fetchRemembered = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/scanner/remembered-permissions')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setItems(data.permissions || [])
    } catch (err) {
      setError('加载权限列表失败: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRemembered()
  }, [fetchRemembered])

  const revokeOne = async (item) => {
    try {
      setActionLoading(true)
      const res = await fetch('/api/scanner/remembered-permissions/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: item.operation, path: item.path }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || `HTTP ${res.status}`)
      }
      showMessage('已撤销该授权')
      await fetchRemembered()
    } catch (err) {
      showMessage('撤销失败: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const clearAll = async () => {
    if (!confirm('确定清除全部已记住的只读授权吗？')) return
    try {
      setActionLoading(true)
      const res = await fetch('/api/scanner/remembered-permissions', { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      showMessage('已清除全部记住的授权')
      await fetchRemembered()
    } catch (err) {
      showMessage('清除失败: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return <div className="loading">加载权限列表中...</div>
  }

  if (error) {
    return (
      <div className="error-state">
        <p>{error}</p>
        <button type="button" className="btn-primary" onClick={fetchRemembered} style={{ marginTop: 12 }}>
          重试
        </button>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 8 }}>权限管理</h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        只读操作（扫描、读取）可记住授权；写入操作每次仍需确认。
      </p>

      {message && (
        <p
          style={{
            fontSize: 13,
            marginBottom: 12,
            color: message.includes('失败') ? '#dc2626' : '#16a34a',
          }}
        >
          {message}
        </p>
      )}

      <div style={{ marginBottom: 16 }}>
        <button
          type="button"
          className="btn-primary"
          onClick={clearAll}
          disabled={actionLoading || items.length === 0}
          style={{ background: items.length === 0 ? undefined : '#6b7280' }}
        >
          全部清除
        </button>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <p>暂无已记住的授权</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {items.map((item) => (
            <div
              key={`${item.operation}:${item.path}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--white)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {OPERATION_LABELS[item.operation] || item.operation}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    wordBreak: 'break-all',
                    marginTop: 4,
                  }}
                >
                  {item.path}
                </div>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={() => revokeOne(item)}
                disabled={actionLoading}
                style={{ flexShrink: 0, fontSize: 13, padding: '6px 12px' }}
              >
                撤销
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default SettingsPermissionsPanel

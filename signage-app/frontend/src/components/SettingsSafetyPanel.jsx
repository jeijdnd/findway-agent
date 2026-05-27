import React, { useState, useEffect, useCallback } from 'react'

const RULE_LABELS = {
  danger_patterns: '危险命令模式检测',
  restricted_dirs: '系统目录访问限制',
  write_operations: '写入操作审查',
  llm_review: '严格模式下 LLM 二次审核',
}

function SettingsSafetyPanel() {
  const [config, setConfig] = useState(null)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true)
      const [cfgRes, logRes] = await Promise.all([
        fetch('/api/safety/config'),
        fetch('/api/safety/logs'),
      ])
      if (cfgRes.ok) setConfig(await cfgRes.json())
      if (logRes.ok) {
        const data = await logRes.json()
        setLogs(data.logs || [])
      }
    } catch (err) {
      setMessage('加载失败: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const saveStrictness = async (strictness) => {
    try {
      setSaving(true)
      const res = await fetch('/api/safety/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strictness }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setConfig(data.safety || config)
      setMessage('已保存')
      setTimeout(() => setMessage(''), 2000)
    } catch (err) {
      setMessage('保存失败: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleRule = async (key) => {
    const rules = { ...(config?.rules_enabled || {}) }
    rules[key] = !rules[key]
    try {
      setSaving(true)
      const res = await fetch('/api/safety/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules_enabled: { [key]: rules[key] } }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setConfig(data.safety)
    } catch (err) {
      setMessage('更新失败: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const clearLogs = async () => {
    if (!confirm('确定清空审核日志？')) return
    await fetch('/api/safety/logs', { method: 'DELETE' })
    setLogs([])
  }

  if (loading) return <div className="loading">加载安全配置...</div>

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 8 }}>安全沙箱</h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        Agent B 在工具执行前审核：规则拦截后可由用户「请求放行」。
      </p>

      {message && (
        <p style={{ fontSize: 13, marginBottom: 12, color: 'var(--text-secondary)' }}>{message}</p>
      )}

      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 8 }}>
          审核严格度
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['relaxed', 'standard', 'strict'].map((level) => (
            <button
              key={level}
              type="button"
              className={`settings-nav-item ${config?.strictness === level ? 'active' : ''}`}
              style={{ width: 'auto', minWidth: 88 }}
              disabled={saving}
              onClick={() => saveStrictness(level)}
            >
              {level === 'relaxed' ? '宽松' : level === 'standard' ? '标准' : '严格'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 8 }}>
          审核规则开关
        </label>
        <div style={{ display: 'grid', gap: 8 }}>
          {Object.entries(RULE_LABELS).map(([key, label]) => (
            <label
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={config?.rules_enabled?.[key] !== false}
                disabled={saving}
                onChange={() => toggleRule(key)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <h3 style={{ fontSize: 15, margin: 0 }}>审核日志（最近 50 条）</h3>
          <button type="button" className="btn-primary" onClick={clearLogs} style={{ fontSize: 13 }}>
            清空日志
          </button>
        </div>
        {logs.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>暂无审核记录</p>
        ) : (
          <div style={{ display: 'grid', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
            {logs.map((log) => (
              <div
                key={log.id}
                style={{
                  padding: '8px 10px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  fontSize: 12,
                  background: log.allowed ? '#f0fdf4' : '#fffbeb',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>{log.skill_name}</span>
                  <span>{log.allowed ? '✓ 放行' : '✗ 拦截'}</span>
                </div>
                <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                  {new Date(log.time).toLocaleString('zh-CN')} · {log.auditor}
                  {log.user_bypass ? ' · 用户放行' : ''}
                </div>
                {log.reason && <div style={{ marginTop: 4 }}>{log.reason}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default SettingsSafetyPanel

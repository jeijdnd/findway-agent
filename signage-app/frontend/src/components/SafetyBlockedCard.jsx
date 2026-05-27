import React, { useState } from 'react'

function SafetyBlockedCard({ blocked, onBypassSuccess }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  if (!blocked?.audit_id) return null

  const handleBypass = async () => {
    const ok = window.confirm(
      `安全审核已拦截此操作。\n\n原因：${blocked.reason}\n\n确定要请求放行并执行吗？`
    )
    if (!ok) return

    try {
      setLoading(true)
      setMessage('')
      const res = await fetch('/api/safety/bypass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audit_id: blocked.audit_id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.detail || `HTTP ${res.status}`)
      }
      setMessage(data.message || '已放行并执行')
      if (onBypassSuccess) onBypassSuccess(data)
    } catch (err) {
      setMessage('放行失败: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="safety-blocked-card">
      <div className="safety-blocked-title">⚠ 安全审核拦截</div>
      <p className="safety-blocked-reason">{blocked.reason}</p>
      {blocked.skill_name && (
        <p className="safety-blocked-meta">
          技能：{blocked.skill_name}
          {blocked.risk_level && ` · 风险：${blocked.risk_level}`}
        </p>
      )}
      <button
        type="button"
        className="btn-primary safety-bypass-btn"
        onClick={handleBypass}
        disabled={loading}
      >
        {loading ? '执行中...' : '请求放行'}
      </button>
      {message && (
        <p
          className="safety-blocked-msg"
          style={{ color: message.includes('失败') ? '#dc2626' : '#16a34a' }}
        >
          {message}
        </p>
      )}
    </div>
  )
}

export default SafetyBlockedCard

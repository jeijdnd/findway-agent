import React, { useState, useEffect, useCallback } from 'react'

function SettingsSkillsPanel() {
  const [skills, setSkills] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState('')

  const showMessage = (msg) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), 3000)
  }

  const fetchSkills = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      const res = await fetch('/api/skills', { signal: controller.signal })
      clearTimeout(timeoutId)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setSkills(data.skills || [])
    } catch (err) {
      setError(
        err.name === 'AbortError'
          ? '请求超时，请检查后端是否启动'
          : '加载技能列表失败: ' + err.message
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSkills()
  }, [fetchSkills])

  const toggleSkill = async (skill) => {
    try {
      setActionLoading(true)
      const res = await fetch(`/api/skills/${skill.name}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !skill.enabled }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || errData.message || `HTTP ${res.status}`)
      }
      await fetchSkills()
      showMessage(skill.enabled ? '已禁用' : '已启用')
    } catch (err) {
      showMessage('切换失败: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const byCategory = skills.reduce((acc, s) => {
    const cat = s.category || '其它'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(s)
    return acc
  }, {})

  if (loading) {
    return <div className="loading">加载技能列表中...</div>
  }

  if (error) {
    return (
      <div className="error-state">
        <p>{error}</p>
        <button type="button" className="btn-primary" onClick={fetchSkills} style={{ marginTop: 12 }}>
          重试
        </button>
      </div>
    )
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div>
          <h2 style={{ fontSize: 18, margin: 0 }}>技能管理</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '6px 0 0 0' }}>
            启用后技能描述将注入 LLM 系统提示，辅助意图识别与操作建议
          </p>
        </div>
        {message && (
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 12,
              background: message.includes('失败') ? '#fef2f2' : '#f0fdf4',
              color: message.includes('失败') ? '#dc2626' : '#16a34a',
            }}
          >
            {message}
          </span>
        )}
      </div>

      {skills.length === 0 ? (
        <div className="empty-state">
          <p>暂无已安装技能</p>
        </div>
      ) : (
        Object.entries(byCategory).map(([category, items]) => (
          <div
            key={category}
            style={{
              background: 'white',
              padding: 16,
              borderRadius: 8,
              marginBottom: 16,
              border: '1px solid var(--border)',
            }}
          >
            <h3 style={{ fontSize: 15, margin: '0 0 12px 0' }}>{category}</h3>
            <div style={{ display: 'grid', gap: 10 }}>
              {items.map((skill) => (
                <div
                  key={skill.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: skill.enabled ? '#f0fdf4' : '#fafafa',
                    borderColor: skill.enabled ? '#86efac' : 'var(--border)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{skill.name}</div>
                    <p
                      style={{
                        fontSize: 13,
                        color: 'var(--text-secondary)',
                        margin: '4px 0 0 0',
                      }}
                    >
                      {skill.description}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                      v{skill.version}
                    </p>
                  </div>
                  <div
                    onClick={() => !actionLoading && toggleSkill(skill)}
                    title={skill.enabled ? '点击禁用' : '点击启用'}
                    style={{
                      width: 40,
                      height: 22,
                      borderRadius: 11,
                      background: skill.enabled ? '#22c55e' : '#d1d5db',
                      position: 'relative',
                      cursor: actionLoading ? 'not-allowed' : 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: 'white',
                        position: 'absolute',
                        top: 2,
                        left: skill.enabled ? 20 : 2,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

export default SettingsSkillsPanel

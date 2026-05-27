import React, { useState, useEffect, useCallback } from 'react'
import SettingsLogsPanel from '../components/SettingsLogsPanel'
import SettingsSkillsPanel from '../components/SettingsSkillsPanel'
import SettingsPermissionsPanel from '../components/SettingsPermissionsPanel'

const SETTINGS_SECTIONS = [
  { id: 'general', label: '常规配置' },
  { id: 'skills', label: '技能' },
  { id: 'permissions', label: '权限管理' },
  { id: 'logs', label: '日志' },
]

const EMPTY_API_FORM = {
  name: '',
  base_url: '',
  api_key: '',
  model: '',
  enabled: true,
}

function generateApiId(name) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 24)
  return `${base || 'api'}-${Date.now().toString(36).slice(-6)}`
}

function Settings() {
  const [activeSection, setActiveSection] = useState('general')
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [newColumn, setNewColumn] = useState('')

  const [llmApis, setLlmApis] = useState([])
  const [llmApisLoading, setLlmApisLoading] = useState(true)
  const [llmApisError, setLlmApisError] = useState(null)
  const [llmActionLoading, setLlmActionLoading] = useState(false)
  const [llmMessage, setLlmMessage] = useState('')
  const [showApiForm, setShowApiForm] = useState(false)
  const [editingApiId, setEditingApiId] = useState(null)
  const [apiForm, setApiForm] = useState(EMPTY_API_FORM)

  const showLlmMessage = (msg) => {
    setLlmMessage(msg)
    setTimeout(() => setLlmMessage(''), 3000)
  }

  const activeApiId = config?.llm?.default_api || ''

  const fetchConfig = async () => {
    try {
      setLoading(true)
      setError(null)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const response = await fetch('/api/settings', { signal: controller.signal })
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const data = await response.json()
      setConfig(data)
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('请求超时，请检查后端是否启动')
      } else {
        setError('加载配置失败: ' + err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchLlmApis = useCallback(async () => {
    try {
      setLlmApisLoading(true)
      setLlmApisError(null)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const response = await fetch('/api/api-configs', { signal: controller.signal })
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const data = await response.json()
      setLlmApis(data.configs || [])
    } catch (err) {
      if (err.name === 'AbortError') {
        setLlmApisError('请求超时，请检查后端是否启动')
      } else {
        setLlmApisError('加载 API 配置失败: ' + err.message)
      }
    } finally {
      setLlmApisLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
    fetchLlmApis()
  }, [fetchLlmApis])

  const saveConfig = async (updateData) => {
    try {
      setSaving(true)
      setSaveMessage('')
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.detail || `HTTP ${response.status}`)
      }

      const result = await response.json()
      setConfig(result.config)
      setSaveMessage('保存成功')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (err) {
      setSaveMessage('保存失败: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleModule = (moduleName) => {
    if (!config) return
    const newValue = !config.modules[moduleName]
    saveConfig({ modules: { [moduleName]: newValue } })
  }

  const updateRule = (ruleName, value) => {
    if (!config) return
    saveConfig({ matching_rules: { [ruleName]: value } })
  }

  const addColumn = () => {
    if (!config || !newColumn.trim()) return
    const columns = [...config.list_template.columns, newColumn.trim()]
    saveConfig({ list_template: { columns } })
    setNewColumn('')
  }

  const removeColumn = (index) => {
    if (!config) return
    const columns = config.list_template.columns.filter((_, i) => i !== index)
    saveConfig({ list_template: { columns } })
  }

  const resetConfig = async () => {
    if (!confirm('确定要重置为默认配置吗？')) return
    try {
      setSaving(true)
      const response = await fetch('/api/settings/reset', { method: 'POST' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const result = await response.json()
      setConfig(result.config)
      setSaveMessage('配置已重置')
      setTimeout(() => setSaveMessage(''), 3000)
      await fetchLlmApis()
    } catch (err) {
      setSaveMessage('重置失败: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const reloadConfig = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/reload', { method: 'POST' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const result = await response.json()
      setConfig(result.config)
      setSaveMessage('配置已重载')
      setTimeout(() => setSaveMessage(''), 3000)
      await fetchLlmApis()
    } catch (err) {
      setSaveMessage('重载失败: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const reloadLlmApis = async () => {
    try {
      setLlmActionLoading(true)
      await fetchLlmApis()
      const settingsRes = await fetch('/api/settings/reload', { method: 'POST' })
      if (settingsRes.ok) {
        const result = await settingsRes.json()
        setConfig(result.config)
      }
      showLlmMessage('LLM API 配置已重新加载')
    } catch (err) {
      showLlmMessage('重新加载失败: ' + err.message)
    } finally {
      setLlmActionLoading(false)
    }
  }

  const openAddApiForm = () => {
    setEditingApiId(null)
    setApiForm(EMPTY_API_FORM)
    setShowApiForm(true)
  }

  const openEditApiForm = (api) => {
    setEditingApiId(api.id)
    setApiForm({
      name: api.name || '',
      base_url: api.base_url || '',
      api_key: '',
      model: api.model || '',
      enabled: api.enabled !== false,
    })
    setShowApiForm(true)
  }

  const closeApiForm = () => {
    setShowApiForm(false)
    setEditingApiId(null)
    setApiForm(EMPTY_API_FORM)
  }

  const submitApiForm = async (e) => {
    e.preventDefault()
    if (!apiForm.name.trim() || !apiForm.base_url.trim() || !apiForm.model.trim()) {
      showLlmMessage('请填写名称、Base URL 和模型')
      return
    }

    try {
      setLlmActionLoading(true)
      if (editingApiId) {
        const body = {
          name: apiForm.name.trim(),
          base_url: apiForm.base_url.trim(),
          model: apiForm.model.trim(),
          enabled: apiForm.enabled,
        }
        if (apiForm.api_key.trim()) {
          body.api_key = apiForm.api_key.trim()
        }
        const response = await fetch(`/api/api-configs/${editingApiId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          throw new Error(errData.detail || `HTTP ${response.status}`)
        }
        showLlmMessage('API 配置已更新')
      } else {
        const newId = generateApiId(apiForm.name)
        const body = {
          id: newId,
          name: apiForm.name.trim(),
          base_url: apiForm.base_url.trim(),
          api_key: apiForm.api_key.trim(),
          model: apiForm.model.trim(),
          enabled: apiForm.enabled,
        }
        const response = await fetch('/api/api-configs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          throw new Error(errData.detail || `HTTP ${response.status}`)
        }
        showLlmMessage('API 配置已添加')
      }
      closeApiForm()
      await fetchLlmApis()
      const settingsRes = await fetch('/api/settings')
      if (settingsRes.ok) {
        setConfig(await settingsRes.json())
      }
    } catch (err) {
      showLlmMessage((editingApiId ? '更新' : '添加') + '失败: ' + err.message)
    } finally {
      setLlmActionLoading(false)
    }
  }

  const toggleApiEnabled = async (api) => {
    try {
      setLlmActionLoading(true)
      const response = await fetch(`/api/api-configs/${api.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !api.enabled }),
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || `HTTP ${response.status}`)
      }
      await fetchLlmApis()
    } catch (err) {
      showLlmMessage('切换状态失败: ' + err.message)
    } finally {
      setLlmActionLoading(false)
    }
  }

  const deleteApi = async (api) => {
    if (!confirm(`确定删除 API「${api.name}」吗？`)) return
    try {
      setLlmActionLoading(true)
      const response = await fetch(`/api/api-configs/${api.id}`, { method: 'DELETE' })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || `HTTP ${response.status}`)
      }
      showLlmMessage('API 配置已删除')
      await fetchLlmApis()
      const settingsRes = await fetch('/api/settings')
      if (settingsRes.ok) {
        setConfig(await settingsRes.json())
      }
    } catch (err) {
      showLlmMessage('删除失败: ' + err.message)
    } finally {
      setLlmActionLoading(false)
    }
  }

  const settingsNav = (
    <nav className="settings-nav">
      {SETTINGS_SECTIONS.map((sec) => (
        <button
          key={sec.id}
          type="button"
          className={`settings-nav-item ${activeSection === sec.id ? 'active' : ''}`}
          onClick={() => setActiveSection(sec.id)}
        >
          {sec.label}
        </button>
      ))}
    </nav>
  )

  if (activeSection === 'skills') {
    return (
      <div className="settings-layout">
        {settingsNav}
        <div className="settings-content">
          <SettingsSkillsPanel />
        </div>
      </div>
    )
  }

  if (activeSection === 'permissions') {
    return (
      <div className="settings-layout">
        {settingsNav}
        <div className="settings-content">
          <SettingsPermissionsPanel />
        </div>
      </div>
    )
  }

  if (activeSection === 'logs') {
    return (
      <div className="settings-layout">
        {settingsNav}
        <div className="settings-content">
          <SettingsLogsPanel />
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="settings-layout">
        {settingsNav}
        <div className="settings-content">
          <div className="loading">加载配置中...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="settings-layout">
        {settingsNav}
        <div className="settings-content">
          <div className="error-state">
            <h2>加载失败</h2>
            <p>{error}</p>
            <button className="btn-primary" onClick={fetchConfig} style={{ marginTop: '12px' }}>
              重试
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="settings-layout">
        {settingsNav}
        <div className="settings-content">
          <div className="empty-state">
            <h2>配置为空</h2>
            <p>无法加载配置文件</p>
          </div>
        </div>
      </div>
    )
  }

  const moduleNames = {
    project_matching: '旧项目匹配',
    list_compare: '清单对比',
    cad_assist: 'CAD辅助',
    spec_query: '规范查询',
    master_library: '大师库',
  }

  const ruleDescriptions = {
    type_weight: '类型匹配权重（项目类型一致性）',
    structure_weight: '结构匹配权重（楼栋/层数相似度）',
    time_weight: '时间匹配权重（文件修改时间接近度）',
    max_results: '最大返回结果数',
  }

  const stepNames = {
    collect_info: '收集项目信息',
    match_old_project: '匹配旧项目',
    generate_list_v1: '生成清单V1',
    replace_frame: '替换图框',
    remind_list_v2: '提醒清单V2',
  }

  return (
    <div className="settings-layout">
      {settingsNav}
      <div className="settings-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '18px' }}>开发者控制台</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          {saveMessage && (
            <span
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                background: saveMessage.includes('失败') ? '#fef2f2' : '#f0fdf4',
                color: saveMessage.includes('失败') ? '#dc2626' : '#16a34a',
              }}
            >
              {saveMessage}
            </span>
          )}
          <button
            className="btn-primary"
            onClick={reloadConfig}
            disabled={saving}
            style={{ background: '#6b7280' }}
          >
            热重载
          </button>
          <button
            className="btn-primary"
            onClick={resetConfig}
            disabled={saving}
            style={{ background: '#dc2626' }}
          >
            重置默认
          </button>
        </div>
      </div>

      {/* 模块开关 */}
      <div
        style={{
          background: 'white',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '16px',
          border: '1px solid var(--border)',
        }}
      >
        <h3 style={{ fontSize: '15px', marginBottom: '12px' }}>功能模块开关</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
          {Object.entries(config.modules).map(([key, value]) => (
            <div
              key={key}
              onClick={() => toggleModule(key)}
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                background: value ? '#f0fdf4' : '#fafafa',
                borderColor: value ? '#86efac' : 'var(--border)',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: 500 }}>{moduleNames[key] || key}</span>
                <div
                  style={{
                    width: '40px',
                    height: '22px',
                    borderRadius: '11px',
                    background: value ? '#22c55e' : '#d1d5db',
                    position: 'relative',
                    transition: 'background 0.2s',
                  }}
                >
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: 'white',
                      position: 'absolute',
                      top: '2px',
                      left: value ? '20px' : '2px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      transition: 'left 0.2s',
                    }}
                  />
                </div>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '6px 0 0 0' }}>
                {value ? '已启用' : '已禁用'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 匹配规则 */}
      <div
        style={{
          background: 'white',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '16px',
          border: '1px solid var(--border)',
        }}
      >
        <h3 style={{ fontSize: '15px', marginBottom: '12px' }}>匹配规则配置</h3>
        <div style={{ display: 'grid', gap: '16px' }}>
          {['type_weight', 'structure_weight', 'time_weight'].map((key) => (
            <div key={key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '14px', color: 'var(--text)' }}>{ruleDescriptions[key]}</label>
                <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--primary)' }}>
                  {(config.matching_rules[key] * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={config.matching_rules[key]}
                onChange={(e) => updateRule(key, parseFloat(e.target.value))}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>
          ))}
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '13px',
              background:
                Math.abs(
                  config.matching_rules.type_weight +
                    config.matching_rules.structure_weight +
                    config.matching_rules.time_weight -
                    1
                ) < 0.01
                  ? '#f0fdf4'
                  : '#fef2f2',
              color:
                Math.abs(
                  config.matching_rules.type_weight +
                    config.matching_rules.structure_weight +
                    config.matching_rules.time_weight -
                    1
                ) < 0.01
                  ? '#16a34a'
                  : '#dc2626',
            }}
          >
            权重总和:{' '}
            {(
              config.matching_rules.type_weight +
              config.matching_rules.structure_weight +
              config.matching_rules.time_weight
            ).toFixed(2)}
            {Math.abs(
              config.matching_rules.type_weight +
                config.matching_rules.structure_weight +
                config.matching_rules.time_weight -
                1
            ) >= 0.01 && ' (应为1.00)'}
          </div>
          <div>
            <label style={{ fontSize: '14px', color: 'var(--text)', display: 'block', marginBottom: '6px' }}>
              {ruleDescriptions.max_results}
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={config.matching_rules.max_results}
              onChange={(e) => updateRule('max_results', parseInt(e.target.value) || 5)}
              style={{
                width: '100px',
                padding: '6px 10px',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '14px',
              }}
            />
          </div>
        </div>
      </div>

      {/* 工作流程 */}
      <div
        style={{
          background: 'white',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '16px',
          border: '1px solid var(--border)',
        }}
      >
        <h3 style={{ fontSize: '15px', marginBottom: '12px' }}>新项目工作流程</h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {config.workflow.new_project_steps.map((step, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 12px',
                background: '#f8fafc',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '13px',
              }}
            >
              <span
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 600,
                  marginRight: '8px',
                }}
              >
                {index + 1}
              </span>
              {stepNames[step] || step}
            </div>
          ))}
        </div>
      </div>

      {/* 清单模板 */}
      <div
        style={{
          background: 'white',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '16px',
          border: '1px solid var(--border)',
        }}
      >
        <h3 style={{ fontSize: '15px', marginBottom: '12px' }}>清单模板列配置</h3>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input
            type="text"
            value={newColumn}
            onChange={(e) => setNewColumn(e.target.value)}
            placeholder="输入新列名"
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              fontSize: '14px',
            }}
            onKeyPress={(e) => e.key === 'Enter' && addColumn()}
          />
          <button className="btn-primary" onClick={addColumn} disabled={!newColumn.trim()}>
            添加
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {config.list_template.columns.map((col, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '6px 10px',
                background: '#f8fafc',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '13px',
              }}
            >
              <span>{col}</span>
              <button
                onClick={() => removeColumn(index)}
                style={{
                  marginLeft: '8px',
                  padding: '2px 6px',
                  background: 'transparent',
                  border: 'none',
                  color: '#dc2626',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        {config.list_template.columns.length === 0 && (
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '8px 0 0 0' }}>
            暂无列配置，请添加清单列
          </p>
        )}
      </div>

      {/* LLM API 配置 */}
      <div
        style={{
          background: 'white',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <h3 style={{ fontSize: '15px', margin: 0 }}>LLM API 配置</h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {llmMessage && (
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  background: llmMessage.includes('失败') ? '#fef2f2' : '#f0fdf4',
                  color: llmMessage.includes('失败') ? '#dc2626' : '#16a34a',
                }}
              >
                {llmMessage}
              </span>
            )}
            <button
              className="btn-primary"
              onClick={reloadLlmApis}
              disabled={llmActionLoading}
              style={{ background: '#6b7280' }}
            >
              重新加载配置
            </button>
            <button className="btn-primary" onClick={openAddApiForm} disabled={llmActionLoading}>
              添加 API
            </button>
          </div>
        </div>

        {llmApisLoading ? (
          <div className="loading" style={{ padding: '24px 0' }}>
            加载 API 配置中...
          </div>
        ) : llmApisError ? (
          <div className="error-state" style={{ padding: '16px' }}>
            <p style={{ margin: '0 0 12px 0' }}>{llmApisError}</p>
            <button className="btn-primary" onClick={fetchLlmApis}>
              重试
            </button>
          </div>
        ) : llmApis.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>暂无 API 配置，请添加</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {llmApis.map((api) => {
              const isActive = api.id === activeApiId
              return (
                <div
                  key={api.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: isActive ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: isActive ? '#eff6ff' : '#fafafa',
                  }}
                >
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600 }}>{api.name}</span>
                      {isActive && (
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: 'var(--primary)',
                            color: 'white',
                          }}
                        >
                          当前激活
                        </span>
                      )}
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{api.model}</span>
                    </div>
                    <p
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        margin: '4px 0 0 0',
                        wordBreak: 'break-all',
                      }}
                    >
                      {api.base_url}
                    </p>
                  </div>
                  <div
                    onClick={() => !llmActionLoading && toggleApiEnabled(api)}
                    title={api.enabled ? '点击禁用' : '点击启用'}
                    style={{
                      width: '40px',
                      height: '22px',
                      borderRadius: '11px',
                      background: api.enabled ? '#22c55e' : '#d1d5db',
                      position: 'relative',
                      cursor: llmActionLoading ? 'not-allowed' : 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: 'white',
                        position: 'absolute',
                        top: '2px',
                        left: api.enabled ? '20px' : '2px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button
                      className="btn-primary"
                      onClick={() => openEditApiForm(api)}
                      disabled={llmActionLoading}
                      style={{ background: '#6b7280', padding: '6px 12px', fontSize: '13px' }}
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => deleteApi(api)}
                      disabled={llmActionLoading}
                      style={{
                        padding: '6px 12px',
                        fontSize: '13px',
                        border: '1px solid #fecaca',
                        borderRadius: '6px',
                        background: '#fef2f2',
                        color: '#dc2626',
                        cursor: llmActionLoading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 添加/编辑 API 表单弹窗 */}
      {showApiForm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          onClick={closeApiForm}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '10px',
              padding: '20px',
              width: '100%',
              maxWidth: '480px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '16px', margin: '0 0 16px 0' }}>
              {editingApiId ? '编辑 API' : '添加 API'}
            </h3>
            <form onSubmit={submitApiForm}>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label>名称 *</label>
                <input
                  type="text"
                  value={apiForm.name}
                  onChange={(e) => setApiForm({ ...apiForm, name: e.target.value })}
                  placeholder="如：硅基流动、DeepSeek"
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label>Base URL *</label>
                <input
                  type="text"
                  value={apiForm.base_url}
                  onChange={(e) => setApiForm({ ...apiForm, base_url: e.target.value })}
                  placeholder="https://api.siliconflow.cn/v1"
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label>API Key {editingApiId ? '（留空则不修改）' : ''}</label>
                <input
                  type="password"
                  value={apiForm.api_key}
                  onChange={(e) => setApiForm({ ...apiForm, api_key: e.target.value })}
                  placeholder={editingApiId ? '不修改请留空' : '输入 API Key'}
                  autoComplete="new-password"
                />
              </div>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label>模型 *</label>
                <input
                  type="text"
                  value={apiForm.model}
                  onChange={(e) => setApiForm({ ...apiForm, model: e.target.value })}
                  placeholder="deepseek-v3"
                  required
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                }}
              >
                <label style={{ fontSize: '14px' }}>启用</label>
                <div
                  onClick={() => setApiForm({ ...apiForm, enabled: !apiForm.enabled })}
                  style={{
                    width: '40px',
                    height: '22px',
                    borderRadius: '11px',
                    background: apiForm.enabled ? '#22c55e' : '#d1d5db',
                    position: 'relative',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: 'white',
                      position: 'absolute',
                      top: '2px',
                      left: apiForm.enabled ? '20px' : '2px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={closeApiForm}
                  disabled={llmActionLoading}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    background: 'white',
                    cursor: 'pointer',
                  }}
                >
                  取消
                </button>
                <button type="submit" className="btn-primary" disabled={llmActionLoading}>
                  {llmActionLoading ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

export default Settings

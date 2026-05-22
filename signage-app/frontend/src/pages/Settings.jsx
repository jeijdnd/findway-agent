import React, { useState, useEffect } from 'react'

function Settings() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [newColumn, setNewColumn] = useState('')

  // 获取配置
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

  useEffect(() => {
    fetchConfig()
  }, [])

  // 保存配置
  const saveConfig = async (updateData) => {
    try {
      setSaving(true)
      setSaveMessage('')
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
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

  // 切换模块开关
  const toggleModule = (moduleName) => {
    if (!config) return
    const newValue = !config.modules[moduleName]
    saveConfig({ modules: { [moduleName]: newValue } })
  }

  // 更新匹配规则
  const updateRule = (ruleName, value) => {
    if (!config) return
    saveConfig({ matching_rules: { [ruleName]: value } })
  }

  // 添加清单列
  const addColumn = () => {
    if (!config || !newColumn.trim()) return
    const columns = [...config.list_template.columns, newColumn.trim()]
    saveConfig({ list_template: { columns } })
    setNewColumn('')
  }

  // 删除清单列
  const removeColumn = (index) => {
    if (!config) return
    const columns = config.list_template.columns.filter((_, i) => i !== index)
    saveConfig({ list_template: { columns } })
  }

  // 重置配置
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
    } catch (err) {
      setSaveMessage('重置失败: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // 热重载配置
  const reloadConfig = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/reload', { method: 'POST' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const result = await response.json()
      setConfig(result.config)
      setSaveMessage('配置已重载')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (err) {
      setSaveMessage('重载失败: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="loading">加载配置中...</div>
  }

  if (error) {
    return (
      <div className="error-state">
        <h2>加载失败</h2>
        <p>{error}</p>
        <button className="btn-primary" onClick={fetchConfig} style={{ marginTop: '12px' }}>
          重试
        </button>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="empty-state">
        <h2>配置为空</h2>
        <p>无法加载配置文件</p>
      </div>
    )
  }

  // 模块名称映射
  const moduleNames = {
    project_matching: '旧项目匹配',
    list_compare: '清单对比',
    cad_assist: 'CAD辅助',
    spec_query: '规范查询',
    master_library: '大师库'
  }

  // 规则描述
  const ruleDescriptions = {
    type_weight: '类型匹配权重（项目类型一致性）',
    structure_weight: '结构匹配权重（楼栋/层数相似度）',
    time_weight: '时间匹配权重（文件修改时间接近度）',
    max_results: '最大返回结果数'
  }

  // 步骤名称映射
  const stepNames = {
    collect_info: '收集项目信息',
    match_old_project: '匹配旧项目',
    generate_list_v1: '生成清单V1',
    replace_frame: '替换图框',
    remind_list_v2: '提醒清单V2'
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '18px' }}>开发者控制台</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          {saveMessage && (
            <span style={{ 
              padding: '6px 12px', 
              borderRadius: '6px', 
              fontSize: '13px',
              background: saveMessage.includes('失败') ? '#fef2f2' : '#f0fdf4',
              color: saveMessage.includes('失败') ? '#dc2626' : '#16a34a'
            }}>
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
      <div style={{ background: 'white', padding: '16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--border)' }}>
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
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: 500 }}>{moduleNames[key] || key}</span>
                <div style={{
                  width: '40px',
                  height: '22px',
                  borderRadius: '11px',
                  background: value ? '#22c55e' : '#d1d5db',
                  position: 'relative',
                  transition: 'background 0.2s'
                }}>
                  <div style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: 'white',
                    position: 'absolute',
                    top: '2px',
                    left: value ? '20px' : '2px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    transition: 'left 0.2s'
                  }} />
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
      <div style={{ background: 'white', padding: '16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: '15px', marginBottom: '12px' }}>匹配规则配置</h3>
        <div style={{ display: 'grid', gap: '16px' }}>
          {/* 权重滑块 */}
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
          {/* 权重总和提示 */}
          <div style={{ 
            padding: '8px 12px', 
            borderRadius: '6px', 
            fontSize: '13px',
            background: Math.abs(
              config.matching_rules.type_weight + 
              config.matching_rules.structure_weight + 
              config.matching_rules.time_weight - 1
            ) < 0.01 ? '#f0fdf4' : '#fef2f2',
            color: Math.abs(
              config.matching_rules.type_weight + 
              config.matching_rules.structure_weight + 
              config.matching_rules.time_weight - 1
            ) < 0.01 ? '#16a34a' : '#dc2626'
          }}>
            权重总和: {(
              config.matching_rules.type_weight + 
              config.matching_rules.structure_weight + 
              config.matching_rules.time_weight
            ).toFixed(2)}
            {Math.abs(
              config.matching_rules.type_weight + 
              config.matching_rules.structure_weight + 
              config.matching_rules.time_weight - 1
            ) >= 0.01 && ' (应为1.00)'}
          </div>
          {/* 最大结果数 */}
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
              style={{ width: '100px', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px' }}
            />
          </div>
        </div>
      </div>

      {/* 工作流程 */}
      <div style={{ background: 'white', padding: '16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--border)' }}>
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
                fontSize: '13px'
              }}
            >
              <span style={{ 
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
                marginRight: '8px'
              }}>
                {index + 1}
              </span>
              {stepNames[step] || step}
            </div>
          ))}
        </div>
      </div>

      {/* 清单模板 */}
      <div style={{ background: 'white', padding: '16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: '15px', marginBottom: '12px' }}>清单模板列配置</h3>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input
            type="text"
            value={newColumn}
            onChange={(e) => setNewColumn(e.target.value)}
            placeholder="输入新列名"
            style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px' }}
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
                fontSize: '13px'
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
                  fontSize: '14px'
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

      {/* LLM配置 */}
      <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: '15px', marginBottom: '12px' }}>LLM配置</h3>
        <div style={{ display: 'grid', gap: '12px' }}>
          <div className="form-group">
            <label>Provider</label>
            <select
              value={config.llm.provider}
              onChange={(e) => saveConfig({ llm: { provider: e.target.value } })}
            >
              <option value="openai_compatible">OpenAI兼容</option>
              <option value="openai">OpenAI</option>
              <option value="azure">Azure OpenAI</option>
              <option value="local">本地模型</option>
            </select>
          </div>
          <div className="form-group">
            <label>API Key</label>
            <input
              type="password"
              value={config.llm.api_key}
              onChange={(e) => saveConfig({ llm: { api_key: e.target.value } })}
              placeholder="从环境变量 LLM_API_KEY 读取"
            />
          </div>
          <div className="form-group">
            <label>Base URL</label>
            <input
              type="text"
              value={config.llm.base_url}
              onChange={(e) => saveConfig({ llm: { base_url: e.target.value } })}
              placeholder="https://api.openai.com/v1"
            />
          </div>
          <div className="form-group">
            <label>模型</label>
            <input
              type="text"
              value={config.llm.model}
              onChange={(e) => saveConfig({ llm: { model: e.target.value } })}
              placeholder="gpt-4o-mini"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings

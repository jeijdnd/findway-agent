import React, { useState, useEffect } from 'react'

function Dashboard() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    project_type: '',
    buildings: '',
    notes: ''
  })

  const fetchProjects = async () => {
    try {
      setLoading(true)
      setError(null)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const response = await fetch('/api/projects', { signal: controller.signal })
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const data = await response.json()
      setProjects(data)
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('请求超时，请检查后端是否启动')
      } else {
        setError('加载项目列表失败: ' + err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          project_type: formData.project_type,
          buildings: formData.buildings.split(',').map(b => b.trim()).filter(Boolean),
          notes: formData.notes
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      setShowForm(false)
      setFormData({ name: '', project_type: '', buildings: '', notes: '' })
      fetchProjects()
    } catch (err) {
      alert('创建项目失败: ' + err.message)
    }
  }

  if (loading) {
    return <div className="loading">加载中...</div>
  }

  if (error) {
    return (
      <div className="error-state">
        <h2>加载失败</h2>
        <p>{error}</p>
        <button className="btn-primary" onClick={fetchProjects} style={{ marginTop: '12px' }}>
          重试
        </button>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '18px' }}>进行中的项目</h2>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '取消' : '+ 新建项目'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: 'white', padding: '16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--border)' }}>
          <div className="form-group">
            <label>项目名称 *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例如：珠海理工"
              required
            />
          </div>
          <div className="form-group">
            <label>项目类型</label>
            <select
              value={formData.project_type}
              onChange={(e) => setFormData({ ...formData, project_type: e.target.value })}
            >
              <option value="">请选择类型</option>
              <option value="学校">学校</option>
              <option value="办公">办公</option>
              <option value="住宅">住宅</option>
              <option value="产业园">产业园</option>
              <option value="实验室">实验室</option>
              <option value="其他">其他</option>
            </select>
          </div>
          <div className="form-group">
            <label>楼栋列表（逗号分隔）</label>
            <input
              type="text"
              value={formData.buildings}
              onChange={(e) => setFormData({ ...formData, buildings: e.target.value })}
              placeholder="例如：教学楼, 宿舍楼, 实验楼"
            />
          </div>
          <div className="form-group">
            <label>备注</label>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="项目备注信息..."
            />
          </div>
          <button type="submit" className="btn-primary">创建项目</button>
        </form>
      )}

      {projects.length === 0 ? (
        <div className="empty-state">
          <h2>暂无项目</h2>
          <p>点击上方"新建项目"按钮或在对话中说"创建项目"</p>
        </div>
      ) : (
        projects.map(project => (
          <div key={project.id} className="project-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>{project.name}</h3>
              <span className="stage">{project.stage}</span>
            </div>
            {project.project_type && (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                类型：{project.project_type}
                {project.buildings.length > 0 && ` | 楼栋：${project.buildings.join(', ')}`}
              </p>
            )}
            {project.notes && (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {project.notes}
              </p>
            )}
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
              创建时间：{new Date(project.created_at).toLocaleString('zh-CN')}
            </p>
          </div>
        ))
      )}
    </div>
  )
}

export default Dashboard
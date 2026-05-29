import React, { useState, useEffect, useCallback, useRef } from 'react'

const STAGE_OPTIONS = [
  '概念方案', '方案设计', '施工图', '审图',
  '清单V1', '清单V2', '竣工图', '已交付', '暂停',
]

const GROUP_ORDER = ['进行中', '施工阶段', '清单阶段', '已完成', '暂停']

const GROUP_ICONS = {
  进行中: '🟡',
  施工阶段: '🔵',
  清单阶段: '🟢',
  已完成: '⚪',
  暂停: '⏸️',
}

const FILE_TAGS = ['', '初稿', '审图版', '最终版', '施工图', '竣工图']

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function yearOptions() {
  const current = new Date().getFullYear()
  return Array.from({ length: 10 }, (_, i) => current - 2 + i)
}

async function collectDroppedNames(items) {
  const names = []
  for (const item of items) {
    const entry = item.webkitGetAsEntry?.()
    if (entry) {
      names.push(entry.name)
    } else if (item.kind === 'file') {
      const file = item.getAsFile()
      if (file) names.push(file.name)
    }
  }
  return names
}

function NewProjectForm({ defaultPath, onCreated, onCancel, initialName = '' }) {
  const [name, setName] = useState(initialName)
  const [year, setYear] = useState(new Date().getFullYear())
  const [stage, setStage] = useState('概念方案')
  const [path, setPath] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('请输入项目名称')
      return
    }
    setSaving(true)
    setError('')
    try {
      const body = { name: name.trim(), year, stage }
      if (path.trim()) {
        body.path = path.trim()
      } else if (defaultPath) {
        body.path = `${defaultPath}\\${name.trim()}`
      }
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `HTTP ${res.status}`)
      }
      const project = await res.json()
      onCreated(project)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="new-project-form" onSubmit={handleSubmit}>
      <h3>新建项目</h3>
      <div className="form-group">
        <label>项目名称 *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：广州白云党校"
          autoFocus
        />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>开始年份</label>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {yearOptions().map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>当前阶段</label>
          <select value={stage} onChange={(e) => setStage(e.target.value)}>
            {STAGE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label>项目路径</label>
        <input
          type="text"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder={defaultPath ? `${defaultPath}\\项目名称` : '默认使用配置中的项目根目录'}
        />
        <p className="form-hint">留空则自动使用：{defaultPath || '（未配置）'}</p>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>取消</button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? '创建中…' : '创建项目'}
        </button>
      </div>
    </form>
  )
}

function ProjectDetail({ project, onClose, onUpdate, onDelete }) {
  const [files, setFiles] = useState(project.files || [])
  const [stage, setStage] = useState(project.stage)
  const [dragOver, setDragOver] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setFiles(project.files || [])
    setStage(project.stage)
  }, [project])

  const saveFiles = async (updatedFiles) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: updatedFiles }),
      })
      if (!res.ok) throw new Error('保存失败')
      const updated = await res.json()
      setFiles(updated.files || [])
      onUpdate(updated)
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const handleStageChange = async (newStage) => {
    setStage(newStage)
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      })
      if (!res.ok) throw new Error('更新失败')
      const updated = await res.json()
      onUpdate(updated)
    } catch {
      setStage(project.stage)
    }
  }

  const handleFileFieldChange = (index, field, value) => {
    const next = files.map((f, i) => (i === index ? { ...f, [field]: value } : f))
    setFiles(next)
  }

  const handleFileFieldBlur = () => {
    saveFiles(files)
  }

  const addDroppedFiles = async (fileNames) => {
    if (!fileNames.length) return
    try {
      const res = await fetch(`/api/projects/${project.id}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: fileNames.map((name) => ({
            name,
            tag: '',
            uploaded: todayStr(),
            modified: '',
          })),
        }),
      })
      if (!res.ok) throw new Error('添加失败')
      const updated = await res.json()
      setFiles(updated.files || [])
      onUpdate(updated)
    } catch {
      // ignore
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const handleDrop = async (e) => {
    e.preventDefault()
    setDragOver(false)
    const items = Array.from(e.dataTransfer.items || [])
    if (items.length) {
      const names = await collectDroppedNames(items)
      await addDroppedFiles(names)
    } else {
      const raw = Array.from(e.dataTransfer.files || [])
      await addDroppedFiles(raw.map((f) => f.name))
    }
  }

  const openFolder = () => {
    if (window.electronAPI?.openPath && project.path) {
      window.electronAPI.openPath(project.path)
    }
  }

  const handleDelete = async () => {
    const msg = `确定删除项目「${project.name}」？（不会删除磁盘文件）`
    const confirmed = window.electronAPI?.showConfirmDialog
      ? await window.electronAPI.showConfirmDialog({
          title: '删除项目',
          message: msg,
          confirmText: '删除',
          cancelText: '取消',
        })
      : window.confirm(msg)
    if (!confirmed) return
    await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
    onDelete(project.id)
  }

  return (
    <div className="project-detail">
      <div className="project-detail-header">
        <h3>📁 {project.name}</h3>
        <button type="button" className="btn-icon" onClick={onClose} title="关闭">✕</button>
      </div>
      <div className="project-detail-meta">
        <span>{project.year}</span>
        <span>·</span>
        <select
          className="stage-select"
          value={stage}
          onChange={(e) => handleStageChange(e.target.value)}
        >
          {STAGE_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span>·</span>
        <span>{files.length} 文件</span>
      </div>
      {project.path && (
        <p className="project-detail-path">
          <code>{project.path}</code>
          {window.electronAPI?.openPath && (
            <button type="button" className="btn-link" onClick={openFolder}>打开文件夹</button>
          )}
        </p>
      )}

      <div
        className={`project-drop-zone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <p>拖放文件夹或文件到此处，自动记录名称与上传时间</p>
      </div>

      {files.length > 0 && (
        <div className="project-files-table">
          <table>
            <thead>
              <tr>
                <th>文件名</th>
                <th>标签</th>
                <th>上传日期</th>
                <th>修改日期</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file, idx) => (
                <tr key={`${file.name}-${idx}`}>
                  <td className="file-name-cell">{file.name}</td>
                  <td>
                    <select
                      value={file.tag || ''}
                      onChange={(e) => handleFileFieldChange(idx, 'tag', e.target.value)}
                      onBlur={handleFileFieldBlur}
                    >
                      {FILE_TAGS.map((t) => (
                        <option key={t} value={t}>{t || '无'}</option>
                      ))}
                    </select>
                  </td>
                  <td>{file.uploaded || '—'}</td>
                  <td>
                    <input
                      type="date"
                      value={file.modified || ''}
                      onChange={(e) => handleFileFieldChange(idx, 'modified', e.target.value)}
                      onBlur={handleFileFieldBlur}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {saving && <p className="saving-hint">保存中…</p>}

      <div className="project-detail-actions">
        <button type="button" className="btn-danger" onClick={handleDelete}>删除项目</button>
      </div>
    </div>
  )
}

function ProjectCard({ project, onClick, onDropFiles }) {
  const [dragOver, setDragOver] = useState(false)

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const items = Array.from(e.dataTransfer.items || [])
    let names = []
    if (items.length) {
      names = await collectDroppedNames(items)
    } else {
      names = Array.from(e.dataTransfer.files || []).map((f) => f.name)
    }
    if (names.length) onDropFiles(project.id, names)
  }

  const fileCount = (project.files || []).length

  return (
    <div
      className={`project-card ${dragOver ? 'drag-over' : ''}`}
      onClick={() => onClick(project)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick(project)}
    >
      <h3>📁 {project.name}</h3>
      <div className="project-card-meta">
        <span>{project.year}</span>
        <span>·</span>
        <span className="stage">{project.stage}</span>
        <span>·</span>
        <span>{fileCount} 文件</span>
      </div>
    </div>
  )
}

function Dashboard({ commandTrigger }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [grouped, setGrouped] = useState({})
  const [defaultPath, setDefaultPath] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const [selectedProject, setSelectedProject] = useState(null)
  const [formInitial, setFormInitial] = useState({ name: '' })
  const lastTriggerNonce = useRef(0)

  const fetchProjects = useCallback(async () => {
    try {
      setError(null)
      const [projRes, cfgRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/projects/config'),
      ])
      if (!projRes.ok) throw new Error(`加载项目失败: HTTP ${projRes.status}`)
      const data = await projRes.json()
      setGrouped(data.grouped || {})
      if (cfgRes.ok) {
        const cfg = await cfgRes.json()
        setDefaultPath(cfg.default_project_path || '')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  useEffect(() => {
    if (!commandTrigger?.type) return
    if (commandTrigger.nonce === lastTriggerNonce.current) return
    lastTriggerNonce.current = commandTrigger.nonce

    if (commandTrigger.type === 'new-project') {
      setFormInitial({
        name: commandTrigger.projectName || '',
      })
      setShowNewForm(true)
      setSelectedProject(null)
    }
  }, [commandTrigger])

  const handleProjectCreated = (project) => {
    setShowNewForm(false)
    setSelectedProject(project)
    fetchProjects()
  }

  const handleProjectUpdate = (updated) => {
    setSelectedProject(updated)
    fetchProjects()
  }

  const handleProjectDelete = () => {
    setSelectedProject(null)
    fetchProjects()
  }

  const handleDropFiles = async (projectId, names) => {
    try {
      await fetch(`/api/projects/${projectId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: names.map((name) => ({
            name,
            tag: '',
            uploaded: todayStr(),
            modified: '',
          })),
        }),
      })
      fetchProjects()
      if (selectedProject?.id === projectId) {
        const res = await fetch(`/api/projects/${projectId}`)
        if (res.ok) setSelectedProject(await res.json())
      }
    } catch {
      // ignore
    }
  }

  if (loading) {
    return <div className="loading">加载项目…</div>
  }

  if (error) {
    return (
      <div className="error-state">
        <p>{error}</p>
        <button className="btn-primary" onClick={fetchProjects}>重试</button>
      </div>
    )
  }

  const totalProjects = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0)

  return (
    <div className="dashboard-lifecycle">
      <div className="dashboard-header">
        <div>
          <h2>项目仪表盘</h2>
          <p className="dashboard-subtitle">标识项目全生命周期管理器</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setFormInitial({ name: '' })
            setShowNewForm(true)
          }}
        >
          + 新建项目
        </button>
      </div>

      {showNewForm && (
        <div className="dashboard-modal-overlay" onClick={() => setShowNewForm(false)}>
          <div className="dashboard-modal" onClick={(e) => e.stopPropagation()}>
            <NewProjectForm
              defaultPath={defaultPath}
              initialName={formInitial.name}
              onCreated={handleProjectCreated}
              onCancel={() => setShowNewForm(false)}
            />
          </div>
        </div>
      )}

      {selectedProject && (
        <div className="dashboard-detail-panel">
          <ProjectDetail
            project={selectedProject}
            onClose={() => setSelectedProject(null)}
            onUpdate={handleProjectUpdate}
            onDelete={handleProjectDelete}
          />
        </div>
      )}

      {totalProjects === 0 ? (
        <div className="empty-state">
          <h2>暂无项目</h2>
          <p>点击「新建项目」开始管理您的标识设计项目</p>
          {defaultPath && (
            <p className="form-hint">默认项目目录：{defaultPath}</p>
          )}
        </div>
      ) : (
        GROUP_ORDER.map((groupName) => {
          const projects = grouped[groupName] || []
          if (!projects.length) return null
          return (
            <section key={groupName} className="project-group">
              <h3 className="project-group-title">
                {GROUP_ICONS[groupName]} {groupName}
                <span className="project-group-count">{projects.length}</span>
              </h3>
              <div className="project-group-list">
                {projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onClick={setSelectedProject}
                    onDropFiles={handleDropFiles}
                  />
                ))}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}

export default Dashboard

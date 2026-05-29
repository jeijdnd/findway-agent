import React, { useState, useEffect, useCallback, useRef } from 'react'
import { requestFileOperationPermission } from '../utils/filePermission'
import {
  DashboardCommandType,
  filterGrouped,
  findProjectByName,
  findProjectById,
  updateProjectStage,
  deleteProjectById,
  importScannedFolders,
} from '../api/dashboardCommands'

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

function displayYear(year) {
  return year == null || year === '' ? '未设置' : year
}

function displayStage(stage) {
  return stage || '未设置'
}

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

function ProjectContextMenu({ x, y, project, onClose, onAction }) {
  const ref = useRef(null)

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('mousedown', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const items = [
    { id: 'open', label: '查看详情' },
    { id: 'edit', label: '编辑项目' },
    ...(window.electronAPI?.openPath && project.path
      ? [{ id: 'folder', label: '打开文件夹' }]
      : []),
    { id: 'delete', label: '删除项目', danger: true },
  ]

  return (
    <div
      ref={ref}
      className="project-context-menu"
      style={{ top: y, left: x }}
      role="menu"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`project-context-menu-item ${item.danger ? 'danger' : ''}`}
          role="menuitem"
          onClick={() => {
            onAction(item.id, project)
            onClose()
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

function NewProjectForm({ defaultPath, onCreated, onCancel, initialName = '', initialPath = '' }) {
  const [name, setName] = useState(initialName)
  const [year, setYear] = useState(new Date().getFullYear())
  const [stage, setStage] = useState('概念方案')
  const [path, setPath] = useState(initialPath)
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

function EditProjectForm({ project, onSaved, onCancel }) {
  const [name, setName] = useState(project.name)
  const [year, setYear] = useState(project.year ?? new Date().getFullYear())
  const [stage, setStage] = useState(project.stage || '概念方案')
  const [path, setPath] = useState(project.path || '')
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
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          year: Number(year),
          stage,
          path: path.trim(),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || '保存失败')
      }
      onSaved(await res.json())
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="new-project-form" onSubmit={handleSubmit}>
      <h3>编辑项目</h3>
      <div className="form-group">
        <label>项目名称 *</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
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
        <input type="text" value={path} onChange={(e) => setPath(e.target.value)} />
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>取消</button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? '保存中…' : '保存'}
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
      const updated = await updateProjectStage(project.id, newStage)
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
    await deleteProjectById(project.id)
    onDelete(project.id)
  }

  return (
    <div className="project-detail">
      <div className="project-detail-header">
        <h3>📁 {project.name}</h3>
        <button type="button" className="btn-icon" onClick={onClose} title="关闭">✕</button>
      </div>
      <div className="project-detail-meta">
        <span>{displayYear(project.year)}</span>
        <span>·</span>
        <select
          className="stage-select"
          value={stage || ''}
          onChange={(e) => handleStageChange(e.target.value)}
        >
          {!stage && <option value="">未设置</option>}
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

function ProjectCard({
  project,
  onClick,
  onDropFiles,
  onStageChange,
  onContextMenu,
}) {
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
      onContextMenu={(e) => onContextMenu(e, project)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick(project)}
    >
      <h3>📁 {project.name}</h3>
      <div className="project-card-meta">
        <span>{displayYear(project.year)}</span>
        <span>·</span>
        <select
          className="stage-select stage-select-inline"
          value={project.stage || ''}
          title="快速切换阶段"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            e.stopPropagation()
            onStageChange(project.id, e.target.value)
          }}
        >
          {!project.stage && <option value="">未设置</option>}
          {STAGE_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
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
  const [allProjects, setAllProjects] = useState([])
  const [defaultPath, setDefaultPath] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const [editProject, setEditProject] = useState(null)
  const [selectedProject, setSelectedProject] = useState(null)
  const [formInitial, setFormInitial] = useState({ name: '' })
  const [filterQuery, setFilterQuery] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const [filterStage, setFilterStage] = useState('')
  const [contextMenu, setContextMenu] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [scanMessage, setScanMessage] = useState('')
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
      setAllProjects(data.projects || [])
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

  const resolveProject = useCallback(
    (projectId, projectName) => {
      if (projectId) {
        const byId = findProjectById(allProjects, projectId)
        if (byId) return byId
      }
      if (projectName) return findProjectByName(allProjects, projectName)
      return null
    },
    [allProjects]
  )

  const confirmDeleteProject = useCallback(async (project) => {
    const msg = `确定删除项目「${project.name}」？（不会删除磁盘文件）`
    const confirmed = window.electronAPI?.showConfirmDialog
      ? await window.electronAPI.showConfirmDialog({
          title: '删除项目',
          message: msg,
          confirmText: '删除',
          cancelText: '取消',
        })
      : window.confirm(msg)
    if (!confirmed) return false
    await deleteProjectById(project.id)
    if (selectedProject?.id === project.id) setSelectedProject(null)
    await fetchProjects()
    return true
  }, [fetchProjects, selectedProject])

  const handleStageChange = useCallback(async (projectId, stage) => {
    try {
      await updateProjectStage(projectId, stage)
      await fetchProjects()
      if (selectedProject?.id === projectId) {
        const res = await fetch(`/api/projects/${projectId}`)
        if (res.ok) setSelectedProject(await res.json())
      }
    } catch {
      // ignore
    }
  }, [fetchProjects, selectedProject])

  const handleScanDirectory = useCallback(async () => {
    const rootPath = defaultPath
    if (!rootPath) {
      setScanMessage('请先在设置中配置默认项目路径')
      return
    }
    setScanning(true)
    setScanMessage('')
    try {
      const perm = await requestFileOperationPermission(rootPath, 'scan')
      if (!perm.granted) {
        setScanMessage('扫描已取消')
        return
      }
      const scanRes = await fetch('/api/scanner/scan-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root_path: rootPath, permission_id: perm.permission_id }),
      })
      if (!scanRes.ok) {
        const err = await scanRes.json().catch(() => ({}))
        throw new Error(err.detail || '扫描失败')
      }
      const scanData = await scanRes.json()
      const folders = scanData.folders || []
      if (!folders.length) {
        setScanMessage('未发现新文件夹')
        return
      }
      const result = await importScannedFolders(folders)
      setScanMessage(`扫描完成：新增 ${result.added} 个，跳过 ${result.skipped} 个已存在项目`)
      await fetchProjects()
    } catch (err) {
      setScanMessage(err.message)
    } finally {
      setScanning(false)
    }
  }, [defaultPath, fetchProjects])

  useEffect(() => {
    if (!commandTrigger?.type) return
    if (commandTrigger.nonce === lastTriggerNonce.current) return
    lastTriggerNonce.current = commandTrigger.nonce

    const run = async () => {
      switch (commandTrigger.type) {
        case DashboardCommandType.NEW_PROJECT:
          setFormInitial({
            name: commandTrigger.projectName || '',
            path: commandTrigger.path || '',
          })
          setShowNewForm(true)
          setSelectedProject(null)
          break
        case DashboardCommandType.FILTER:
          setFilterQuery(commandTrigger.query || '')
          setFilterYear(commandTrigger.year ?? commandTrigger.filter_year ?? '')
          setFilterStage(commandTrigger.filterStage || commandTrigger.filter_stage || '')
          break
        case DashboardCommandType.SET_STAGE: {
          const target = resolveProject(commandTrigger.projectId, commandTrigger.projectName)
          if (target && commandTrigger.stage) {
            await handleStageChange(target.id, commandTrigger.stage)
          }
          break
        }
        case DashboardCommandType.OPEN_PROJECT: {
          const target = resolveProject(commandTrigger.projectId, commandTrigger.projectName)
          if (target) setSelectedProject(target)
          break
        }
        case DashboardCommandType.EDIT_PROJECT: {
          const target = resolveProject(commandTrigger.projectId, commandTrigger.projectName)
          if (target) setEditProject(target)
          break
        }
        case DashboardCommandType.DELETE_PROJECT: {
          const target = resolveProject(commandTrigger.projectId, commandTrigger.projectName)
          if (target) await confirmDeleteProject(target)
          break
        }
        case DashboardCommandType.SCAN:
          await handleScanDirectory()
          break
        default:
          break
      }
    }
    run()
  }, [commandTrigger, resolveProject, handleStageChange, confirmDeleteProject, handleScanDirectory])

  const handleProjectCreated = (project) => {
    setShowNewForm(false)
    setSelectedProject(project)
    fetchProjects()
  }

  const handleProjectUpdate = (updated) => {
    setSelectedProject(updated)
    setEditProject(null)
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

  const handleContextMenu = (e, project) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, project })
  }

  const handleContextAction = async (actionId, project) => {
    if (actionId === 'open') {
      setSelectedProject(project)
    } else if (actionId === 'edit') {
      setEditProject(project)
    } else if (actionId === 'folder' && window.electronAPI?.openPath) {
      window.electronAPI.openPath(project.path)
    } else if (actionId === 'delete') {
      await confirmDeleteProject(project)
    }
  }

  const filteredGrouped = filterGrouped(
    grouped,
    { query: filterQuery, year: filterYear, stage: filterStage },
    GROUP_ORDER
  )

  const totalFiltered = Object.values(filteredGrouped).reduce((sum, arr) => sum + arr.length, 0)
  const hasActiveFilter = filterQuery || filterYear !== '' || filterStage

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

  return (
    <div className="dashboard-lifecycle">
      <div className="dashboard-header">
        <div>
          <h2>项目仪表盘</h2>
          <p className="dashboard-subtitle">标识项目全生命周期管理器</p>
        </div>
        <div className="dashboard-header-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={handleScanDirectory}
            disabled={scanning || !defaultPath}
            title={defaultPath ? `扫描 ${defaultPath}` : '请先在设置中配置项目路径'}
          >
            {scanning ? '扫描中…' : '扫描目录'}
          </button>
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
      </div>

      {scanMessage && <p className="dashboard-scan-message">{scanMessage}</p>}

      <div className="dashboard-filter-bar">
        <input
          type="search"
          className="dashboard-filter-input"
          placeholder="搜索项目名称…"
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          aria-label="搜索项目"
        />
        <select
          className="dashboard-filter-select"
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value === '' ? '' : Number(e.target.value))}
          aria-label="按年份筛选"
        >
          <option value="">全部年份</option>
          {yearOptions().map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select
          className="dashboard-filter-select"
          value={filterStage}
          onChange={(e) => setFilterStage(e.target.value)}
          aria-label="按阶段筛选"
        >
          <option value="">全部阶段</option>
          {STAGE_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {hasActiveFilter && (
          <button
            type="button"
            className="btn-link dashboard-filter-clear"
            onClick={() => {
              setFilterQuery('')
              setFilterYear('')
              setFilterStage('')
            }}
          >
            清除筛选
          </button>
        )}
      </div>

      {showNewForm && (
        <div className="dashboard-modal-overlay" onClick={() => setShowNewForm(false)}>
          <div className="dashboard-modal" onClick={(e) => e.stopPropagation()}>
            <NewProjectForm
              defaultPath={defaultPath}
              initialName={formInitial.name}
              initialPath={formInitial.path || ''}
              onCreated={handleProjectCreated}
              onCancel={() => setShowNewForm(false)}
            />
          </div>
        </div>
      )}

      {editProject && (
        <div className="dashboard-modal-overlay" onClick={() => setEditProject(null)}>
          <div className="dashboard-modal" onClick={(e) => e.stopPropagation()}>
            <EditProjectForm
              project={editProject}
              onSaved={handleProjectUpdate}
              onCancel={() => setEditProject(null)}
            />
          </div>
        </div>
      )}

      {contextMenu && (
        <ProjectContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          project={contextMenu.project}
          onClose={() => setContextMenu(null)}
          onAction={handleContextAction}
        />
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

      {totalFiltered === 0 ? (
        <div className="empty-state">
          <h2>{hasActiveFilter ? '无匹配项目' : '暂无项目'}</h2>
          <p>
            {hasActiveFilter
              ? '尝试调整筛选条件'
              : '点击「新建项目」或「扫描目录」开始管理您的标识设计项目'}
          </p>
          {!hasActiveFilter && defaultPath && (
            <p className="form-hint">默认项目目录：{defaultPath}</p>
          )}
        </div>
      ) : (
        GROUP_ORDER.map((groupName) => {
          const projects = filteredGrouped[groupName] || []
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
                    onStageChange={handleStageChange}
                    onContextMenu={handleContextMenu}
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
export { DashboardCommandType, STAGE_OPTIONS }

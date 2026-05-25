import React, { useState, useEffect } from 'react'
import { requestFileOperationPermission } from '../utils/filePermission'

function Dashboard() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    project_type: '',
    buildings: '',
    notes: '',
  })

  const [showScanModal, setShowScanModal] = useState(false)
  const [scanPath, setScanPath] = useState('')
  const [scanLoading, setScanLoading] = useState(false)
  const [scanError, setScanError] = useState(null)
  const [scanResults, setScanResults] = useState(null)
  const [registeringPath, setRegisteringPath] = useState(null)
  const [scanMessage, setScanMessage] = useState('')

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

  const openScanModal = async () => {
    setShowScanModal(true)
    setScanError(null)
    setScanResults(null)
    setScanMessage('')
    if (scanPath) return
    try {
      const res = await fetch('/api/scanner/config')
      if (res.ok) {
        const cfg = await res.json()
        const dirs = cfg.watch_dirs || []
        if (dirs.length > 0) {
          setScanPath(dirs[0])
        }
      }
    } catch {
      // 忽略，用户可手动输入
    }
  }

  const closeScanModal = () => {
    setShowScanModal(false)
    setScanError(null)
    setScanResults(null)
    setScanMessage('')
  }

  const runScan = async () => {
    const root = scanPath.trim()
    if (!root) {
      setScanError('请输入要扫描的目录路径')
      return
    }
    try {
      setScanLoading(true)
      setScanError(null)
      setScanResults(null)
      setScanMessage('')

      const permission = await requestFileOperationPermission(root, 'scan')
      if (!permission.granted) {
        setScanError(permission.message || '您已拒绝此操作，已取消。')
        return
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000)

      const response = await fetch('/api/scanner/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          root_path: root,
          quick: false,
          permission_id: permission.permission_id,
        }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || errData.message || `HTTP ${response.status}`)
      }
      const data = await response.json()
      setScanResults(data)
    } catch (err) {
      if (err.name === 'AbortError') {
        setScanError('扫描超时，目录可能过大，请缩小范围后重试')
      } else {
        setScanError('扫描失败: ' + err.message)
      }
    } finally {
      setScanLoading(false)
    }
  }

  const registerScannedProject = async (item) => {
    try {
      setRegisteringPath(item.path)
      setScanMessage('')

      const permission = await requestFileOperationPermission(item.path, 'write')
      if (!permission.granted) {
        setScanMessage(permission.message || '您已拒绝注册操作，已取消。')
        return
      }

      const response = await fetch('/api/scanner/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: item.name,
          path: item.path,
          notes: `扫描注册，目录：${item.path}`,
          permission_id: permission.permission_id,
        }),
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || errData.message || `HTTP ${response.status}`)
      }
      setScanMessage(`已注册项目「${item.name}」`)
      await fetchProjects()
      setTimeout(() => setScanMessage(''), 3000)
    } catch (err) {
      setScanMessage('注册失败: ' + err.message)
    } finally {
      setRegisteringPath(null)
    }
  }

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
          buildings: formData.buildings.split(',').map((b) => b.trim()).filter(Boolean),
          notes: formData.notes,
        }),
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

  const isProjectRegistered = (item) => {
    return projects.some(
      (p) => p.name === item.name || (p.notes && p.notes.includes(item.path))
    )
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
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn-primary"
            onClick={openScanModal}
            style={{ background: '#6b7280' }}
          >
            扫描目录
          </button>
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? '取消' : '+ 新建项目'}
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          style={{
            background: 'white',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '16px',
            border: '1px solid var(--border)',
          }}
        >
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
          <button type="submit" className="btn-primary">
            创建项目
          </button>
        </form>
      )}

      {projects.length === 0 ? (
        <div className="empty-state">
          <h2>暂无项目</h2>
          <p>点击上方「新建项目」或「扫描目录」发现本地项目</p>
        </div>
      ) : (
        projects.map((project) => (
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

      {showScanModal && (
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
          onClick={closeScanModal}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '10px',
              padding: '20px',
              width: '100%',
              maxWidth: '560px',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '16px', margin: '0 0 12px 0' }}>扫描目录</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>
              自动发现含 Excel 清单（.xlsx）的项目文件夹，只读扫描不修改文件
            </p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input
                type="text"
                value={scanPath}
                onChange={(e) => setScanPath(e.target.value)}
                placeholder="例如：E:\projects"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
                onKeyPress={(e) => e.key === 'Enter' && runScan()}
              />
              <button className="btn-primary" onClick={runScan} disabled={scanLoading}>
                {scanLoading ? '扫描中...' : '开始扫描'}
              </button>
            </div>

            {scanMessage && (
              <p
                style={{
                  fontSize: '13px',
                  margin: '0 0 12px 0',
                  color: scanMessage.includes('失败') ? '#dc2626' : '#16a34a',
                }}
              >
                {scanMessage}
              </p>
            )}

            {scanLoading ? (
              <div className="loading" style={{ padding: '24px 0' }}>
                正在扫描目录...
              </div>
            ) : scanError ? (
              <div className="error-state" style={{ padding: '12px 0' }}>
                <p style={{ margin: '0 0 12px 0' }}>{scanError}</p>
                <button className="btn-primary" onClick={runScan}>
                  重试
                </button>
              </div>
            ) : scanResults ? (
              scanResults.projects?.length === 0 ? (
                <div className="empty-state" style={{ padding: '16px 0' }}>
                  <p style={{ margin: 0 }}>未发现项目目录（需包含 .xlsx 清单文件）</p>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>
                    共发现 {scanResults.count} 个项目
                  </p>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {scanResults.projects.map((item) => {
                      const registered = isProjectRegistered(item)
                      return (
                        <div
                          key={item.path}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px 12px',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            background: '#fafafa',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '14px', fontWeight: 600 }}>{item.name}</div>
                            <div
                              style={{
                                fontSize: '12px',
                                color: 'var(--text-secondary)',
                                wordBreak: 'break-all',
                              }}
                            >
                              {item.path}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              {item.file_count} 个 Excel 文件
                            </div>
                          </div>
                          <button
                            className="btn-primary"
                            onClick={() => registerScannedProject(item)}
                            disabled={registered || registeringPath === item.path}
                            style={{
                              flexShrink: 0,
                              background: registered ? '#9ca3af' : undefined,
                              fontSize: '13px',
                              padding: '6px 12px',
                            }}
                          >
                            {registeringPath === item.path
                              ? '注册中...'
                              : registered
                                ? '已注册'
                                : '注册'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            ) : (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                输入目录路径后点击「开始扫描」
              </p>
            )}

            <div style={{ marginTop: '16px', textAlign: 'right' }}>
              <button
                type="button"
                onClick={closeScanModal}
                style={{
                  padding: '8px 16px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  background: 'white',
                  cursor: 'pointer',
                }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard

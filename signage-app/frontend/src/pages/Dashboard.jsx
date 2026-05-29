import React, { useState, useEffect, useCallback } from 'react'
import { requestFileOperationPermission } from '../utils/filePermission'

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function confirmDelete(fileName) {
  const message = `确定要删除文件「${fileName}」吗？此操作不可撤销。`
  if (window.electronAPI?.showConfirmDialog) {
    return window.electronAPI.showConfirmDialog({
      title: '删除文件',
      message,
      confirmText: '删除',
      cancelText: '取消',
    })
  }
  return window.confirm(message)
}

function FolderTreeNode({
  node,
  permissionId,
  depth = 0,
  onChildrenChange,
}) {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [actionMessage, setActionMessage] = useState('')

  const loadChildren = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/scanner/browse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: node.path, permission_id: permissionId }),
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || errData.message || `HTTP ${response.status}`)
      }
      const data = await response.json()
      setChildren(data)
      return data
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }, [node.path, permissionId])

  const toggleExpand = async () => {
    if (!expanded && !children) {
      await loadChildren()
    }
    setExpanded((prev) => !prev)
  }

  const refreshChildren = async () => {
    const data = await loadChildren()
    if (data && onChildrenChange) {
      onChildrenChange(node.path, data)
    }
  }

  const openFile = async (file) => {
    if (window.electronAPI?.openPath) {
      const result = await window.electronAPI.openPath(file.path)
      if (!result.success && result.error) {
        setActionMessage(`无法打开: ${result.error}`)
        setTimeout(() => setActionMessage(''), 3000)
      }
    } else {
      setActionMessage('请在桌面应用中打开文件')
      setTimeout(() => setActionMessage(''), 3000)
    }
  }

  const deleteFile = async (file) => {
    const confirmed = await confirmDelete(file.name)
    if (!confirmed) return

    try {
      setActionMessage('')
      const permission = await requestFileOperationPermission(node.path, 'write')
      if (!permission.granted) {
        setActionMessage(permission.message || '已取消删除')
        return
      }

      const response = await fetch('/api/files/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: file.path,
          permission_id: permission.permission_id,
        }),
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || errData.message || `HTTP ${response.status}`)
      }
      await refreshChildren()
    } catch (err) {
      setActionMessage(`删除失败: ${err.message}`)
    }
  }

  const uploadFiles = async (fileList) => {
    if (!fileList?.length) return
    try {
      setUploading(true)
      setActionMessage('')
      const permission = await requestFileOperationPermission(node.path, 'write')
      if (!permission.granted) {
        setActionMessage(permission.message || '已取消上传')
        return
      }

      for (const file of fileList) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('target_dir', node.path)
        formData.append('permission_id', permission.permission_id)
        const response = await fetch('/api/files/upload', { method: 'POST', body: formData })
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          throw new Error(errData.detail || errData.message || `上传 ${file.name} 失败`)
        }
      }
      if (expanded) {
        await refreshChildren()
      } else {
        setExpanded(true)
        await refreshChildren()
      }
      setActionMessage(`已上传 ${fileList.length} 个文件`)
      setTimeout(() => setActionMessage(''), 2500)
    } catch (err) {
      setActionMessage(err.message)
    } finally {
      setUploading(false)
    }
  }

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

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    uploadFiles(Array.from(e.dataTransfer.files))
  }

  return (
    <div className="file-tree-node">
      <div
        className={`file-tree-row ${dragOver ? 'drag-over' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <button
          type="button"
          className="file-tree-toggle"
          onClick={toggleExpand}
          aria-label={expanded ? '收起' : '展开'}
        >
          {loading ? '…' : expanded ? '▼' : '▶'}
        </button>
        <span className="file-tree-icon">📁</span>
        <span className="file-tree-name" onClick={toggleExpand} role="presentation">
          {node.name}
        </span>
        <span className="file-tree-count">{node.file_count} 个文件</span>
        {uploading && <span className="file-tree-action-hint">上传中…</span>}
      </div>

      {actionMessage && (
        <p
          className="file-tree-message"
          style={{ paddingLeft: `${depth * 16 + 32}px` }}
        >
          {actionMessage}
        </p>
      )}

      {expanded && error && (
        <p className="file-tree-error" style={{ paddingLeft: `${depth * 16 + 32}px` }}>
          {error}
        </p>
      )}

      {expanded && children && (
        <div className="file-tree-children">
          {children.folders?.map((folder) => (
            <FolderTreeNode
              key={folder.path}
              node={folder}
              permissionId={permissionId}
              depth={depth + 1}
              onChildrenChange={onChildrenChange}
            />
          ))}
          {children.files?.map((file) => (
            <div
              key={file.path}
              className="file-tree-row file-tree-file-row"
              style={{ paddingLeft: `${(depth + 1) * 16 + 28}px` }}
            >
              <span className="file-tree-icon">📄</span>
              <button
                type="button"
                className="file-tree-file-btn"
                onClick={() => openFile(file)}
                title={file.path}
              >
                {file.name}
              </button>
              <span className="file-tree-size">{formatFileSize(file.size)}</span>
              <button
                type="button"
                className="file-tree-delete-btn"
                onClick={() => deleteFile(file)}
                title="删除文件"
              >
                ✕
              </button>
            </div>
          ))}
          {!loading &&
            !children.folders?.length &&
            !children.files?.length && (
              <p
                className="file-tree-empty"
                style={{ paddingLeft: `${(depth + 1) * 16 + 28}px` }}
              >
                空文件夹 — 拖放文件到此处上传
              </p>
            )}
        </div>
      )}
    </div>
  )
}

function Dashboard({ commandTrigger }) {
  const [rootPath, setRootPath] = useState('')
  const [scanLoading, setScanLoading] = useState(false)
  const [scanError, setScanError] = useState(null)
  const [folders, setFolders] = useState([])
  const [permissionId, setPermissionId] = useState(null)
  const [scannedRoot, setScannedRoot] = useState('')
  const [configLoaded, setConfigLoaded] = useState(false)

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch('/api/scanner/config')
        if (res.ok) {
          const cfg = await res.json()
          const dirs = cfg.watch_dirs || []
          if (dirs.length > 0 && !rootPath) {
            setRootPath(dirs[0])
          }
        }
      } catch {
        // 用户可手动输入
      } finally {
        setConfigLoaded(true)
      }
    }
    loadConfig()
  }, [])

  useEffect(() => {
    if (!commandTrigger?.type) return
    if (commandTrigger.type === 'scan') {
      if (commandTrigger.path) {
        setRootPath(commandTrigger.path)
      }
      runScan(commandTrigger.path || rootPath)
    }
  }, [commandTrigger])

  const runScan = async (pathOverride) => {
    const root = (pathOverride || rootPath).trim()
    if (!root) {
      setScanError('请输入要扫描的目录路径')
      return
    }

    try {
      setScanLoading(true)
      setScanError(null)
      setFolders([])

      const permission = await requestFileOperationPermission(root, 'scan')
      if (!permission.granted) {
        setScanError(permission.message || '您已拒绝此操作，已取消。')
        return
      }

      setPermissionId(permission.permission_id)

      const response = await fetch('/api/scanner/scan-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          root_path: root,
          permission_id: permission.permission_id,
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || errData.message || `HTTP ${response.status}`)
      }

      const data = await response.json()
      setFolders(data.folders || [])
      setScannedRoot(data.root_path || root)
    } catch (err) {
      setScanError(`扫描失败: ${err.message}`)
    } finally {
      setScanLoading(false)
    }
  }

  if (!configLoaded) {
    return <div className="loading">加载中...</div>
  }

  return (
    <div className="dashboard-file-browser">
      <div className="dashboard-header">
        <h2>项目仪表盘</h2>
        <p className="dashboard-subtitle">浏览项目文件夹，拖放上传或管理系统中的文件</p>
      </div>

      <div className="dashboard-scan-bar">
        <input
          type="text"
          value={rootPath}
          onChange={(e) => setRootPath(e.target.value)}
          placeholder="例如：E:\MingRui\_项目文件"
          className="dashboard-path-input"
          onKeyDown={(e) => e.key === 'Enter' && runScan()}
        />
        <button
          className="btn-primary"
          onClick={() => runScan()}
          disabled={scanLoading}
        >
          {scanLoading ? '扫描中...' : '扫描目录'}
        </button>
      </div>

      {scanError && (
        <div className="error-state" style={{ padding: '12px 0' }}>
          <p style={{ margin: '0 0 8px 0' }}>{scanError}</p>
          <button className="btn-primary" onClick={() => runScan()}>
            重试
          </button>
        </div>
      )}

      {scannedRoot && !scanError && (
        <p className="dashboard-root-label">
          根目录：<code>{scannedRoot}</code>
          {folders.length > 0 && ` · 共 ${folders.length} 个项目文件夹`}
        </p>
      )}

      {scanLoading ? (
        <div className="loading">正在扫描目录...</div>
      ) : folders.length === 0 && scannedRoot && !scanError ? (
        <div className="empty-state">
          <h2>暂无项目文件夹</h2>
          <p>该目录下没有子文件夹，请检查路径是否正确</p>
        </div>
      ) : folders.length > 0 ? (
        <div className="file-tree">
          {folders.map((folder) => (
            <FolderTreeNode
              key={folder.path}
              node={folder}
              permissionId={permissionId}
              depth={0}
            />
          ))}
        </div>
      ) : (
        !scanError && (
          <div className="empty-state">
            <h2>开始浏览项目文件</h2>
            <p>输入目录路径后点击「扫描目录」，将显示第一层项目文件夹</p>
          </div>
        )
      )}
    </div>
  )
}

export default Dashboard

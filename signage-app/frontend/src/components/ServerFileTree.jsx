import React, { useState, useEffect, useCallback } from 'react'
import { browseServerPath, downloadServerFile, formatFileSize } from '../api/localServer'

function FileRow({ file, depth, permissionId, onError }) {
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async (e) => {
    e.stopPropagation()
    if (!permissionId) return
    setDownloading(true)
    try {
      await downloadServerFile(file.path, permissionId)
    } catch (err) {
      onError?.(err.message)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="server-tree-row server-tree-file" style={{ '--tree-depth': depth }}>
      <div className="server-tree-name-col">
        <span className="file-tree-toggle file-tree-toggle-spacer" aria-hidden="true" />
        <span className="file-tree-icon" aria-hidden="true">📄</span>
        <span className="server-tree-label" title={file.path}>{file.name}</span>
        <span className="server-tree-size">{formatFileSize(file.size)}</span>
        <button
          type="button"
          className="server-tree-download-btn"
          onClick={handleDownload}
          disabled={downloading}
          title="下载到本地"
        >
          {downloading ? '…' : '↓'}
        </button>
      </div>
    </div>
  )
}

function FolderNode({ folder, depth, permissionId, onError }) {
  const [expanded, setExpanded] = useState(depth < 1)
  const [children, setChildren] = useState(null)
  const [loading, setLoading] = useState(false)

  const loadChildren = useCallback(async () => {
    if (children !== null) return children
    setLoading(true)
    try {
      const data = await browseServerPath(folder.path, permissionId)
      const result = { folders: data.folders || [], files: data.files || [], permission_id: data.permission_id }
      setChildren(result)
      return result
    } catch (err) {
      onError?.(err.message)
      setChildren({ folders: [], files: [] })
      return { folders: [], files: [] }
    } finally {
      setLoading(false)
    }
  }, [children, folder.path, permissionId, onError])

  useEffect(() => {
    if (expanded && children === null) loadChildren()
  }, [expanded, children, loadChildren])

  const handleToggle = () => setExpanded((v) => !v)
  const activePermission = children?.permission_id || permissionId

  return (
    <>
      <div
        className="server-tree-row server-tree-folder"
        style={{ '--tree-depth': depth }}
        onClick={handleToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleToggle()
          }
        }}
      >
        <div className="server-tree-name-col">
          <span className="file-tree-toggle" aria-hidden="true">
            {loading ? '…' : expanded ? '▼' : '▶'}
          </span>
          <span className="file-tree-icon" aria-hidden="true">
            {expanded ? '📂' : '📁'}
          </span>
          <span className="server-tree-label">{folder.name}</span>
          {folder.file_count != null && (
            <span className="file-tree-folder-count">{folder.file_count}</span>
          )}
        </div>
      </div>
      {expanded && children && (
        <>
          {children.folders.map((f) => (
            <FolderNode
              key={f.path}
              folder={f}
              depth={depth + 1}
              permissionId={activePermission}
              onError={onError}
            />
          ))}
          {children.files.map((file) => (
            <FileRow
              key={file.path}
              file={file}
              depth={depth + 1}
              permissionId={activePermission}
              onError={onError}
            />
          ))}
          {!loading && !children.folders.length && !children.files.length && (
            <div className="server-tree-empty-folder" style={{ '--tree-depth': depth + 1 }}>
              空文件夹
            </div>
          )}
        </>
      )}
    </>
  )
}

export default function ServerFileTree({ rootPath, onError }) {
  const [rootData, setRootData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [permissionId, setPermissionId] = useState(null)

  const loadRoot = useCallback(async () => {
    setLoading(true)
    try {
      const data = await browseServerPath(rootPath)
      setRootData({ folders: data.folders || [], files: data.files || [] })
      setPermissionId(data.permission_id)
    } catch (err) {
      onError?.(err.message)
      setRootData({ folders: [], files: [] })
    } finally {
      setLoading(false)
    }
  }, [rootPath, onError])

  useEffect(() => {
    loadRoot()
  }, [loadRoot])

  if (loading) {
    return <div className="server-tree-loading">正在连接服务器…</div>
  }

  if (!rootData) {
    return <div className="server-tree-empty">无法加载目录</div>
  }

  return (
    <div className="server-files-tree">
      <div className="server-tree-root-label">
        <code>{rootPath}</code>
      </div>
      <div className="file-tree-body">
        {rootData.folders.map((folder) => (
          <FolderNode
            key={folder.path}
            folder={folder}
            depth={0}
            permissionId={permissionId}
            onError={onError}
          />
        ))}
        {rootData.files.map((file) => (
          <FileRow
            key={file.path}
            file={file}
            depth={0}
            permissionId={permissionId}
            onError={onError}
          />
        ))}
        {!rootData.folders.length && !rootData.files.length && (
          <div className="server-tree-empty">目录为空</div>
        )}
      </div>
    </div>
  )
}

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import {
  buildFileTree,
  countFilesInFolder,
  getDefaultExpandedPaths,
  SORT_OPTIONS,
  DRAG_MIME,
} from '../utils/fileTree'
import {
  moveProjectFile,
  mkdirProjectFolder,
  deleteProjectFileItem,
  joinProjectPath,
  copyPathToClipboard,
} from '../api/projectFiles'

const FILE_TAGS = ['', '初稿', '审图版', '最终版', '施工图', '竣工图']

async function confirmAction(title, message) {
  if (window.electronAPI?.showConfirmDialog) {
    return window.electronAPI.showConfirmDialog({
      title,
      message,
      confirmText: '确定',
      cancelText: '取消',
    })
  }
  return window.confirm(`${title}\n\n${message}`)
}

function FileTreeContextMenu({ x, y, items, onClose }) {
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

  return (
    <div
      ref={ref}
      className="project-context-menu file-tree-context-menu"
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
            item.onClick()
            onClose()
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

function DeleteButton({ onClick, title = '删除' }) {
  return (
    <button
      type="button"
      className="file-tree-delete-btn"
      title={title}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      ✕
    </button>
  )
}

function FolderRow({
  node,
  depth,
  expanded,
  onToggle,
  dropTarget,
  onDragOverFolder,
  onDragLeaveFolder,
  onDropOnFolder,
  onContextMenu,
  onDelete,
}) {
  const isExpanded = expanded.has(node.path)
  const fileCount = countFilesInFolder(node)
  const isDropTarget = dropTarget === node.path

  return (
    <div
      className={`file-tree-row file-tree-folder ${isDropTarget ? 'drop-target' : ''}`}
      style={{ '--tree-depth': depth }}
      onClick={() => onToggle(node.path)}
      onContextMenu={(e) => onContextMenu(e, node)}
      onDragOver={(e) => onDragOverFolder(e, node.path)}
      onDragLeave={onDragLeaveFolder}
      onDrop={(e) => onDropOnFolder(e, node.path)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle(node.path)
        }
      }}
    >
      <div className="file-tree-name-col">
        <span className="file-tree-toggle" aria-hidden="true">
          {isExpanded ? '▼' : '▶'}
        </span>
        <span className="file-tree-icon" aria-hidden="true">
          {isExpanded ? '📂' : '📁'}
        </span>
        <span className="file-tree-label">{node.name}</span>
        <span className="file-tree-folder-count">{fileCount}</span>
        <DeleteButton onClick={() => onDelete(node)} title="删除文件夹" />
      </div>
      <div className="file-tree-col" />
      <div className="file-tree-col" />
      <div className="file-tree-col" />
    </div>
  )
}

function FileRow({
  node,
  depth,
  file,
  onFieldChange,
  onFieldBlur,
  onContextMenu,
  onDelete,
  onDragStartFile,
  onDragEndFile,
}) {
  return (
    <div
      className="file-tree-row file-tree-file"
      style={{ '--tree-depth': depth }}
      draggable
      onDragStart={(e) => onDragStartFile(e, node.path)}
      onDragEnd={onDragEndFile}
      onContextMenu={(e) => onContextMenu(e, node)}
    >
      <div className="file-tree-name-col">
        <span className="file-tree-toggle file-tree-toggle-spacer" aria-hidden="true" />
        <span className="file-tree-icon" aria-hidden="true">📄</span>
        <span className="file-tree-label" title={node.path}>{node.name}</span>
        <DeleteButton onClick={() => onDelete(node)} title="删除文件" />
      </div>
      <div className="file-tree-col">
        <select
          value={file.tag || ''}
          onChange={(e) => onFieldChange(node.fileIndex, 'tag', e.target.value)}
          onBlur={onFieldBlur}
          onClick={(e) => e.stopPropagation()}
        >
          {FILE_TAGS.map((t) => (
            <option key={t} value={t}>{t || '无'}</option>
          ))}
        </select>
      </div>
      <div className="file-tree-col file-tree-date">{file.uploaded || '—'}</div>
      <div className="file-tree-col">
        <input
          type="date"
          value={file.modified || ''}
          onChange={(e) => onFieldChange(node.fileIndex, 'modified', e.target.value)}
          onBlur={onFieldBlur}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  )
}

function TreeNodes({
  nodes,
  depth,
  files,
  expanded,
  dropTarget,
  onToggle,
  onFieldChange,
  onFieldBlur,
  onContextMenu,
  onDelete,
  onDragStartFile,
  onDragEndFile,
  onDragOverFolder,
  onDragLeaveFolder,
  onDropOnFolder,
}) {
  return nodes.map((node) => {
    if (node.type === 'folder') {
      const isExpanded = expanded.has(node.path)
      return (
        <React.Fragment key={node.path}>
          <FolderRow
            node={node}
            depth={depth}
            expanded={expanded}
            onToggle={onToggle}
            dropTarget={dropTarget}
            onDragOverFolder={onDragOverFolder}
            onDragLeaveFolder={onDragLeaveFolder}
            onDropOnFolder={onDropOnFolder}
            onContextMenu={onContextMenu}
            onDelete={onDelete}
          />
          {isExpanded && (
            <TreeNodes
              nodes={node.children}
              depth={depth + 1}
              files={files}
              expanded={expanded}
              dropTarget={dropTarget}
              onToggle={onToggle}
              onFieldChange={onFieldChange}
              onFieldBlur={onFieldBlur}
              onContextMenu={onContextMenu}
              onDelete={onDelete}
              onDragStartFile={onDragStartFile}
              onDragEndFile={onDragEndFile}
              onDragOverFolder={onDragOverFolder}
              onDragLeaveFolder={onDragLeaveFolder}
              onDropOnFolder={onDropOnFolder}
            />
          )}
        </React.Fragment>
      )
    }

    const file = files[node.fileIndex]
    return (
      <FileRow
        key={node.path}
        node={node}
        depth={depth}
        file={file}
        onFieldChange={onFieldChange}
        onFieldBlur={onFieldBlur}
        onContextMenu={onContextMenu}
        onDelete={onDelete}
        onDragStartFile={onDragStartFile}
        onDragEndFile={onDragEndFile}
      />
    )
  })
}

export default function ProjectFileTree({
  projectId,
  projectPath,
  files,
  folders = [],
  onFieldChange,
  onFieldBlur,
  onFilesChanged,
}) {
  const [sortBy, setSortBy] = useState('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [contextMenu, setContextMenu] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')

  const tree = useMemo(
    () => buildFileTree(files, sortBy, sortAsc, folders),
    [files, folders, sortBy, sortAsc],
  )
  const [expanded, setExpanded] = useState(() => getDefaultExpandedPaths(tree))

  useEffect(() => {
    setExpanded(getDefaultExpandedPaths(tree))
  }, [tree])

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(''), 2000)
    return () => clearTimeout(t)
  }, [toast])

  const canOperate = Boolean(projectId && projectPath)

  const applyResult = useCallback(async (promise) => {
    setBusy(true)
    try {
      const updated = await promise
      onFilesChanged?.(updated)
    } catch (err) {
      setToast(err.message || '操作失败')
    } finally {
      setBusy(false)
    }
  }, [onFilesChanged])

  const handleToggle = (path) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const promptFolderName = () => {
    const name = window.prompt('请输入文件夹名称：')
    if (!name) return null
    const trimmed = name.trim().replace(/[/\\]/g, '')
    if (!trimmed) return null
    return trimmed
  }

  const handleMkdir = async (parentPath) => {
    if (!canOperate) return
    const folderName = promptFolderName()
    if (!folderName) return
    const folder = parentPath ? `${parentPath}/${folderName}` : folderName
    await applyResult(mkdirProjectFolder(projectId, projectPath, folder))
    setExpanded((prev) => {
      const next = new Set(prev)
      next.add(parentPath || folder)
      if (parentPath) next.add(folder)
      return next
    })
  }

  const handleDelete = async (node) => {
    if (!canOperate) return
    const isFolder = node.type === 'folder'
    const label = isFolder ? `文件夹「${node.name}」及其内容` : `文件「${node.name}」`
    const ok = await confirmAction('删除确认', `确定删除${label}？此操作将删除磁盘上的文件且不可恢复。`)
    if (!ok) return
    await applyResult(deleteProjectFileItem(projectId, projectPath, node.path))
  }

  const handleCopyPath = async (node) => {
    const full = joinProjectPath(projectPath, node.path)
    try {
      await copyPathToClipboard(full)
      setToast('路径已复制')
    } catch {
      setToast('复制失败')
    }
  }

  const handleMove = async (sourcePath, destFolder) => {
    if (!canOperate || !sourcePath) return
    const srcParent = sourcePath.includes('/') ? sourcePath.slice(0, sourcePath.lastIndexOf('/')) : ''
    if (srcParent === destFolder) return
    await applyResult(moveProjectFile(projectId, projectPath, sourcePath, destFolder))
    if (destFolder) {
      setExpanded((prev) => new Set([...prev, destFolder]))
    }
  }

  const getParentPath = (node) => {
    if (node.type === 'folder') return node.path
    const idx = node.path.lastIndexOf('/')
    return idx >= 0 ? node.path.slice(0, idx) : ''
  }

  const openContextMenu = (e, node) => {
    e.preventDefault()
    e.stopPropagation()
    const parentPath = getParentPath(node)
    const items = [
      { id: 'copy', label: '复制路径', onClick: () => handleCopyPath(node) },
      { id: 'mkdir', label: '新建文件夹', onClick: () => handleMkdir(parentPath) },
      { id: 'delete', label: '删除', danger: true, onClick: () => handleDelete(node) },
    ]
    setContextMenu({ x: e.clientX, y: e.clientY, items })
  }

  const handleBodyContextMenu = (e) => {
    if (!canOperate) return
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { id: 'mkdir', label: '新建文件夹', onClick: () => handleMkdir('') },
      ],
    })
  }

  const handleDragStartFile = (e, path) => {
    e.stopPropagation()
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ path }))
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEndFile = () => setDropTarget(null)

  const handleDragOverFolder = (e, folderPath) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget(folderPath)
  }

  const handleDragLeaveFolder = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDropTarget(null)
    }
  }

  const handleDropOnFolder = async (e, folderPath) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return
    e.preventDefault()
    e.stopPropagation()
    setDropTarget(null)
    try {
      const { path } = JSON.parse(e.dataTransfer.getData(DRAG_MIME))
      await handleMove(path, folderPath)
    } catch {
      // ignore
    }
  }

  const handleRootDrop = async (e) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return
    e.preventDefault()
    e.stopPropagation()
    setDropTarget(null)
    try {
      const { path } = JSON.parse(e.dataTransfer.getData(DRAG_MIME))
      await handleMove(path, '')
    } catch {
      // ignore
    }
  }

  const handleSortClick = (id) => {
    if (sortBy === id) setSortAsc((v) => !v)
    else {
      setSortBy(id)
      setSortAsc(id === 'name')
    }
  }

  return (
    <div className={`project-files-tree ${busy ? 'is-busy' : ''}`}>
      <div className="file-tree-toolbar">
        <span className="file-tree-toolbar-label">排序</span>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`file-tree-sort-btn ${sortBy === opt.id ? 'active' : ''}`}
            onClick={() => handleSortClick(opt.id)}
          >
            {opt.label}
            {sortBy === opt.id && (sortAsc ? ' ↑' : ' ↓')}
          </button>
        ))}
        {toast && <span className="file-tree-toast">{toast}</span>}
      </div>

      <div className="file-tree-header">
        <div className="file-tree-name-col">名称</div>
        <div className="file-tree-col">标签</div>
        <div className="file-tree-col">上传日期</div>
        <div className="file-tree-col">修改日期</div>
      </div>

      <div
        className={`file-tree-body ${dropTarget === '' ? 'drop-target' : ''}`}
        onContextMenu={handleBodyContextMenu}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes(DRAG_MIME)) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setDropTarget('')
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setDropTarget(null)
        }}
        onDrop={handleRootDrop}
      >
        {tree.children.length === 0 ? (
          <div className="file-tree-empty">暂无文件，可拖入文件或右键新建文件夹</div>
        ) : (
          <TreeNodes
            nodes={tree.children}
            depth={0}
            files={files}
            expanded={expanded}
            dropTarget={dropTarget}
            onToggle={handleToggle}
            onFieldChange={onFieldChange}
            onFieldBlur={onFieldBlur}
            onContextMenu={openContextMenu}
            onDelete={handleDelete}
            onDragStartFile={handleDragStartFile}
            onDragEndFile={handleDragEndFile}
            onDragOverFolder={handleDragOverFolder}
            onDragLeaveFolder={handleDragLeaveFolder}
            onDropOnFolder={handleDropOnFolder}
          />
        )}
      </div>

      {contextMenu && (
        <FileTreeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}

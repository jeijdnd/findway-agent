import React, { useMemo, useState, useEffect } from 'react'
import { buildFileTree, countFilesInFolder, getDefaultExpandedPaths } from '../utils/fileTree'

const FILE_TAGS = ['', '初稿', '审图版', '最终版', '施工图', '竣工图']

function FolderRow({ node, depth, expanded, onToggle }) {
  const isExpanded = expanded.has(node.path)
  const fileCount = countFilesInFolder(node)

  return (
    <div
      className="file-tree-row file-tree-folder"
      style={{ '--tree-depth': depth }}
      onClick={() => onToggle(node.path)}
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
      </div>
      <div className="file-tree-col" />
      <div className="file-tree-col" />
      <div className="file-tree-col" />
    </div>
  )
}

function FileRow({ node, depth, file, onFieldChange, onFieldBlur }) {
  return (
    <div className="file-tree-row file-tree-file" style={{ '--tree-depth': depth }}>
      <div className="file-tree-name-col">
        <span className="file-tree-toggle file-tree-toggle-spacer" aria-hidden="true" />
        <span className="file-tree-icon" aria-hidden="true">📄</span>
        <span className="file-tree-label" title={node.path}>{node.name}</span>
      </div>
      <div className="file-tree-col">
        <select
          value={file.tag || ''}
          onChange={(e) => onFieldChange(node.fileIndex, 'tag', e.target.value)}
          onBlur={onFieldBlur}
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
  onToggle,
  onFieldChange,
  onFieldBlur,
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
          />
          {isExpanded && (
            <TreeNodes
              nodes={node.children}
              depth={depth + 1}
              files={files}
              expanded={expanded}
              onToggle={onToggle}
              onFieldChange={onFieldChange}
              onFieldBlur={onFieldBlur}
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
      />
    )
  })
}

export default function ProjectFileTree({ files, onFieldChange, onFieldBlur }) {
  const tree = useMemo(() => buildFileTree(files), [files])
  const [expanded, setExpanded] = useState(() => getDefaultExpandedPaths(tree))

  useEffect(() => {
    setExpanded(getDefaultExpandedPaths(tree))
  }, [tree])

  const handleToggle = (path) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  if (!files.length) return null

  return (
    <div className="project-files-tree">
      <div className="file-tree-header">
        <div className="file-tree-name-col">名称</div>
        <div className="file-tree-col">标签</div>
        <div className="file-tree-col">上传日期</div>
        <div className="file-tree-col">修改日期</div>
      </div>
      <div className="file-tree-body">
        <TreeNodes
          nodes={tree.children}
          depth={0}
          files={files}
          expanded={expanded}
          onToggle={handleToggle}
          onFieldChange={onFieldChange}
          onFieldBlur={onFieldBlur}
        />
      </div>
    </div>
  )
}

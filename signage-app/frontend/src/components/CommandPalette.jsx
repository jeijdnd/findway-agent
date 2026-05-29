import React, { useState, useEffect, useRef, useMemo } from 'react'

const COMMANDS = [
  { id: 'scan', label: '扫描目录', keywords: ['扫描', '目录', 'scan', '文件夹'] },
  { id: 'filter-projects', label: '筛选项目', keywords: ['筛选', '搜索', '过滤', 'filter'] },
  { id: 'matching', label: '生成清单', keywords: ['生成', '清单', '匹配', 'matching'] },
  { id: 'new-project', label: '新建项目', keywords: ['新建', '项目', '创建', 'project'] },
  { id: 'settings', label: '打开设置', keywords: ['设置', '配置', 'settings'] },
  { id: 'new-chat', label: '新建对话', keywords: ['新建', '对话', '聊天', 'chat'] },
]

function fuzzyMatch(query, text) {
  if (!query) return true
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  let qi = 0
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++
  }
  return qi === q.length
}

function CommandPalette({ open, onClose, onExecute }) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)

  const filtered = useMemo(() => {
    if (!query.trim()) return COMMANDS
    return COMMANDS.filter((cmd) => {
      const haystack = [cmd.label, ...cmd.keywords].join(' ')
      return fuzzyMatch(query.trim(), haystack)
    })
  }, [query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && filtered.length > 0) {
        e.preventDefault()
        onExecute(filtered[selectedIndex].id)
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, filtered, selectedIndex, onClose, onExecute])

  if (!open) return null

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          className="command-palette-input"
          placeholder="输入命令..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul className="command-palette-list">
          {filtered.length === 0 ? (
            <li className="command-palette-empty">无匹配命令</li>
          ) : (
            filtered.map((cmd, index) => (
              <li
                key={cmd.id}
                className={`command-palette-item ${index === selectedIndex ? 'selected' : ''}`}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => {
                  onExecute(cmd.id)
                  onClose()
                }}
              >
                <span className="command-palette-label">{cmd.label}</span>
              </li>
            ))
          )}
        </ul>
        <div className="command-palette-hint">
          <span>↑↓ 选择</span>
          <span>Enter 执行</span>
          <span>Esc 关闭</span>
        </div>
      </div>
    </div>
  )
}

export default CommandPalette

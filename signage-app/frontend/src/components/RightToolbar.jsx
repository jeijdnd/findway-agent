import React, { useState, useEffect } from 'react'

export const TOOLBAR_ITEMS = [
  { id: 'chat', icon: '💬', label: '聊天', title: '返回聊天', canSlide: false },
  { id: 'dashboard', icon: '📊', label: '项目仪表盘', title: '项目仪表盘', canSlide: true },
  { id: 'matching', icon: '🔍', label: '旧项目匹配', title: '旧项目匹配', canSlide: true },
  { id: 'compare', icon: '📋', label: '清单对比', title: '清单对比', canSlide: true },
  { id: 'merge', icon: '🔗', label: '合并预览', title: '合并预览', canSlide: true },
  { id: 'settings', icon: '⚙️', label: '设置', title: '设置', canSlide: true },
  { id: 'cad', icon: '📐', label: 'CAD辅助', title: 'CAD辅助', canSlide: true },
]

const EXTRA_TOOLBAR_ITEMS = [
  { id: 'export', icon: '📤', label: '导出', title: '导出对话/清单' },
  { id: 'history', icon: '🕐', label: '历史', title: '对话历史快捷入口' },
  { id: 'help', icon: '❓', label: '帮助', title: '帮助与关于' },
]

function RightToolbar({ activeTab, viewMode, onSelect, onSlidePanel }) {
  const [tick, setTick] = useState(() => new Date().getSeconds())

  useEffect(() => {
    const id = setInterval(() => setTick(new Date().getSeconds()), 1000)
    return () => clearInterval(id)
  }, [])

  const handleClick = (item) => {
    if (item.id === 'chat') {
      onSelect?.('chat', null)
      return
    }

    const isActive = viewMode === 'tool' && activeTab === item.id

    if (isActive && item.canSlide && onSlidePanel) {
      onSlidePanel(item.id)
    } else {
      onSelect?.('tool', item.id)
    }
  }

  const handleExtraClick = async (item) => {
    if (item.id === 'history') {
      onSelect?.('chat', null)
      return
    }
    if (item.id === 'help') {
      onSelect?.('tool', 'settings')
      return
    }
    if (item.id === 'export') {
      try {
        const res = await fetch('/api/chat/history')
        if (!res.ok) throw new Error('export failed')
        const data = await res.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `findway-export-${Date.now()}.json`
        a.click()
        URL.revokeObjectURL(url)
      } catch {
        window.alert('导出失败，请稍后重试')
      }
    }
  }

  return (
    <aside className="right-toolbar" aria-label="工具">
      {/* 调试：如果这个 div 可见，说明 React 渲染正常 */}
      <div
        style={{
          background: '#fbbf24',
          color: '#000',
          padding: '4px 8px',
          fontSize: '11px',
          fontWeight: 'bold',
          textAlign: 'center',
          borderRadius: '4px',
          marginBottom: '4px',
          flexShrink: 0,
        }}
      >
        R {tick}
      </div>

      {TOOLBAR_ITEMS.map((item) => {
        const isChat = item.id === 'chat'
        const isActive = isChat
          ? viewMode === 'chat'
          : viewMode === 'tool' && activeTab === item.id

        return (
          <button
            key={item.id}
            type="button"
            className={`right-toolbar-btn ${isActive ? 'active' : ''}`}
            title={isActive && item.canSlide ? `${item.title}（再次点击打开侧滑）` : item.title}
            aria-label={item.title}
            aria-pressed={isActive}
            onClick={() => handleClick(item)}
          >
            <span className="right-toolbar-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="right-toolbar-label">{item.label}</span>
          </button>
        )
      })}

      <div className="right-toolbar-extra">
        {EXTRA_TOOLBAR_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="right-toolbar-btn"
            title={item.title}
            aria-label={item.title}
            onClick={() => handleExtraClick(item)}
          >
            <span className="right-toolbar-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="right-toolbar-label">{item.label}</span>
          </button>
        ))}
      </div>
    </aside>
  )
}

export default RightToolbar

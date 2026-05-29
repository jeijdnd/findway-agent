import React, { useState } from 'react'

/** 固定宽度，供主布局预留右侧空间 */
export const TOOLBAR_WIDTH = 72

export const TOOLBAR_ITEMS = [
  { id: 'chat', icon: '💬', label: '聊天', title: '返回聊天', canSlide: false },
  { id: 'dashboard', icon: '📊', label: '项目仪表盘', title: '项目仪表盘', canSlide: true },
  { id: 'matching', icon: '🔍', label: '旧项目匹配', title: '旧项目匹配', canSlide: true },
  { id: 'compare', icon: '📋', label: '清单对比', title: '清单对比', canSlide: true },
  { id: 'merge', icon: '🔗', label: '合并预览', title: '合并预览', canSlide: true },
  { id: 'settings', icon: '⚙️', label: '设置', title: '设置', canSlide: true },
  { id: 'cad', icon: '📐', label: 'CAD辅助', title: 'CAD辅助', canSlide: true },
]

/**
 * 右侧工具条 — 固定定位顶层组件，纯内联样式，不得嵌套于布局容器或依赖外部 CSS。
 */
function RightToolbar({ activeTab, viewMode, onSelect, onSlidePanel }) {
  const [hoveredId, setHoveredId] = useState(null)

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

  return (
    <aside
      aria-label="工具"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: TOOLBAR_WIDTH,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 4,
        padding: '12px 8px',
        background: '#ffffff',
        borderLeft: '1px solid #e2e8f0',
        zIndex: 1000,
        overflowY: 'auto',
        boxSizing: 'border-box',
      }}
    >
      {TOOLBAR_ITEMS.map((item) => {
        const isChat = item.id === 'chat'
        const isActive = isChat
          ? viewMode === 'chat'
          : viewMode === 'tool' && activeTab === item.id
        const isHovered = hoveredId === item.id && !isActive

        return (
          <button
            key={item.id}
            type="button"
            title={isActive && item.canSlide ? `${item.title}（再次点击打开侧滑）` : item.title}
            aria-label={item.title}
            aria-pressed={isActive}
            onClick={() => handleClick(item)}
            onMouseEnter={() => setHoveredId(item.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              width: '100%',
              padding: '10px 6px',
              border: 'none',
              borderRadius: 8,
              background: isActive ? '#dbeafe' : isHovered ? '#f1f5f9' : 'transparent',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              color: isActive ? '#2563eb' : '#1e293b',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
            <span
              style={{
                fontSize: 11,
                lineHeight: 1.2,
                textAlign: 'center',
                wordBreak: 'break-all',
                color: isActive ? '#2563eb' : '#64748b',
              }}
            >
              {item.label}
            </span>
          </button>
        )
      })}
    </aside>
  )
}

export default RightToolbar

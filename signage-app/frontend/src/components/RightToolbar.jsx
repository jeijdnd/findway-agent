import React from 'react'

export const TOOLBAR_ITEMS = [
  { id: 'chat', icon: '💬', label: '聊天', title: '返回聊天', canSlide: false },
  { id: 'dashboard', icon: '📊', label: '项目仪表盘', title: '项目仪表盘', canSlide: true },
  { id: 'matching', icon: '🔍', label: '旧项目匹配', title: '旧项目匹配', canSlide: true },
  { id: 'compare', icon: '📋', label: '清单对比', title: '清单对比', canSlide: true },
  { id: 'merge', icon: '🔗', label: '合并预览', title: '合并预览', canSlide: true },
  { id: 'settings', icon: '⚙️', label: '设置', title: '设置', canSlide: true },
  { id: 'cad', icon: '📐', label: 'CAD辅助', title: 'CAD辅助', canSlide: true },
]

function RightToolbar({ activeTab, viewMode, onSelect, onSlidePanel }) {
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
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        alignItems: 'center',
        width: '100%',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {TOOLBAR_ITEMS.map((item) => {
        const isChat = item.id === 'chat'
        const isActive = isChat
          ? viewMode === 'chat'
          : viewMode === 'tool' && activeTab === item.id

        return (
          <button
            key={item.id}
            type="button"
            title={isActive && item.canSlide ? `${item.title}（再次点击打开侧滑）` : item.title}
            aria-label={item.title}
            aria-pressed={isActive}
            onClick={() => handleClick(item)}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              border: 'none',
              background: isActive ? '#3b82f6' : 'transparent',
              color: '#fff',
              fontSize: '18px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {item.icon}
          </button>
        )
      })}
    </aside>
  )
}

export default RightToolbar

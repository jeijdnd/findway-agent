import React from 'react'

export const TOOLBAR_ITEMS = [
  { id: 'chat', icon: '💬', label: '聊天', title: '返回聊天' },
  { id: 'dashboard', icon: '📊', label: '仪表盘', title: '项目仪表盘' },
  { id: 'matching', icon: '🔍', label: '匹配', title: '旧项目匹配' },
  { id: 'compare', icon: '📋', label: '对比', title: '清单对比' },
  { id: 'merge', icon: '🔗', label: '合并', title: '合并预览' },
  { id: 'settings', icon: '⚙️', label: '设置', title: '设置' },
  { id: 'cad', icon: '📐', label: 'CAD', title: 'CAD辅助' },
]

/** 可触发侧滑面板的快捷项（兼容旧 RightSidebar） */
export const SLIDE_PANEL_IDS = ['compare', 'new-project', 'projects', 'settings']

function RightToolbar({ activeTab, viewMode, onSelect, onSlidePanel }) {
  return (
    <aside className="right-toolbar" aria-label="工具">
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
            title={item.title}
            aria-label={item.title}
            aria-pressed={isActive}
            onClick={() => {
              if (isChat) {
                onSelect('chat', null)
                return
              }
              const slideMap = {
                compare: 'compare',
                dashboard: 'projects',
                settings: 'settings',
              }
              if (isActive && onSlidePanel && slideMap[item.id]) {
                onSlidePanel(slideMap[item.id])
              } else {
                onSelect('tool', item.id)
              }
            }}
          >
            <span className="right-toolbar-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="right-toolbar-label">{item.label}</span>
          </button>
        )
      })}
    </aside>
  )
}

export default RightToolbar

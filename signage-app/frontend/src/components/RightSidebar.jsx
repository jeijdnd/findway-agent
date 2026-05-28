import React from 'react'

export const SIDEBAR_PANELS = [
  { id: 'compare', icon: '📋', label: '清单', title: '清单同步' },
  { id: 'new-project', icon: '📁', label: '新建', title: '新建项目' },
  { id: 'projects', icon: '📊', label: '项目', title: '项目管理' },
  { id: 'settings', icon: '🔧', label: '设置', title: '设置' },
]

function RightSidebar({ activePanel, onSelect }) {
  return (
    <aside className="right-toolbar" aria-label="快捷操作">
      {SIDEBAR_PANELS.map((item) => {
        const isActive = activePanel === item.id
        return (
          <button
            key={item.id}
            type="button"
            className={`right-toolbar-btn ${isActive ? 'active' : ''}`}
            title={item.title}
            aria-label={item.title}
            aria-pressed={isActive}
            onClick={() => onSelect(isActive ? null : item.id)}
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

export default RightSidebar

import React, { useState, useEffect, useCallback } from 'react'

function LeftSidebar({
  chatHistoryList,
  currentChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onSkillInvoke,
}) {
  const [skills, setSkills] = useState([])
  const [skillsLoading, setSkillsLoading] = useState(true)

  const fetchSkills = useCallback(async () => {
    try {
      setSkillsLoading(true)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      const res = await fetch('/api/skills', { signal: controller.signal })
      clearTimeout(timeoutId)
      if (!res.ok) return
      const data = await res.json()
      setSkills((data.skills || []).filter((s) => s.enabled))
    } catch {
      // 忽略
    } finally {
      setSkillsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSkills()
  }, [fetchSkills])

  return (
    <aside className="left-sidebar" aria-label="导航">
      <div className="left-sidebar-header">
        <span className="left-sidebar-title">对话</span>
        <button
          type="button"
          className="left-sidebar-new-btn"
          title="新建任务 (Ctrl+N)"
          onClick={onNewChat}
        >
          + 新建任务
        </button>
      </div>

      <div className="left-sidebar-section left-sidebar-history">
        <div className="left-sidebar-section-title">历史对话</div>
        <ul className="chat-history-list">
          {chatHistoryList.length === 0 ? (
            <li className="chat-history-empty">暂无历史</li>
          ) : (
            chatHistoryList.map((chat) => (
              <li
                key={chat.id}
                className={`chat-history-item ${currentChatId === chat.id ? 'active' : ''}`}
                onClick={() => onSelectChat(chat.id)}
              >
                <div className="chat-history-item-title">{chat.title}</div>
                {chat.preview && (
                  <div className="chat-history-item-preview">{chat.preview}</div>
                )}
                <button
                  type="button"
                  className="chat-history-delete"
                  title="删除"
                  onClick={(e) => onDeleteChat(e, chat.id)}
                >
                  ×
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="left-sidebar-section left-sidebar-skills">
        <div className="left-sidebar-section-title">Skills</div>
        {skillsLoading ? (
          <div className="left-sidebar-skills-hint">加载中…</div>
        ) : skills.length === 0 ? (
          <div className="left-sidebar-skills-hint">暂无已启用技能</div>
        ) : (
          <ul className="left-sidebar-skills-list">
            {skills.map((skill) => (
              <li key={skill.name}>
                <button
                  type="button"
                  className="left-sidebar-skill-btn"
                  title={skill.description || skill.name}
                  onClick={() => onSkillInvoke?.(skill)}
                >
                  {skill.display_name || skill.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}

export default LeftSidebar

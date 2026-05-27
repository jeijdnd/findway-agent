import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import ToolDiscoveryCards from './ToolDiscoveryCards'
import SafetyBlockedCard from './SafetyBlockedCard'

const WELCOME_MESSAGE = {
  role: 'assistant',
  content:
    '你好！我是标识Agent，建筑导视标识设计AI助手。\n\n我可以帮你：\n1. 创建新项目\n2. 搜索旧项目\n3. 对比清单\n4. 查询规范\n\n请告诉我你需要什么帮助？',
}

function isWelcomeOnly(messages) {
  return (
    messages.length === 1 &&
    messages[0].role === 'assistant' &&
    messages[0].content === WELCOME_MESSAGE.content
  )
}

function buildMessagesPayload(messages) {
  const now = new Date().toISOString()
  return messages
    .filter((m, index) => {
      if (index === 0 && m.role === 'assistant' && m.content === WELCOME_MESSAGE.content) {
        return false
      }
      return true
    })
    .map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: now,
    }))
}

async function persistChatHistory(chatId, messages) {
  if (isWelcomeOnly(messages)) return null
  const payload = buildMessagesPayload(messages)
  if (payload.length === 0) return null

  const res = await fetch('/api/chat/history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: chatId || undefined,
      messages: payload,
    }),
  })
  if (!res.ok) {
    throw new Error(`保存对话失败 HTTP ${res.status}`)
  }
  return res.json()
}

function ChatPanel({
  onAction,
  chatId,
  onChatIdChange,
  onHistoryChange,
  newChatSignal,
  skillInvokeSignal,
}) {
  const navigate = useNavigate()
  const [messages, setMessages] = useState([WELCOME_MESSAGE])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [searchingTools, setSearchingTools] = useState(false)
  const messagesEndRef = useRef(null)

  const dispatchPanelAction = useCallback(
    (action, data) => {
      if (!action || !onAction) return
      if (action === 'create_project' || action === 'open_dashboard_create') {
        navigate('/')
        onAction('create_project', data)
        return
      }
      onAction(action, data)
    },
    [navigate, onAction]
  )

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const syncHistory = useCallback(
    async (nextMessages, id) => {
      if (isWelcomeOnly(nextMessages)) return id
      try {
        const saved = await persistChatHistory(id, nextMessages)
        if (saved?.id && onChatIdChange) {
          onChatIdChange(saved.id)
        }
        if (onHistoryChange) {
          onHistoryChange()
        }
        return saved?.id || id
      } catch (err) {
        console.error('persistChatHistory failed:', err)
        return id
      }
    },
    [onChatIdChange, onHistoryChange]
  )

  const loadChat = useCallback(async (id) => {
    if (!id) {
      setMessages([WELCOME_MESSAGE])
      return
    }
    try {
      const res = await fetch(`/api/chat/history/${id}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const loaded = data.messages?.length
        ? data.messages.map((m) => ({ role: m.role, content: m.content }))
        : [WELCOME_MESSAGE]
      setMessages(loaded)
    } catch {
      setMessages([WELCOME_MESSAGE])
    }
  }, [])

  useEffect(() => {
    loadChat(chatId)
  }, [chatId, loadChat])

  useEffect(() => {
    if (newChatSignal > 0) {
      setMessages([WELCOME_MESSAGE])
    }
  }, [newChatSignal])

  useEffect(() => {
    if (!skillInvokeSignal?.nonce) return
    const name = skillInvokeSignal.displayName || skillInvokeSignal.name
    setInputValue(`请使用技能「${name}」帮我处理当前任务`)
  }, [skillInvokeSignal])

  const sendMessage = async () => {
    const text = inputValue.trim()
    if (!text || loading) return

    const userMessage = { role: 'user', content: text }
    const messagesAfterUser = [...messages, userMessage]
    setMessages(messagesAfterUser)
    setInputValue('')
    setLoading(true)

    let activeChatId = chatId

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 120000)

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, chat_id: chatId || undefined }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      const assistantMessage = {
        role: 'assistant',
        content: data.reply,
        toolDiscovery: data.data?.tool_discovery || null,
        suggestGithubSearch: data.data?.suggest_github_search || false,
        safetyBlocked: data.data?.safety_blocked || null,
      }
      const messagesAfterReply = [...messagesAfterUser, assistantMessage]
      setMessages(messagesAfterReply)

      activeChatId = data.data?.chat_id || activeChatId
      activeChatId = await syncHistory(messagesAfterReply, activeChatId)

      if (data.action) {
        dispatchPanelAction(data.action, data.data)
      }

      if (data.data?.suggest_github_search && !data.data?.tool_discovery) {
        setSearchingTools(true)
        try {
          const lastUser = text
          const discRes = await fetch('/api/skills/discover-from-github', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: lastUser }),
          })
          if (discRes.ok) {
            const disc = await discRes.json()
            setMessages((prev) => {
              const next = [...prev]
              const last = next[next.length - 1]
              if (last?.role === 'assistant') {
                next[next.length - 1] = { ...last, toolDiscovery: disc }
              }
              return next
            })
          }
        } catch {
          // 忽略自动搜索失败
        } finally {
          setSearchingTools(false)
        }
      }
    } catch (error) {
      let errorMsg = '发送失败，请检查后端是否启动'
      if (error.name === 'AbortError') {
        errorMsg = '请求超时，请稍后再试'
      }
      const withError = [...messagesAfterUser, { role: 'assistant', content: errorMsg }]
      setMessages(withError)
      await syncHistory(withError, activeChatId)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="chat-panel-inner">
      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.role}`}>
            <div className="message-bubble">{msg.content}</div>
            {msg.toolDiscovery && (
              <ToolDiscoveryCards
                discovery={msg.toolDiscovery}
                onInstalled={() => {
                  setMessages((prev) => [
                    ...prev,
                    {
                      role: 'assistant',
                      content: `技能已安装。你可以重新描述需求，我将尝试使用新工具。`,
                    },
                  ])
                }}
              />
            )}
            {msg.safetyBlocked && (
              <SafetyBlockedCard
                blocked={msg.safetyBlocked}
                onBypassSuccess={(result) => {
                  setMessages((prev) => [
                    ...prev,
                    {
                      role: 'assistant',
                      content: result.message || '操作已放行并执行完成。',
                    },
                  ])
                }}
              />
            )}
          </div>
        ))}
        {(loading || searchingTools) && (
          <div className="message assistant">
            <div className="message-bubble">
              {searchingTools ? '正在搜索适合的工具...' : '正在思考中...'}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-area">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="输入消息..."
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading}>
          发送
        </button>
      </div>
    </div>
  )
}

export default ChatPanel

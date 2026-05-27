import React, { useState, useRef, useEffect, useCallback } from 'react'
import { requestFileOperationPermission } from '../utils/filePermission'

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

function ChatPanel({ onAction, chatId, onChatIdChange, onHistoryChange, newChatSignal }) {
  const [messages, setMessages] = useState([WELCOME_MESSAGE])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

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

  const handleScanDirectory = async (path, currentMessages, currentChatId) => {
    try {
      const permission = await requestFileOperationPermission(path, 'scan')
      if (!permission.granted) {
        const cancelled = { role: 'assistant', content: '已取消' }
        const withCancel = [...currentMessages, cancelled]
        setMessages(withCancel)
        await syncHistory(withCancel, currentChatId)
        return
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000)
      const scanRes = await fetch('/api/scanner/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          root_path: path,
          permission_id: permission.permission_id,
        }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!scanRes.ok) {
        const errData = await scanRes.json().catch(() => ({}))
        throw new Error(errData.detail || errData.message || `HTTP ${scanRes.status}`)
      }

      const result = await scanRes.json()
      const count = result.count ?? result.projects?.length ?? 0
      const summary = {
        role: 'assistant',
        content: `扫描完成，在「${path}」下发现 ${count} 个项目。可在「项目仪表盘」中查看扫描结果。`,
      }
      const withResult = [...currentMessages, summary]
      setMessages(withResult)
      await syncHistory(withResult, currentChatId)
      if (onAction) {
        onAction('open_scan', { path })
      }
    } catch (err) {
      const errMsg = {
        role: 'assistant',
        content: `扫描失败: ${err.message}`,
      }
      const withErr = [...currentMessages, errMsg]
      setMessages(withErr)
      await syncHistory(withErr, currentChatId)
    }
  }

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
      const timeoutId = setTimeout(() => controller.abort(), 30000)

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
      const assistantMessage = { role: 'assistant', content: data.reply }
      const messagesAfterReply = [...messagesAfterUser, assistantMessage]
      setMessages(messagesAfterReply)

      activeChatId = data.data?.chat_id || activeChatId
      activeChatId = await syncHistory(messagesAfterReply, activeChatId)

      if (data.action === 'scan_directory' && data.data?.path) {
        await handleScanDirectory(data.data.path, messagesAfterReply, activeChatId)
        return
      }

      if (data.action && onAction) {
        onAction(data.action, data.data)
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
    <>
      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.role}`}>
            <div className="message-bubble">{msg.content}</div>
          </div>
        ))}
        {loading && (
          <div className="message assistant">
            <div className="message-bubble">正在思考中...</div>
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
    </>
  )
}

export default ChatPanel

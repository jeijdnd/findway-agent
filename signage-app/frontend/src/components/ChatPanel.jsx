import React, { useState, useRef, useEffect, useCallback } from 'react'

const WELCOME_MESSAGE = {
  role: 'assistant',
  content:
    '你好！我是标识Agent，建筑导视标识设计AI助手。\n\n我可以帮你：\n1. 创建新项目\n2. 搜索旧项目\n3. 对比清单\n4. 查询规范\n\n请告诉我你需要什么帮助？',
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

  const sendMessage = async () => {
    const text = inputValue.trim()
    if (!text || loading) return

    const userMessage = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setLoading(true)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

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
      setMessages((prev) => [...prev, assistantMessage])

      if (data.data?.chat_id && onChatIdChange) {
        onChatIdChange(data.data.chat_id)
      }
      if (onHistoryChange) {
        onHistoryChange()
      }

      if (data.action && onAction) {
        onAction(data.action, data.data)
      }
    } catch (error) {
      let errorMsg = '发送失败，请检查后端是否启动'
      if (error.name === 'AbortError') {
        errorMsg = '请求超时，请稍后再试'
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: errorMsg }])
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

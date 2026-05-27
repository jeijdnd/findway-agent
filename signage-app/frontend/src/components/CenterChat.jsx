import React from 'react'
import ChatPanel from './ChatPanel'

function CenterChat({
  onAction,
  chatId,
  onChatIdChange,
  onHistoryChange,
  newChatSignal,
  skillInvokeSignal,
}) {
  return (
    <div className="center-chat">
      <div className="center-chat-header">
        <span>FindWay Agent</span>
      </div>
      <div className="center-chat-body">
        <ChatPanel
          onAction={onAction}
          chatId={chatId}
          onChatIdChange={onChatIdChange}
          onHistoryChange={onHistoryChange}
          newChatSignal={newChatSignal}
          skillInvokeSignal={skillInvokeSignal}
        />
      </div>
    </div>
  )
}

export default CenterChat

import React, { useState } from 'react'

function PermissionConfirmModal({
  title,
  message,
  detail,
  rememberable,
  onConfirm,
  onCancel,
}) {
  const [remember, setRemember] = useState(false)

  return (
    <div className="permission-confirm-overlay" onClick={onCancel}>
      <div
        className="permission-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="permission-confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="permission-confirm-title" className="permission-confirm-title">
          {title || '文件操作确认'}
        </h3>
        <p className="permission-confirm-message">{message}</p>
        {detail && <p className="permission-confirm-detail">{detail}</p>}
        {rememberable && (
          <label className="permission-confirm-remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            记住此授权，下次不再询问
          </label>
        )}
        <div className="permission-confirm-actions">
          <button type="button" className="btn-primary" onClick={() => onConfirm(remember)}>
            允许
          </button>
          <button type="button" className="permission-confirm-cancel" onClick={onCancel}>
            拒绝
          </button>
        </div>
      </div>
    </div>
  )
}

export default PermissionConfirmModal

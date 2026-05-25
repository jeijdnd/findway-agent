/**
 * 文件操作权限：先向后端申请，再通过 Electron/浏览器弹窗让用户确认
 */

const OPERATION_LABELS = {
  scan: '扫描',
  read: '读取',
  write: '写入',
}

export async function requestFileOperationPermission(path, operation = 'scan') {
  const response = await fetch('/api/scanner/request-permission', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, operation }),
  })

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    throw new Error(errData.detail || errData.message || `HTTP ${response.status}`)
  }

  const data = await response.json()
  const opLabel = OPERATION_LABELS[operation] || operation

  let granted = false
  if (window.electronAPI?.showConfirmDialog) {
    granted = await window.electronAPI.showConfirmDialog({
      title: data.prompt_title || '文件操作确认',
      message: data.prompt_message || `允许 AI ${opLabel}以下目录吗？`,
      detail: data.prompt_detail || path,
      confirmText: '允许',
      cancelText: '拒绝',
    })
  } else {
    granted = window.confirm(
      `${data.prompt_message || `允许 AI ${opLabel}以下目录吗？`}\n\n${data.prompt_detail || path}`
    )
  }

  const confirmResponse = await fetch('/api/scanner/confirm-permission', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_id: data.request_id, granted }),
  })

  if (!confirmResponse.ok) {
    const errData = await confirmResponse.json().catch(() => ({}))
    throw new Error(errData.detail || errData.message || `HTTP ${confirmResponse.status}`)
  }

  const confirmData = await confirmResponse.json()
  if (!granted) {
    return {
      granted: false,
      permission_id: null,
      message: confirmData.message || '您已拒绝此操作，已取消。',
    }
  }

  return {
    granted: true,
    permission_id: data.request_id,
    message: confirmData.message || '已授权',
  }
}

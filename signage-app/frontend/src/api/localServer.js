import { requestFileOperationPermission } from '../utils/filePermission'

export async function fetchLocalServerConfig() {
  const res = await fetch('/api/settings/local-server')
  if (!res.ok) throw new Error(`加载失败: HTTP ${res.status}`)
  return res.json()
}

export async function saveLocalServerConfig({ enabled, path }) {
  const res = await fetch('/api/settings/local-server', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled, path }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || err.message || '保存失败')
  }
  return res.json()
}

export async function browseServerPath(dirPath, existingPermissionId = null) {
  let permission_id = existingPermissionId
  if (!permission_id) {
    const perm = await requestFileOperationPermission(dirPath, 'scan')
    if (!perm.granted) throw new Error('访问已取消')
    permission_id = perm.permission_id
  }
  const res = await fetch('/api/scanner/browse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: dirPath, permission_id }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || err.message || '浏览失败')
  }
  return { ...(await res.json()), permission_id }
}

export async function downloadServerFile(filePath, permissionId) {
  const url = `/api/scanner/download?path=${encodeURIComponent(filePath)}&permission_id=${encodeURIComponent(permissionId)}`
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || err.message || '下载失败')
  }
  const blob = await res.blob()
  const name = filePath.split(/[/\\]/).pop() || 'download'
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(a.href)
}

export function formatFileSize(bytes) {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

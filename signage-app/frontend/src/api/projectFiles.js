import { requestFileOperationPermission } from '../utils/filePermission'

async function withWritePermission(projectPath, fn) {
  const perm = await requestFileOperationPermission(projectPath, 'write')
  if (!perm.granted) {
    throw new Error('操作已取消')
  }
  return fn(perm.permission_id)
}

export async function moveProjectFile(projectId, projectPath, source, destFolder) {
  return withWritePermission(projectPath, async (permission_id) => {
    const res = await fetch(`/api/projects/${projectId}/files/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, dest_folder: destFolder || '', permission_id }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || '移动失败')
    }
    return res.json()
  })
}

export async function mkdirProjectFolder(projectId, projectPath, folder) {
  return withWritePermission(projectPath, async (permission_id) => {
    const res = await fetch(`/api/projects/${projectId}/files/mkdir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder, permission_id }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || '创建文件夹失败')
    }
    return res.json()
  })
}

export async function deleteProjectFileItem(projectId, projectPath, path) {
  return withWritePermission(projectPath, async (permission_id) => {
    const res = await fetch(`/api/projects/${projectId}/files/delete-item`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, permission_id }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || '删除失败')
    }
    return res.json()
  })
}

export function joinProjectPath(projectPath, relPath) {
  const base = (projectPath || '').replace(/[/\\]+$/, '')
  const rel = (relPath || '').replace(/^[/\\]+/, '').replace(/\//g, '\\')
  return rel ? `${base}\\${rel}` : base
}

export async function copyPathToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  document.body.removeChild(ta)
}

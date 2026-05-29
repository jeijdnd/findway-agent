/** 将平铺文件列表（相对路径 name）构建为树形结构 */

const DRAG_MIME = 'application/x-findway-file'

export { DRAG_MIME }

function getFileSortValue(node, files, sortBy) {
  if (node.type === 'folder') {
    let best = ''
    for (const child of node.children) {
      const v = getFileSortValue(child, files, sortBy)
      if (sortBy === 'name') {
        if (!best || v.localeCompare(best, 'zh-CN') < 0) best = v
      } else if (!best || v > best) {
        best = v
      }
    }
    return sortBy === 'name' ? node.name : best
  }
  const file = files[node.fileIndex] || {}
  if (sortBy === 'name') return node.name
  if (sortBy === 'uploaded') return file.uploaded || ''
  return file.modified || ''
}

function compareNodes(a, b, files, sortBy, sortAsc) {
  if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
  const va = getFileSortValue(a, files, sortBy)
  const vb = getFileSortValue(b, files, sortBy)
  let cmp
  if (sortBy === 'name') {
    cmp = va.localeCompare(vb, 'zh-CN', { sensitivity: 'base' })
  } else {
    cmp = va.localeCompare(vb)
  }
  return sortAsc ? cmp : -cmp
}

function sortTreeChildren(children, files, sortBy, sortAsc) {
  children.sort((a, b) => compareNodes(a, b, files, sortBy, sortAsc))
  children.forEach((child) => {
    if (child.type === 'folder') sortTreeChildren(child.children, files, sortBy, sortAsc)
  })
}

export function buildFileTree(files, sortBy = 'name', sortAsc = true, extraFolders = []) {
  const root = { type: 'root', children: [] }

  const ensureFolderPath = (folderPath) => {
    const normalized = (folderPath || '').replace(/\\/g, '/')
    const parts = normalized.split('/').filter(Boolean)
    if (!parts.length) return

    let current = root
    let currentPath = ''
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part
      let folder = current.children.find((c) => c.type === 'folder' && c.name === part)
      if (!folder) {
        folder = { type: 'folder', name: part, path: currentPath, children: [] }
        current.children.push(folder)
      }
      current = folder
    }
  }

  extraFolders.forEach(ensureFolderPath)

  files.forEach((file, index) => {
    const normalized = (file.name || '').replace(/\\/g, '/')
    const parts = normalized.split('/').filter(Boolean)
    if (!parts.length) return

    const fileName = parts.pop()
    let current = root
    let currentPath = ''

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part
      let folder = current.children.find((c) => c.type === 'folder' && c.name === part)
      if (!folder) {
        folder = { type: 'folder', name: part, path: currentPath, children: [] }
        current.children.push(folder)
      }
      current = folder
    }

    current.children.push({
      type: 'file',
      name: fileName,
      path: normalized,
      fileIndex: index,
    })
  })

  sortTreeChildren(root.children, files, sortBy, sortAsc)
  return root
}

export function countFilesInFolder(folder) {
  let count = 0
  for (const child of folder.children) {
    if (child.type === 'file') count += 1
    else count += countFilesInFolder(child)
  }
  return count
}

export function getDefaultExpandedPaths(tree) {
  const expanded = new Set()
  tree.children.forEach((child) => {
    if (child.type === 'folder') expanded.add(child.path)
  })
  return expanded
}

export const SORT_OPTIONS = [
  { id: 'name', label: '名称' },
  { id: 'modified', label: '修改时间' },
  { id: 'uploaded', label: '上传时间' },
]

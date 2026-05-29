/** 将平铺文件列表（相对路径 name）构建为树形结构 */

function sortTreeChildren(children) {
  children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name, 'zh-CN', { sensitivity: 'base' })
  })
  children.forEach((child) => {
    if (child.type === 'folder') sortTreeChildren(child.children)
  })
}

export function buildFileTree(files) {
  const root = { type: 'root', children: [] }

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

  sortTreeChildren(root.children)
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

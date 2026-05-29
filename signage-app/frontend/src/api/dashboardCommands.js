/**
 * 仪表盘聊天联动接口 — UI 与聊天窗口共用同一套命令类型与 API
 * 新增仪表盘功能时须在此同步添加命令常量与处理逻辑
 */

/** 与后端 app_data.DEFAULT_PROJECT_ROOT 保持一致 */
export const DEFAULT_PROJECT_ROOT = 'E:\\MingRui\\__项目文件'

/** 默认项目根目录 API（勿使用已废弃的 /api/projects/config） */
export const DEFAULT_PROJECT_PATH_API = '/api/settings/default-project-path'

export const DashboardCommandType = {
  NEW_PROJECT: 'new-project',
  FILTER: 'dashboard-filter',
  SET_STAGE: 'dashboard-set-stage',
  OPEN_PROJECT: 'dashboard-open-project',
  DELETE_PROJECT: 'dashboard-delete-project',
  EDIT_PROJECT: 'dashboard-edit-project',
  SCAN: 'scan',
}

/** 构建 AppLayout commandTrigger 对象 */
export function buildDashboardTrigger(type, payload = {}) {
  return { type, nonce: Date.now(), ...payload }
}

/** 按名称、年份、阶段筛选项目列表 */
export function filterProjects(projects, { query = '', year = '', stage = '' } = {}) {
  const q = query.trim().toLowerCase()
  const yearNum = year === '' || year == null ? null : Number(year)
  const stageVal = stage.trim()

  return projects.filter((p) => {
    if (q && !p.name?.toLowerCase().includes(q)) return false
    if (yearNum != null && !Number.isNaN(yearNum) && p.year !== yearNum) return false
    if (stageVal && p.stage !== stageVal) return false
    return true
  })
}

/** 对 grouped 对象应用筛选，保留分组结构 */
export function filterGrouped(grouped, filters, groupOrder) {
  const result = {}
  for (const groupName of groupOrder) {
    const list = grouped[groupName] || []
    result[groupName] = filterProjects(list, filters)
  }
  return result
}

export function findProjectByName(projects, name) {
  const q = (name || '').trim().toLowerCase()
  if (!q) return null
  return projects.find((p) => p.name?.toLowerCase() === q)
    || projects.find((p) => p.name?.toLowerCase().includes(q))
}

export function findProjectById(projects, id) {
  if (!id) return null
  return projects.find((p) => p.id === id)
}

export async function fetchDefaultProjectPath() {
  try {
    const res = await fetch(DEFAULT_PROJECT_PATH_API)
    if (!res.ok) return DEFAULT_PROJECT_ROOT
    const cfg = await res.json()
    return cfg.default_project_path || DEFAULT_PROJECT_ROOT
  } catch {
    return DEFAULT_PROJECT_ROOT
  }
}

/** @deprecated 使用 fetchDefaultProjectPath */
export const fetchProjectConfig = fetchDefaultProjectPath

export async function saveDefaultProjectPath(path) {
  const res = await fetch(DEFAULT_PROJECT_PATH_API, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ default_project_path: path.trim() }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || err.detail || `HTTP ${res.status}`)
  }
  const data = await res.json()
  return data.default_project_path
}

export async function fetchAllProjects() {
  const res = await fetch('/api/projects')
  if (!res.ok) throw new Error(`加载项目失败: HTTP ${res.status}`)
  return res.json()
}

export async function updateProjectStage(projectId, stage) {
  const res = await fetch(`/api/projects/${projectId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || err.message || '更新阶段失败')
  }
  return res.json()
}

export async function deleteProjectById(projectId) {
  const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || err.message || '删除项目失败')
  }
  return res.json()
}

export async function importScannedFolders(folders) {
  const res = await fetch('/api/projects/import-scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folders }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || err.message || '导入失败')
  }
  return res.json()
}

/** 聊天 action → commandTrigger 类型映射 */
export const CHAT_ACTION_TO_COMMAND = {
  create_project: DashboardCommandType.NEW_PROJECT,
  open_dashboard_create: DashboardCommandType.NEW_PROJECT,
  dashboard_filter: DashboardCommandType.FILTER,
  dashboard_set_stage: DashboardCommandType.SET_STAGE,
  dashboard_open_project: DashboardCommandType.OPEN_PROJECT,
  dashboard_delete_project: DashboardCommandType.DELETE_PROJECT,
  dashboard_edit_project: DashboardCommandType.EDIT_PROJECT,
  open_scan: DashboardCommandType.SCAN,
}

/** 将聊天返回的 action/data 转为 commandTrigger */
export function chatActionToTrigger(action, data = {}) {
  const type = CHAT_ACTION_TO_COMMAND[action]
  if (!type) return null
  return buildDashboardTrigger(type, {
    projectName: data.project_name || data.suggested_name || data.name || '',
    projectId: data.project_id || '',
    stage: data.stage || '',
    query: data.query || data.filter_query || '',
    year: data.year ?? data.filter_year ?? '',
    filterStage: data.filter_stage || data.stage_filter || '',
    path: data.path || '',
    projectType: data.project_type || '',
  })
}

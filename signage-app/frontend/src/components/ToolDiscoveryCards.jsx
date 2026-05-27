import React, { useState } from 'react'

function ToolDiscoveryCards({ discovery, onInstalled }) {
  const [installingUrl, setInstallingUrl] = useState(null)
  const [message, setMessage] = useState('')

  if (!discovery) return null

  const { repos = [], query = '', found = false } = discovery

  const handleInstall = async (repo) => {
    const warn =
      repo.low_safety || (repo.safety_score != null && repo.safety_score < 50)
        ? `\n\n⚠ 安全评分较低（${repo.safety_score}），请谨慎安装。`
        : ''
    const ok = window.confirm(
      `确定从 GitHub 安装技能「${repo.name}」吗？\n\n${repo.description || ''}${warn}\n\n仓库：${repo.install_url}`
    )
    if (!ok) return

    try {
      setInstallingUrl(repo.install_url)
      setMessage('')
      const res = await fetch('/api/skills/install-from-github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: repo.install_url }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.detail || `HTTP ${res.status}`)
      }
      setMessage(`已安装并启用：${data.skill_name || repo.name}`)
      if (onInstalled) onInstalled(data)
    } catch (err) {
      setMessage('安装失败: ' + err.message)
    } finally {
      setInstallingUrl(null)
    }
  }

  return (
    <div className="tool-discovery-block">
      <div className="tool-discovery-header">
        {found
          ? `在 GitHub 找到 ${repos.length} 个候选技能（${query}）`
          : `未找到匹配技能（${query}）`}
      </div>
      {message && (
        <p
          className="tool-discovery-message"
          style={{ color: message.includes('失败') ? '#dc2626' : '#16a34a' }}
        >
          {message}
        </p>
      )}
      {repos.length > 0 && (
        <div className="tool-discovery-list">
          {repos.map((repo) => (
            <div
              key={repo.install_url || repo.full_name}
              className={`tool-discovery-card ${repo.low_safety ? 'low-safety' : ''}`}
            >
              <div className="tool-discovery-card-head">
                <span className="tool-discovery-name">{repo.name}</span>
                <span className="tool-discovery-stars">★ {repo.stars}</span>
              </div>
              {repo.description && (
                <p className="tool-discovery-desc">{repo.description}</p>
              )}
              <div className="tool-discovery-meta">
                <span
                  className={`tool-discovery-score ${
                    repo.safety_score < 50 ? 'warn' : 'ok'
                  }`}
                >
                  安全 {repo.safety_score}
                </span>
                {repo.warnings?.length > 0 && (
                  <span className="tool-discovery-warn" title={repo.warnings.join('；')}>
                    ⚠ {repo.warnings[0]}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="btn-primary tool-discovery-install"
                disabled={installingUrl === repo.install_url}
                onClick={() => handleInstall(repo)}
              >
                {installingUrl === repo.install_url ? '安装中...' : '安装'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ToolDiscoveryCards

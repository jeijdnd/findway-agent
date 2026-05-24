/**
 * 旧项目匹配页面
 * 提供搜索、扫描和预览旧项目功能
 */
import React, { useState, useEffect } from 'react'

function Matching() {
  const [activeSection, setActiveSection] = useState('search')
  const [searchType, setSearchType] = useState('')
  const [searchKeywords, setSearchKeywords] = useState('')
  const [scanPath, setScanPath] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searchResults, setSearchResults] = useState([])
  const [scanResult, setScanResult] = useState(null)
  const [previewData, setPreviewData] = useState(null)
  const [selectedProject, setSelectedProject] = useState(null)

  // 搜索旧项目
  const handleSearch = async () => {
    if (!searchType && !searchKeywords) {
      setError('请输入项目类型或关键词')
      return
    }

    setLoading(true)
    setError(null)
    setSearchResults([])
    setPreviewData(null)
    setSelectedProject(null)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const response = await fetch('/api/matching/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_type: searchType || undefined,
          keywords: searchKeywords || undefined
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      setSearchResults(data)
      if (data.length === 0) {
        setError('没有找到匹配的旧项目，请尝试扫描目录')
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('请求超时，请稍后再试')
      } else {
        setError('搜索失败: ' + err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  // 扫描目录
  const handleScan = async () => {
    if (!scanPath.trim()) {
      setError('请输入目录路径')
      return
    }

    setLoading(true)
    setError(null)
    setScanResult(null)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 扫描可能需要更长时间

      const response = await fetch('/api/matching/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dir_path: scanPath }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      setScanResult(data)
      if (!data.success) {
        setError(data.message)
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('扫描超时，目录可能过大或不存在')
      } else {
        setError('扫描失败: ' + err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  // 预览项目
  const handlePreview = async (projectId) => {
    setLoading(true)
    setError(null)
    setPreviewData(null)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const response = await fetch(`/api/matching/preview/${projectId}`, {
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      setPreviewData(data)
      setSelectedProject(projectId)
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('预览超时')
      } else {
        setError('预览失败: ' + err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  // 加载已存在的索引
  useEffect(() => {
    const loadExistingIndex = async () => {
      try {
        const response = await fetch('/api/matching/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
        if (response.ok) {
          const data = await response.json()
          if (data.length > 0) {
            setSearchResults(data)
          }
        }
      } catch (err) {
        // 忽略错误，可能索引文件不存在
      }
    }
    loadExistingIndex()
  }, [])

  return (
    <div className="matching-page">
      <div className="matching-header">
        <h2>旧项目匹配</h2>
        <div className="section-tabs">
          <button
            className={`section-tab ${activeSection === 'search' ? 'active' : ''}`}
            onClick={() => setActiveSection('search')}
          >
            搜索匹配
          </button>
          <button
            className={`section-tab ${activeSection === 'scan' ? 'active' : ''}`}
            onClick={() => setActiveSection('scan')}
          >
            扫描目录
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="matching-content">
        {activeSection === 'search' && (
          <div className="search-section">
            <div className="search-form">
              <div className="form-group">
                <label>项目类型</label>
                <select
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value)}
                >
                  <option value="">请选择类型</option>
                  <option value="学校">学校</option>
                  <option value="办公">办公</option>
                  <option value="住宅">住宅</option>
                  <option value="医院">医院</option>
                  <option value="商业">商业</option>
                  <option value="工业">工业</option>
                  <option value="其他">其他</option>
                </select>
              </div>
              <div className="form-group">
                <label>关键词</label>
                <input
                  type="text"
                  value={searchKeywords}
                  onChange={(e) => setSearchKeywords(e.target.value)}
                  placeholder="例如：实验室、教学楼"
                />
              </div>
              <button
                className="btn-primary"
                onClick={handleSearch}
                disabled={loading}
              >
                {loading ? '搜索中...' : '搜索'}
              </button>
            </div>

            <div className="search-results">
              {loading && <div className="loading">搜索中...</div>}
              {!loading && searchResults.length > 0 && (
                <div className="results-list">
                  <h3>搜索结果（TOP {Math.min(5, searchResults.length)}）</h3>
                  {searchResults.map((project) => (
                    <div
                      key={project.id}
                      className={`result-item ${selectedProject === project.id ? 'selected' : ''}`}
                      onClick={() => handlePreview(project.id)}
                    >
                      <div className="result-header">
                        <span className="file-name">{project.file_name}</span>
                        <span className="match-score">匹配度：{project.match_score.toFixed(1)}%</span>
                      </div>
                      <div className="result-info">
                        <span className="project-type">类型：{project.project_type}</span>
                        <span className="row-count">行数：{project.row_count}</span>
                      </div>
                      <div className="match-reason">{project.match_reason}</div>
                    </div>
                  ))}
                </div>
              )}
              {!loading && searchResults.length === 0 && !error && (
                <div className="empty-state">
                  <p>输入项目类型或关键词开始搜索</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeSection === 'scan' && (
          <div className="scan-section">
            <div className="scan-form">
              <div className="form-group">
                <label>目录路径</label>
                <input
                  type="text"
                  value={scanPath}
                  onChange={(e) => setScanPath(e.target.value)}
                  placeholder="例如：E:\旧项目目录"
                />
              </div>
              <button
                className="btn-primary"
                onClick={handleScan}
                disabled={loading}
              >
                {loading ? '扫描中...' : '扫描'}
              </button>
            </div>

            <div className="scan-results">
              {loading && <div className="loading">扫描中，请稍候...</div>}
              {scanResult && (
                <div className="scan-result">
                  <h3>扫描结果</h3>
                  <div className="result-summary">
                    <p>状态：{scanResult.success ? '成功' : '失败'}</p>
                    <p>信息：{scanResult.message}</p>
                    {scanResult.success && (
                      <p>找到项目：{scanResult.total_count} 个</p>
                    )}
                  </div>
                  {scanResult.success && scanResult.projects.length > 0 && (
                    <div className="scanned-projects">
                      <h4>扫描到的项目：</h4>
                      <ul>
                        {scanResult.projects.slice(0, 10).map((project, index) => (
                          <li key={index}>
                            {project.file_name} - {project.project_type}
                          </li>
                        ))}
                        {scanResult.projects.length > 10 && (
                          <li>...还有 {scanResult.projects.length - 10} 个项目</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {!loading && !scanResult && (
                <div className="empty-state">
                  <p>输入旧项目目录路径开始扫描</p>
                </div>
              )}
            </div>
          </div>
        )}

        {previewData && (
          <div className="preview-section">
            <div className="preview-header">
              <h3>项目预览：{previewData.file_name}</h3>
              <button
                className="btn-secondary"
                onClick={() => {
                  setPreviewData(null)
                  setSelectedProject(null)
                }}
              >
                关闭预览
              </button>
            </div>
            <div className="preview-info">
              <span>类型：{previewData.project_type}</span>
              <span>工作表：{previewData.sheet_names.join(', ')}</span>
              <span>总行数：{previewData.row_count}</span>
            </div>
            <div className="preview-table-container">
              <table className="preview-table">
                <thead>
                  <tr>
                    {previewData.preview_data[0]?.map((header, index) => (
                      <th key={index}>{header || `列${index + 1}`}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.preview_data.slice(1).map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex}>{cell !== null ? String(cell) : ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .matching-page {
          padding: 20px;
        }
        .matching-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .matching-header h2 {
          margin: 0;
          font-size: 20px;
          color: #1e293b;
        }
        .section-tabs {
          display: flex;
          gap: 8px;
        }
        .section-tab {
          padding: 8px 16px;
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          color: #64748b;
          transition: all 0.2s;
        }
        .section-tab.active {
          background: #4f46e5;
          color: white;
          border-color: #4f46e5;
        }
        .section-tab:hover {
          border-color: #4f46e5;
          color: #4f46e5;
        }
        .section-tab.active:hover {
          color: white;
        }
        .error-message {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .error-message button {
          background: none;
          border: none;
          color: #dc2626;
          cursor: pointer;
          font-size: 16px;
          padding: 0 4px;
        }
        .matching-content {
          background: white;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
        }
        .search-section, .scan-section {
          padding: 20px;
        }
        .search-form, .scan-form {
          display: flex;
          gap: 16px;
          align-items: flex-end;
          margin-bottom: 20px;
        }
        .form-group {
          flex: 1;
        }
        .form-group label {
          display: block;
          margin-bottom: 6px;
          font-size: 14px;
          font-weight: 500;
          color: #1e293b;
        }
        .form-group input, .form-group select {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          font-size: 14px;
        }
        .form-group input:focus, .form-group select:focus {
          outline: none;
          border-color: #4f46e5;
        }
        .btn-primary {
          padding: 8px 16px;
          background: #4f46e5;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          white-space: nowrap;
        }
        .btn-primary:hover {
          background: #4338ca;
        }
        .btn-primary:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }
        .btn-secondary {
          padding: 6px 12px;
          background: white;
          color: #64748b;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }
        .btn-secondary:hover {
          background: #f8fafc;
        }
        .loading {
          text-align: center;
          padding: 40px;
          color: #64748b;
        }
        .empty-state {
          text-align: center;
          padding: 40px;
          color: #94a3b8;
        }
        .results-list {
          margin-top: 20px;
        }
        .results-list h3 {
          margin: 0 0 16px 0;
          font-size: 16px;
          color: #1e293b;
        }
        .result-item {
          padding: 16px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          margin-bottom: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .result-item:hover {
          border-color: #4f46e5;
          box-shadow: 0 2px 8px rgba(79, 70, 229, 0.1);
        }
        .result-item.selected {
          border-color: #4f46e5;
          background: #f5f3ff;
        }
        .result-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .file-name {
          font-weight: 600;
          color: #1e293b;
        }
        .match-score {
          background: #dcfce7;
          color: #166534;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
        }
        .result-info {
          display: flex;
          gap: 16px;
          margin-bottom: 8px;
          font-size: 14px;
          color: #64748b;
        }
        .match-reason {
          font-size: 13px;
          color: #94a3b8;
        }
        .scan-result {
          margin-top: 20px;
        }
        .scan-result h3 {
          margin: 0 0 16px 0;
          font-size: 16px;
          color: #1e293b;
        }
        .result-summary {
          background: #f8fafc;
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 16px;
        }
        .result-summary p {
          margin: 4px 0;
          font-size: 14px;
          color: #1e293b;
        }
        .scanned-projects h4 {
          margin: 0 0 8px 0;
          font-size: 14px;
          color: #1e293b;
        }
        .scanned-projects ul {
          margin: 0;
          padding-left: 20px;
        }
        .scanned-projects li {
          font-size: 14px;
          color: #64748b;
          margin-bottom: 4px;
        }
        .preview-section {
          padding: 20px;
          border-top: 1px solid #e2e8f0;
        }
        .preview-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .preview-header h3 {
          margin: 0;
          font-size: 16px;
          color: #1e293b;
        }
        .preview-info {
          display: flex;
          gap: 16px;
          margin-bottom: 16px;
          font-size: 14px;
          color: #64748b;
        }
        .preview-table-container {
          overflow-x: auto;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
        }
        .preview-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .preview-table th, .preview-table td {
          padding: 8px 12px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
        }
        .preview-table th {
          background: #f8fafc;
          font-weight: 600;
          color: #1e293b;
          position: sticky;
          top: 0;
        }
        .preview-table tr:hover td {
          background: #f8fafc;
        }
      `}</style>
    </div>
  )
}

export default Matching
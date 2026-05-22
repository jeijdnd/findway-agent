import React, { useState, useRef, useCallback } from 'react'

function Compare() {
  const [fileA, setFileA] = useState(null)
  const [fileB, setFileB] = useState(null)
  const [sheetA, setSheetA] = useState('')
  const [sheetB, setSheetB] = useState('')
  const [keyField, setKeyField] = useState('编号')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [dragOver, setDragOver] = useState(null)

  const fileInputA = useRef(null)
  const fileInputB = useRef(null)

  const handleUpload = async (file, side) => {
    setError(null)
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      const response = await fetch('/api/compare/upload', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.detail || 'HTTP ' + response.status)
      }

      const data = await response.json()
      const fileInfo = { name: data.file_name, path: data.file_path, sheets: data.sheets }

      if (side === 'a') {
        setFileA(fileInfo)
        if (data.sheets.length > 0) setSheetA(data.sheets[0].name)
      } else {
        setFileB(fileInfo)
        if (data.sheets.length > 0) setSheetB(data.sheets[0].name)
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('上传超时，请检查文件大小')
      } else {
        setError('上传失败: ' + err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e, side) => {
    const file = e.target.files[0]
    if (file) handleUpload(file, side)
    e.target.value = ''
  }

  const handleDrop = useCallback((e, side) => {
    e.preventDefault()
    setDragOver(null)
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file, side)
  }, [])

  const handleDragOver = (e, side) => {
    e.preventDefault()
    setDragOver(side)
  }

  const handleDragLeave = () => {
    setDragOver(null)
  }

  const handleCompare = async () => {
    if (!fileA || !fileB) {
      setError('请先上传两个清单文件')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      const response = await fetch('/api/compare/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_path_a: fileA.path,
          file_path_b: fileB.path,
          key_field: keyField,
          sheet_name_a: sheetA || undefined,
          sheet_name_b: sheetB || undefined
        }),
        signal: controller.signal
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.detail || 'HTTP ' + response.status)
      }

      const data = await response.json()
      setResult(data)
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('对比超时，请稍后再试')
      } else {
        setError('对比失败: ' + err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    if (!result) return

    try {
      const formData = new FormData()
      formData.append('compare_data', JSON.stringify(result))

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      const response = await fetch('/api/compare/export', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error('HTTP ' + response.status)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = '清单对比报告.xlsx'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      setError('导出失败: ' + err.message)
    }
  }

  const renderDropZone = (side, file, label) => {
    const isDragOver = dragOver === side
    return (
      <div
        className={'drop-zone' + (isDragOver ? ' drag-over' : '') + (file ? ' has-file' : '')}
        onDrop={(e) => handleDrop(e, side)}
        onDragOver={(e) => handleDragOver(e, side)}
        onDragLeave={handleDragLeave}
        onClick={() => side === 'a' ? fileInputA.current?.click() : fileInputB.current?.click()}
      >
        <input
          ref={side === 'a' ? fileInputA : fileInputB}
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => handleFileChange(e, side)}
          style={{ display: 'none' }}
        />
        {file ? (
          <div className="file-info">
            <div className="file-icon">&#128196;</div>
            <div className="file-name">{file.name}</div>
            <div className="file-detail">{file.sheets.length} 个工作表</div>
            <button
              className="btn-text"
              onClick={(e) => {
                e.stopPropagation()
                side === 'a' ? setFileA(null) : setFileB(null)
              }}
            >
              更换文件
            </button>
          </div>
        ) : (
          <div className="drop-hint">
            <div className="drop-icon">&#128194;</div>
            <div>点击选择或拖放 {label} 文件</div>
            <div className="drop-sub">支持 .xlsx / .xls 格式</div>
          </div>
        )}
      </div>
    )
  }

  const renderResult = () => {
    if (!result) return null
    const { added, removed, modified, unchanged, summary } = result

    return (
      <div className="compare-result">
        <div className="result-header">
          <h3>对比结果</h3>
          <button className="btn-primary" onClick={handleExport}>
            &#128190; 导出报告
          </button>
        </div>

        <div className="summary-cards">
          <div className="summary-card total">
            <div className="card-number">{summary.total_old}</div>
            <div className="card-label">旧版行数</div>
          </div>
          <div className="summary-card total">
            <div className="card-number">{summary.total_new}</div>
            <div className="card-label">新版行数</div>
          </div>
          <div className="summary-card added">
            <div className="card-number">{summary.added_count}</div>
            <div className="card-label">新增</div>
          </div>
          <div className="summary-card removed">
            <div className="card-number">{summary.removed_count}</div>
            <div className="card-label">删除</div>
          </div>
          <div className="summary-card modified">
            <div className="card-number">{summary.modified_count}</div>
            <div className="card-label">修改</div>
          </div>
          <div className="summary-card unchanged">
            <div className="card-number">{summary.unchanged_count}</div>
            <div className="card-label">不变</div>
          </div>
        </div>

        {added.length > 0 && (
          <div className="diff-section">
            <h4 className="diff-title added">&#10003; 新增项 ({added.length})</h4>
            <div className="diff-table-container">
              <table className="diff-table">
                <thead>
                  <tr>
                    <th>{summary.key_field}</th>
                    {summary.headers_b?.filter(h => h !== summary.key_field).slice(0, 8).map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {added.slice(0, 20).map((item, i) => (
                    <tr key={i} className="row-added">
                      <td className="cell-key">{item.key}</td>
                      {summary.headers_b?.filter(h => h !== summary.key_field).slice(0, 8).map(h => (
                        <td key={h}>{item.data?.[h] || ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {added.length > 20 && <div className="more-hint">...还有 {added.length - 20} 项</div>}
            </div>
          </div>
        )}

        {removed.length > 0 && (
          <div className="diff-section">
            <h4 className="diff-title removed">&#10007; 删除项 ({removed.length})</h4>
            <div className="diff-table-container">
              <table className="diff-table">
                <thead>
                  <tr>
                    <th>{summary.key_field}</th>
                    {summary.headers_a?.filter(h => h !== summary.key_field).slice(0, 8).map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {removed.slice(0, 20).map((item, i) => (
                    <tr key={i} className="row-removed">
                      <td className="cell-key">{item.key}</td>
                      {summary.headers_a?.filter(h => h !== summary.key_field).slice(0, 8).map(h => (
                        <td key={h}>{item.data?.[h] || ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {removed.length > 20 && <div className="more-hint">...还有 {removed.length - 20} 项</div>}
            </div>
          </div>
        )}

        {modified.length > 0 && (
          <div className="diff-section">
            <h4 className="diff-title modified">&#9998; 修改项 ({modified.length})</h4>
            <div className="diff-table-container">
              <table className="diff-table">
                <thead>
                  <tr>
                    <th>{summary.key_field}</th>
                    <th>修改字段</th>
                    <th>旧值</th>
                    <th>新值</th>
                  </tr>
                </thead>
                <tbody>
                  {modified.slice(0, 30).map((item, i) => (
                    <React.Fragment key={i}>
                      {item.changed_fields?.slice(0, 3).map((change, j) => (
                        <tr key={i + '-' + j} className="row-modified">
                          {j === 0 && (
                            <td className="cell-key" rowSpan={Math.min(item.changed_fields.length, 3)}>
                              {item.key}
                            </td>
                          )}
                          <td>{change.field}</td>
                          <td className="cell-old">{change.old_value}</td>
                          <td className="cell-new">{change.new_value}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              {modified.length > 30 && <div className="more-hint">...还有 {modified.length - 30} 项</div>}
            </div>
          </div>
        )}

        {added.length === 0 && removed.length === 0 && modified.length === 0 && (
          <div className="diff-section">
            <div className="no-diff">&#10003; 两份清单完全一致，无差异</div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="compare-page">
      <div className="compare-header">
        <h2>清单对比</h2>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      <div className="compare-content">
        <div className="upload-section">
          <div className="upload-row">
            {renderDropZone('a', fileA, '旧版清单')}
            <div className="vs-badge">VS</div>
            {renderDropZone('b', fileB, '新版清单')}
          </div>

          <div className="compare-options">
            <div className="form-group" style={{ flex: 1 }}>
              <label>匹配主键字段</label>
              <input
                type="text"
                value={keyField}
                onChange={(e) => setKeyField(e.target.value)}
                placeholder="例如：编号"
              />
            </div>
            {fileA && fileA.sheets.length > 1 && (
              <div className="form-group" style={{ flex: 1 }}>
                <label>旧版工作表</label>
                <select value={sheetA} onChange={(e) => setSheetA(e.target.value)}>
                  {fileA.sheets.map(s => (
                    <option key={s.name} value={s.name}>{s.name} ({s.total_rows}行)</option>
                  ))}
                </select>
              </div>
            )}
            {fileB && fileB.sheets.length > 1 && (
              <div className="form-group" style={{ flex: 1 }}>
                <label>新版工作表</label>
                <select value={sheetB} onChange={(e) => setSheetB(e.target.value)}>
                  {fileB.sheets.map(s => (
                    <option key={s.name} value={s.name}>{s.name} ({s.total_rows}行)</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <button
            className="btn-primary btn-compare"
            onClick={handleCompare}
            disabled={loading || !fileA || !fileB}
          >
            {loading ? '对比中...' : '开始对比'}
          </button>
        </div>

        {loading && !result && (
          <div className="loading">正在对比，请稍候...</div>
        )}

        {renderResult()}
      </div>

      <style>{`
        .compare-page { padding: 20px; }
        .compare-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .compare-header h2 { margin: 0; font-size: 20px; color: #1e293b; }
        .error-message { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 12px; border-radius: 8px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
        .error-message button { background: none; border: none; color: #dc2626; cursor: pointer; font-size: 16px; }
        .compare-content { background: white; border-radius: 8px; border: 1px solid #e2e8f0; padding: 20px; }
        .upload-section { margin-bottom: 20px; }
        .upload-row { display: flex; gap: 16px; align-items: stretch; margin-bottom: 16px; }
        .vs-badge { display: flex; align-items: center; justify-content: center; width: 48px; font-size: 16px; font-weight: 700; color: #94a3b8; flex-shrink: 0; }
        .drop-zone { flex: 1; border: 2px dashed #e2e8f0; border-radius: 10px; padding: 24px; text-align: center; cursor: pointer; transition: all 0.2s; min-height: 140px; display: flex; align-items: center; justify-content: center; }
        .drop-zone:hover { border-color: #4f46e5; background: #f5f3ff; }
        .drop-zone.drag-over { border-color: #4f46e5; background: #ede9fe; }
        .drop-zone.has-file { border-color: #22c55e; border-style: solid; background: #f0fdf4; }
        .drop-hint { color: #94a3b8; }
        .drop-icon { font-size: 32px; margin-bottom: 8px; }
        .drop-sub { font-size: 12px; margin-top: 4px; color: #cbd5e1; }
        .file-info { color: #1e293b; }
        .file-icon { font-size: 32px; margin-bottom: 8px; }
        .file-name { font-weight: 600; font-size: 15px; margin-bottom: 4px; }
        .file-detail { font-size: 13px; color: #64748b; margin-bottom: 8px; }
        .btn-text { background: none; border: none; color: #4f46e5; cursor: pointer; font-size: 13px; text-decoration: underline; }
        .compare-options { display: flex; gap: 16px; margin-bottom: 16px; }
        .compare-options .form-group { margin-bottom: 0; }
        .btn-compare { width: 100%; padding: 12px; font-size: 16px; }
        .btn-primary { padding: 8px 16px; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; transition: background 0.2s; }
        .btn-primary:hover { background: #4338ca; }
        .btn-primary:disabled { background: #9ca3af; cursor: not-allowed; }
        .loading { text-align: center; padding: 40px; color: #64748b; }
        .compare-result { margin-top: 24px; }
        .result-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .result-header h3 { margin: 0; font-size: 18px; color: #1e293b; }
        .summary-cards { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
        .summary-card { flex: 1; min-width: 80px; padding: 12px; border-radius: 8px; text-align: center; }
        .summary-card.total { background: #f1f5f9; }
        .summary-card.added { background: #dcfce7; }
        .summary-card.removed { background: #fee2e2; }
        .summary-card.modified { background: #fef3c7; }
        .summary-card.unchanged { background: #f1f5f9; }
        .card-number { font-size: 24px; font-weight: 700; color: #1e293b; }
        .card-label { font-size: 12px; color: #64748b; margin-top: 4px; }
        .diff-section { margin-bottom: 20px; }
        .diff-title { margin: 0 0 12px 0; font-size: 15px; padding: 8px 12px; border-radius: 6px; }
        .diff-title.added { background: #dcfce7; color: #166534; }
        .diff-title.removed { background: #fee2e2; color: #991b1b; }
        .diff-title.modified { background: #fef3c7; color: #92400e; }
        .diff-table-container { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px; }
        .diff-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .diff-table th, .diff-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #f1f5f9; white-space: nowrap; max-width: 200px; overflow: hidden; text-overflow: ellipsis; }
        .diff-table th { background: #f8fafc; font-weight: 600; color: #475569; position: sticky; top: 0; z-index: 1; }
        .diff-table tr:hover td { background: #f8fafc; }
        .cell-key { font-weight: 600; color: #1e293b; }
        .row-added td { background: #f0fdf4; }
        .row-removed td { background: #fef2f2; }
        .row-modified td { background: #fffbeb; }
        .cell-old { color: #dc2626; text-decoration: line-through; }
        .cell-new { color: #16a34a; font-weight: 500; }
        .more-hint { text-align: center; padding: 8px; font-size: 13px; color: #94a3b8; background: #f8fafc; }
        .no-diff { text-align: center; padding: 32px; color: #16a34a; font-size: 16px; }
        @media (max-width: 768px) { .upload-row { flex-direction: column; } .vs-badge { width: auto; padding: 4px 0; } .compare-options { flex-direction: column; } .summary-cards { flex-wrap: wrap; } .summary-card { min-width: calc(33% - 8px); } }
      `}</style>
    </div>
  )
}

export default Compare

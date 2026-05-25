import React, { useState, useRef, useCallback, useMemo } from 'react'

const STATUS_LABELS = {
  matched: '\u5339\u914d',
  zeroed: '\u5f52\u96f6',
  new_item: '\u65b0\u589e',
}

function MergePreview() {
  const [tudingFile, setTudingFile] = useState(null)
  const [checklistFile, setChecklistFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState(null)
  const [preview, setPreview] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  const tudingInputRef = useRef(null)
  const checklistInputRef = useRef(null)

  const handleFileSelect = (file, side) => {
    if (!file) return
    if (!file.name.toLowerCase().match(/\.xlsx?$/)) {
      setError('\u53ea\u652f\u6301 .xlsx / .xls \u683c\u5f0f')
      return
    }
    setError(null)
    setSuccessMsg(null)
    setPreview(null)
    if (side === 'tuding') setTudingFile(file)
    else setChecklistFile(file)
  }

  const handleFileChange = (e, side) => {
    const file = e.target.files[0]
    handleFileSelect(file, side)
    e.target.value = ''
  }

  const handleDrop = useCallback((e, side) => {
    e.preventDefault()
    setDragOver(null)
    const file = e.dataTransfer.files[0]
    handleFileSelect(file, side)
  }, [])

  const handleDragOver = (e, side) => {
    e.preventDefault()
    setDragOver(side)
  }

  const handleDragLeave = () => setDragOver(null)

  const buildFormData = () => {
    const formData = new FormData()
    formData.append('tuding_file', tudingFile)
    formData.append('checklist_file', checklistFile)
    return formData
  }

  const handlePreview = async () => {
    if (!tudingFile || !checklistFile) {
      setError('\u8bf7\u5148\u4e0a\u4f20\u5154\u9489\u5bfc\u51fa\u548c\u5b8c\u6574\u6e05\u5355\u6a21\u677f')
      return
    }

    setLoading(true)
    setError(null)
    setSuccessMsg(null)
    setPreview(null)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000)

      const response = await fetch('/api/merge/preview', {
        method: 'POST',
        body: buildFormData(),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || errData.message || `HTTP ${response.status}`)
      }

      const data = await response.json()
      setPreview(data)
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('\u9884\u89c8\u8d85\u65f6\uff0c\u8bf7\u68c0\u67e5\u6587\u4ef6\u5927\u5c0f\u6216\u683c\u5f0f')
      } else {
        setError('\u9884\u89c8\u5931\u8d25: ' + err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const triggerDownload = (blob, filename) => {
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  const handleApply = async () => {
    if (!tudingFile || !checklistFile || !preview) return

    setApplying(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const result = preview.result || {}
      const projectName = (result.project_name || '\u9879\u76ee').replace(/[\\/:*?"<>|]/g, '_')
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const outputName = `${projectName}_\u5b8c\u6574\u6e05\u5355_\u5408\u5e76_${dateStr}.xlsx`

      const formData = buildFormData()
      formData.append('output_name', outputName)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000)

      const response = await fetch('/api/merge/apply', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || errData.message || `HTTP ${response.status}`)
      }

      const data = await response.json()
      const downloadName = data.output_name || outputName
      const dlResponse = await fetch(`/api/merge/download/${encodeURIComponent(downloadName)}`)
      if (!dlResponse.ok) {
        throw new Error('\u6587\u4ef6\u5df2\u751f\u6210\u4f46\u4e0b\u8f7d\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5')
      }
      const blob = await dlResponse.blob()
      triggerDownload(blob, downloadName)
      setSuccessMsg(`\u5df2\u5bfc\u51fa\uff1a${downloadName}`)
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('\u5408\u5e76\u5bfc\u51fa\u8d85\u65f6\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5')
      } else {
        setError('\u5408\u5e76\u5bfc\u51fa\u5931\u8d25: ' + err.message)
      }
    } finally {
      setApplying(false)
    }
  }

  const handleReset = () => {
    setTudingFile(null)
    setChecklistFile(null)
    setPreview(null)
    setError(null)
    setSuccessMsg(null)
  }

  const detailRows = useMemo(() => {
    if (!preview?.result) return []
    const { matches = [], new_items = [] } = preview.result
    const rows = [
      ...matches.map((m) => ({ ...m, status: m.status })),
      ...new_items.map((n) => ({ ...n, status: 'new_item' })),
    ]
    return rows.sort((a, b) => String(a.code).localeCompare(String(b.code), 'zh-CN'))
  }, [preview])

  const stats = useMemo(() => {
    if (!preview?.result) return null
    const { total_matched = 0, total_new = 0, total_zeroed = 0 } = preview.result
    return {
      matched: total_matched,
      new: total_new,
      zeroed: total_zeroed,
      total: total_matched + total_new + total_zeroed,
    }
  }, [preview])

  const renderDropZone = (side, file, label) => {
    const isDragOver = dragOver === side
    const inputRef = side === 'tuding' ? tudingInputRef : checklistInputRef
    return (
      <div
        className={'drop-zone' + (isDragOver ? ' drag-over' : '') + (file ? ' has-file' : '')}
        onDrop={(e) => handleDrop(e, side)}
        onDragOver={(e) => handleDragOver(e, side)}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => handleFileChange(e, side)}
          style={{ display: 'none' }}
        />
        {file ? (
          <div className="file-info">
            <div className="file-icon">&#128196;</div>
            <div className="file-name">{file.name}</div>
            <div className="file-detail">{(file.size / 1024).toFixed(1)} KB</div>
            <button
              className="btn-text"
              onClick={(e) => {
                e.stopPropagation()
                side === 'tuding' ? setTudingFile(null) : setChecklistFile(null)
                setPreview(null)
              }}
            >
              {'\u66f4\u6362\u6587\u4ef6'}
            </button>
          </div>
        ) : (
          <div className="drop-hint">
            <div className="drop-icon">&#128194;</div>
            <div>{'\u70b9\u51fb\u9009\u62e9\u6216\u62d6\u653e ' + label}</div>
            <div className="drop-sub">{'\u652f\u6301 .xlsx / .xls \u683c\u5f0f'}</div>
          </div>
        )}
      </div>
    )
  }

  const renderEmpty = () => (
    <div className="empty-state">
      <div className="empty-icon">&#128203;</div>
      <p>{'\u4e0a\u4f20\u5154\u9489\u5bfc\u51fa\u548c\u5b8c\u6574\u6e05\u5355\u6a21\u677f\u540e\uff0c\u70b9\u51fb\u300c\u9884\u89c8\u5408\u5e76\u300d\u67e5\u770b\u7ed3\u679c'}</p>
    </div>
  )

  const renderPreview = () => {
    if (!preview || !stats) return null

    return (
      <div className="merge-result">
        <div className="result-header">
          <h3>{'\u5408\u5e76\u9884\u89c8'}</h3>
          {preview.result?.project_name && (
            <span className="project-tag">{preview.result.project_name}</span>
          )}
        </div>

        <div className="summary-cards">
          <div className="summary-card matched">
            <div className="card-number">{stats.matched}</div>
            <div className="card-label">{'\u5339\u914d\u9879'}</div>
          </div>
          <div className="summary-card new">
            <div className="card-number">{stats.new}</div>
            <div className="card-label">{'\u65b0\u589e\u9879'}</div>
          </div>
          {stats.zeroed > 0 && (
            <div className="summary-card zeroed">
              <div className="card-number">{stats.zeroed}</div>
              <div className="card-label">{'\u5f52\u96f6\u9879'}</div>
            </div>
          )}
          <div className="summary-card total">
            <div className="card-number">{stats.total}</div>
            <div className="card-label">{'\u603b\u8ba1'}</div>
          </div>
        </div>

        <div className="detail-table-container">
          <table className="detail-table">
            <thead>
              <tr>
                <th>{'\u7f16\u53f7'}</th>
                <th>{'\u540d\u79f0'}</th>
                <th>{'\u539f\u6570\u91cf'}</th>
                <th>{'\u65b0\u6570\u91cf'}</th>
                <th>{'\u72b6\u6001'}</th>
              </tr>
            </thead>
            <tbody>
              {detailRows.map((row, i) => {
                const isNew = row.status === 'new_item'
                const isZeroed = row.status === 'zeroed'
                return (
                  <tr
                    key={row.code + '-' + i}
                    className={isNew ? 'row-new' : isZeroed ? 'row-zeroed' : 'row-matched'}
                  >
                    <td className="cell-code">{row.code}</td>
                    <td>{row.name || '\u2014'}</td>
                    <td>{row.old_qty ?? 0}</td>
                    <td>{row.new_qty ?? 0}</td>
                    <td>
                      <span className={'status-badge ' + row.status}>
                        {STATUS_LABELS[row.status] || row.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="action-bar">
          <button className="btn-secondary" onClick={handleReset} disabled={applying}>
            {'\u8fd4\u56de\u4fee\u6539'}
          </button>
          <button className="btn-primary" onClick={handleApply} disabled={applying}>
            {applying ? '\u6b63\u5728\u5bfc\u51fa...' : '\u786e\u8ba4\u5408\u5e76'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="merge-page">
      <div className="merge-header">
        <h2>{'\u5408\u5e76\u9884\u89c8'}</h2>
        <p className="merge-subtitle">{'\u5154\u9489\u5bfc\u51fa + \u5b8c\u6574\u6e05\u5355\u6a21\u677f \u2192 \u9884\u89c8\u5e76\u5bfc\u51fa\u5408\u5e76\u7ed3\u679c'}</p>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      {successMsg && (
        <div className="success-message">{successMsg}</div>
      )}

      <div className="merge-content">
        <div className="upload-section">
          <div className="upload-row">
            {renderDropZone('tuding', tudingFile, '\u5154\u9489\u5bfc\u51fa (.xlsx)')}
            <div className="plus-badge">+</div>
            {renderDropZone('checklist', checklistFile, '\u5b8c\u6574\u6e05\u5355\u6a21\u677f (.xlsx)')}
          </div>

          {!preview && (
            <button
              className="btn-primary btn-preview"
              onClick={handlePreview}
              disabled={loading || !tudingFile || !checklistFile}
            >
              {loading ? '\u6b63\u5728\u9884\u89c8...' : '\u9884\u89c8\u5408\u5e76'}
            </button>
          )}
        </div>

        {loading && !preview && (
          <div className="loading">{'\u6b63\u5728\u5206\u6790\u5408\u5e76\uff0c\u8bf7\u7a0d\u5019...'}</div>
        )}

        {!loading && !preview && !error && renderEmpty()}
        {renderPreview()}
      </div>

      <style>{`
        .merge-page { padding: 20px; }
        .merge-header { margin-bottom: 20px; }
        .merge-header h2 { margin: 0 0 6px 0; font-size: 20px; color: #1e293b; }
        .merge-subtitle { margin: 0; font-size: 13px; color: #64748b; }
        .error-message { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 12px; border-radius: 8px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
        .error-message button { background: none; border: none; color: #dc2626; cursor: pointer; font-size: 16px; }
        .success-message { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 12px; border-radius: 8px; margin-bottom: 16px; }
        .merge-content { background: white; border-radius: 8px; border: 1px solid #e2e8f0; padding: 20px; }
        .upload-section { margin-bottom: 20px; }
        .upload-row { display: flex; gap: 16px; align-items: stretch; margin-bottom: 16px; }
        .plus-badge { display: flex; align-items: center; justify-content: center; width: 36px; font-size: 24px; font-weight: 300; color: #94a3b8; flex-shrink: 0; }
        .drop-zone { flex: 1; border: 2px dashed #e2e8f0; border-radius: 10px; padding: 24px; text-align: center; cursor: pointer; transition: all 0.2s; min-height: 140px; display: flex; align-items: center; justify-content: center; }
        .drop-zone:hover { border-color: #4f46e5; background: #f5f3ff; }
        .drop-zone.drag-over { border-color: #4f46e5; background: #ede9fe; }
        .drop-zone.has-file { border-color: #22c55e; border-style: solid; background: #f0fdf4; }
        .drop-hint { color: #94a3b8; }
        .drop-icon { font-size: 32px; margin-bottom: 8px; }
        .drop-sub { font-size: 12px; margin-top: 4px; color: #cbd5e1; }
        .file-info { color: #1e293b; }
        .file-icon { font-size: 32px; margin-bottom: 8px; }
        .file-name { font-weight: 600; font-size: 15px; margin-bottom: 4px; word-break: break-all; }
        .file-detail { font-size: 13px; color: #64748b; margin-bottom: 8px; }
        .btn-text { background: none; border: none; color: #4f46e5; cursor: pointer; font-size: 13px; text-decoration: underline; }
        .btn-preview { width: 100%; padding: 12px; font-size: 16px; }
        .btn-primary { padding: 8px 16px; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; transition: background 0.2s; }
        .btn-primary:hover { background: #4338ca; }
        .btn-primary:disabled { background: #9ca3af; cursor: not-allowed; }
        .btn-secondary { padding: 8px 16px; background: white; color: #475569; border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer; font-size: 14px; }
        .btn-secondary:hover { background: #f8fafc; }
        .btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }
        .loading { text-align: center; padding: 40px; color: #64748b; }
        .empty-state { text-align: center; padding: 48px 20px; color: #94a3b8; }
        .empty-icon { font-size: 48px; margin-bottom: 12px; }
        .merge-result { margin-top: 8px; }
        .result-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
        .result-header h3 { margin: 0; font-size: 18px; color: #1e293b; }
        .project-tag { font-size: 13px; background: #f1f5f9; color: #475569; padding: 4px 10px; border-radius: 12px; }
        .summary-cards { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
        .summary-card { flex: 1; min-width: 90px; padding: 14px; border-radius: 8px; text-align: center; }
        .summary-card.matched { background: #f0fdf4; }
        .summary-card.new { background: #fef9c3; }
        .summary-card.zeroed { background: #f1f5f9; }
        .summary-card.total { background: #ede9fe; }
        .card-number { font-size: 26px; font-weight: 700; color: #1e293b; }
        .card-label { font-size: 12px; color: #64748b; margin-top: 4px; }
        .detail-table-container { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px; max-height: 420px; overflow-y: auto; margin-bottom: 20px; }
        .detail-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .detail-table th, .detail-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #f1f5f9; }
        .detail-table th { background: #f8fafc; font-weight: 600; color: #475569; position: sticky; top: 0; z-index: 1; }
        .detail-table tr:hover td { filter: brightness(0.97); }
        .cell-code { font-weight: 600; color: #1e293b; }
        .row-matched td { background: white; }
        .row-new td { background: #fef9c3; }
        .row-zeroed td { background: #f8fafc; color: #94a3b8; }
        .status-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
        .status-badge.matched { background: #dcfce7; color: #166534; }
        .status-badge.new_item { background: #fef08a; color: #854d0e; }
        .status-badge.zeroed { background: #f1f5f9; color: #64748b; }
        .action-bar { display: flex; justify-content: flex-end; gap: 12px; padding-top: 4px; }
        @media (max-width: 768px) { .upload-row { flex-direction: column; } .plus-badge { width: auto; padding: 4px 0; } .summary-cards { flex-wrap: wrap; } }
      `}</style>
    </div>
  )
}

export default MergePreview

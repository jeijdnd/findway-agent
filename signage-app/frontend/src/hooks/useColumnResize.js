import { useState, useCallback, useEffect, useRef } from 'react'

/**
 * 可拖拽列宽，持久化到 localStorage
 * @param {string} storageKey
 * @param {number} defaultWidth
 * @param {number} min
 * @param {number} max
 */
export function useColumnResize(storageKey, defaultWidth, min, max) {
  const [width, setWidth] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const n = parseInt(saved, 10)
        if (!Number.isNaN(n)) return Math.min(max, Math.max(min, n))
      }
    } catch {
      // ignore
    }
    return defaultWidth
  })

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(width))
    } catch {
      // ignore
    }
  }, [storageKey, width])

  const dragging = useRef(false)

  const startDrag = useCallback(
    (e) => {
      e.preventDefault()
      dragging.current = true
      const startX = e.clientX
      const startWidth = width

      const onMove = (ev) => {
        if (!dragging.current) return
        const delta = ev.clientX - startX
        const next = Math.min(max, Math.max(min, startWidth + delta))
        setWidth(next)
      }

      const onUp = () => {
        dragging.current = false
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [width, min, max]
  )

  /** 右栏：向左拖增宽 */
  const startDragReverse = useCallback(
    (e) => {
      e.preventDefault()
      dragging.current = true
      const startX = e.clientX
      const startWidth = width

      const onMove = (ev) => {
        if (!dragging.current) return
        const delta = startX - ev.clientX
        const next = Math.min(max, Math.max(min, startWidth + delta))
        setWidth(next)
      }

      const onUp = () => {
        dragging.current = false
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [width, min, max]
  )

  return { width, setWidth, startDrag, startDragReverse }
}

import { createRoot } from 'react-dom/client'
import PermissionConfirmModal from '../components/PermissionConfirmModal'

/**
 * 显示权限确认弹窗（支持「记住授权」勾选，仅只读操作）
 * @returns {Promise<{ granted: boolean, remember: boolean }>}
 */
export function showPermissionConfirmDialog({
  title,
  message,
  detail,
  rememberable = false,
}) {
  return new Promise((resolve) => {
    const container = document.createElement('div')
    container.id = 'permission-dialog-root'
    document.body.appendChild(container)
    const root = createRoot(container)

    const cleanup = () => {
      root.unmount()
      container.remove()
    }

    const finish = (granted, remember = false) => {
      cleanup()
      resolve({ granted, remember })
    }

    root.render(
      <PermissionConfirmModal
        title={title}
        message={message}
        detail={detail}
        rememberable={rememberable}
        onConfirm={(remember) => finish(true, remember)}
        onCancel={() => finish(false, false)}
      />
    )
  })
}

import React, { useState, useCallback, useEffect, useRef } from 'react'
import type { PopupState } from '../../shared/types'

/**
 * ActionButtons 组件属性
 */
interface ActionButtonsProps {
  /** 当前 UI 状态，决定显示哪些按钮组合 */
  status: PopupState
  /** 复制到剪贴板（由父组件执行 navigator.clipboard.writeText） */
  onCopy: () => void
  /** 重新翻译（重置状态并重新开始） */
  onRetranslate: () => void
  /** 取消翻译 */
  onCancel: () => void
  /** 下载为 .md 文件 */
  onDownload: () => void
  /** 打开设置页面 */
  onOpenSettings: () => void
  /** 翻译结果字数（仅 done 状态使用） */
  wordCount: number
  /** 翻译后的完整文本（用于复制/下载） */
  translatedText: string
}

/**
 * 操作按钮组件：根据 status 渲染不同的按钮组合。
 *
 * 按钮组合对照表：
 *   translating → 📋 复制 / 🔄 重新翻译 / ✋ 取消
 *   done        → 📋 复制 / 🔄 重新翻译 / ⬇ 下载 Markdown
 *   error       → 🔄 重新翻译 / ⚙ 前往设置
 *   idle / extracting → 不渲染
 */
const ActionButtons: React.FC<ActionButtonsProps> = ({
  status,
  onCopy,
  onRetranslate,
  onCancel,
  onDownload,
  onOpenSettings,
}) => {
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>()

  /** 复制点击：调用父组件回调 + 显示"已复制"提示，2 秒后自动消失 */
  const handleCopy = useCallback(() => {
    onCopy()
    setCopied(true)
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current)
    }
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000)
  }, [onCopy])

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current)
      }
    }
  }, [])

  /* ----- translating 状态 ----- */
  if (status === 'translating') {
    return (
      <div className="action-buttons">
        <button className="action-btn" type="button" onClick={handleCopy}>
          📋 复制
        </button>
        <button className="action-btn" type="button" onClick={onRetranslate}>
          🔄 重新翻译
        </button>
        <button
          className="action-btn action-btn--cancel"
          type="button"
          onClick={onCancel}
        >
          ✋ 取消
        </button>
        {copied && <span className="copy-toast">已复制</span>}
      </div>
    )
  }

  /* ----- done 状态 ----- */
  if (status === 'done') {
    return (
      <div className="action-buttons">
        <button className="action-btn" type="button" onClick={handleCopy}>
          📋 复制
        </button>
        <button className="action-btn" type="button" onClick={onRetranslate}>
          🔄 重新翻译
        </button>
        <button className="action-btn" type="button" onClick={onDownload}>
          ⬇ 下载 Markdown
        </button>
        {copied && <span className="copy-toast">已复制</span>}
      </div>
    )
  }

  /* ----- error 状态 ----- */
  if (status === 'error') {
    return (
      <div className="action-buttons">
        <button className="action-btn" type="button" onClick={onRetranslate}>
          🔄 重新翻译
        </button>
        <button className="action-btn" type="button" onClick={onOpenSettings}>
          ⚙ 前往设置
        </button>
      </div>
    )
  }

  /* idle / extracting 不渲染 */
  return null
}

export default ActionButtons
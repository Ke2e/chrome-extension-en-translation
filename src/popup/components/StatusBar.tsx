import React from 'react'
import type { PopupState } from '../../shared/types'

/**
 * StatusBar 组件属性
 */
interface StatusBarProps {
  /** 当前 UI 状态 */
  status: PopupState
  /** 翻译完成时的字数，仅 done 状态使用 */
  wordCount: number
}

/** 各状态对应的提示文字，done 需要动态拼接字数 */
const STATUS_TEXT: Record<
  PopupState,
  string | ((wordCount: number) => string)
> = {
  idle: '◇ 网页翻译助手',
  extracting: '⏳ 正在提取文章内容...',
  translating: '✅ 文章提取完成 | 📝 正在翻译...',
  done: (wordCount: number) => `✅ 翻译完成 | 共 ${wordCount} 字`,
  error: '❌ 翻译失败',
}

/** 根据状态解析最终显示文案 */
function resolveText(
  status: PopupState,
  wordCount: number,
): string {
  const entry = STATUS_TEXT[status]
  return typeof entry === 'function' ? entry(wordCount) : entry
}

/**
 * 状态栏组件：顶部展示标题，下方根据 status 显示对应的状态文字。
 */
const StatusBar: React.FC<StatusBarProps> = ({ status, wordCount }) => {
  const text = resolveText(status, wordCount)
  return (
    <div className="status-bar__row">{text}</div>
  )
}

export default StatusBar
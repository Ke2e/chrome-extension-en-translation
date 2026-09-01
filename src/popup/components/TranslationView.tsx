import React from 'react'
import { MarkdownRenderer } from 'md-wx'
import 'md-wx/dist/style.css'

/**
 * TranslationView 组件属性
 */
interface TranslationViewProps {
  /** 待渲染的 Markdown 文本（翻译缓冲区） */
  markdown: string
  /** 是否显示闪烁光标（翻译中状态） */
  showCursor: boolean
}

/**
 * 翻译展示组件：包裹 md-wx 的 MarkdownRenderer，
 * 配置为纯展示模式（关闭设置/复制/主题/视图切换），
 * 翻译中时在底部显示闪烁光标。
 */
const TranslationView: React.FC<TranslationViewProps> = ({
  markdown,
  showCursor,
}) => {
  return (
    <div className="translation-view">
      <MarkdownRenderer
        markdown={markdown}
        showSettings={false}
        enableCopy={false}
        enableThemeSwitch={false}
        enableViewModeToggle={false}
        defaultViewMode="mobile"
      />
      {showCursor && <span className="cursor-blink" />}
    </div>
  )
}

export default TranslationView
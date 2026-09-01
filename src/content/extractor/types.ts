/**
 * 内容提取器中间结果类型
 *
 * 该类型描述「从页面 DOM 提取出的干净文章 HTML 与元数据」，是 Markdown
 * 转换（converter）之前的中间产物。最终传给 Popup 时由 content.ts 组装为
 * src/shared/types.ts 中的 ExtractResult（含 markdown 字段）。
 */

/** 提取引擎的统一输出 */
export interface ExtractResult {
  /** 文章标题，缺失时回退为页面标题 */
  title: string
  /** 作者名，未知时为空字符串 */
  author: string
  /** 提取并净化后的文章 HTML，已过滤导航、侧边栏、广告、页脚等非正文内容 */
  content: string
}

/** 判定存在有效文章所需的最低正文字符长度 */
export const MIN_CONTENT_LENGTH = 200

/** 归一化标题/作者等单一文本值：折叠空白并去首尾空格 */
export function cleanText(value: string | null | undefined): string {
  if (value === null || value === undefined) return ''
  return value.replace(/\s+/g, ' ').trim()
}
/**
 * Defuddle 内容提取器（主引擎）
 *
 * 由 Obsidian 作者 kepano 开发，对正文提取更宽容，并内置 HTML 标准化
 * （脚注、代码块、公式等），自动清理导航/广告等非正文内容。
 */
import Defuddle from 'defuddle'
import { cleanText, type ExtractResult } from './types'

/**
 * 使用 Defuddle 从文档中提取文章内容。
 * @param doc   页面 DOM（Document），Content Script 注入环境下的当前页面
 * @param url   当前页面 URL，用于将相对路径的图片/链接解析为绝对地址
 * @returns     提取结果；解析异常或内容为空时返回 null
 */
export default function extractWithDefuddle(
  doc: Document,
  url: string,
): ExtractResult | null {
  try {
    const parser = new Defuddle(doc, {
      url,
      // 仅输出原始 HTML，统一交由 Turndown 转 Markdown，保证双引擎结果一致
      markdown: false,
    })
    const result = parser.parse()
    if (
      !result ||
      typeof result.content !== 'string' ||
      result.content.length === 0
    ) {
      return null
    }
    return {
      title: cleanText(result.title) || cleanText(doc.title),
      author: cleanText(result.author),
      content: result.content,
    }
  } catch (error) {
    console.warn('[extractor] Defuddle 解析失败:', error)
    return null
  }
}
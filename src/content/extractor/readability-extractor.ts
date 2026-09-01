/**
 * Mozilla Readability 内容提取器（降级方案）
 *
 * Defuddle 无法提取或质量不达标时使用，作为成熟兜底方案覆盖更多页面。
 */
import { Readability } from '@mozilla/readability'
import { cleanText, type ExtractResult } from './types'

/**
 * 使用 Readability 从文档中提取文章内容。
 * @param doc 页面 DOM（Document）
 * @returns   提取结果；解析异常或未解析到文章时返回 null
 */
export default function extractWithReadability(
  doc: Document,
): ExtractResult | null {
  try {
    const article = new Readability(doc, { keepClasses: false }).parse()
    if (
      !article ||
      typeof article.content !== 'string' ||
      article.content.length === 0
    ) {
      return null
    }
    return {
      title: cleanText(article.title) || cleanText(doc.title),
      author: cleanText(article.byline),
      content: article.content,
    }
  } catch (error) {
    console.warn('[extractor] Readability 解析失败:', error)
    return null
  }
}
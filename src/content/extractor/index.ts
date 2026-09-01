/**
 * 内容提取器入口
 *
 * 策略：优先使用 Defuddle，对结果做「文章性」校验；不达标时自动降级为
 * Readability。两者均失败（或页面本身并非文章）时返回 null。
 */
import extractWithDefuddle from './defuddle-extractor'
import extractWithReadability from './readability-extractor'
import { MIN_CONTENT_LENGTH, type ExtractResult } from './types'

/**
 * 粗糙判断一段 HTML 是否像一篇文章。
 * 过滤掉长度过短、无正文段落、以及以链接文本为主的导航/索引类页面。
 */
export function isArticleLike(html: string): boolean {
  if (!html || html.length === 0) return false

  const container = document.createElement('div')
  container.innerHTML = html

  const text = (container.textContent ?? '').replace(/\s+/g, ' ').trim()
  if (text.length < MIN_CONTENT_LENGTH) return false

  // 统计链接文本占比：导航栏/搜索结果通常以链接为主体
  let linkText = ''
  container.querySelectorAll('a').forEach((anchor) => {
    linkText += anchor.textContent ?? ''
  })
  const linkRatio = linkText.trim().length / text.length

  // 文章应包含正文段落
  const paragraphCount = container.querySelectorAll('p').length
  if (paragraphCount === 0) return false
  if (linkRatio > 0.5) return false
  return true
}

/**
 * 从页面文档中提取文章内容（优先 Defuddle，失败降级 Readability）。
 * @param doc 页面 DOM（Document）
 * @param url 当前页面 URL，供 Defuddle 解析相对路径资源
 * @returns   提取结果，页面非文章时返回 null
 */
export default function extractContent(
  doc: Document,
  url: string,
): ExtractResult | null {
  const defuddleResult = extractWithDefuddle(doc, url)
  if (defuddleResult && isArticleLike(defuddleResult.content)) {
    return defuddleResult
  }

  const readabilityResult = extractWithReadability(doc)
  if (readabilityResult && isArticleLike(readabilityResult.content)) {
    return readabilityResult
  }

  return null
}
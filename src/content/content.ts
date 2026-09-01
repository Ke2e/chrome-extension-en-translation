/**
 * Content Script 入口
 *
 * 注入到任意网页中，监听 EXTRACT_CONTENT 消息：调用提取引擎获得干净的
 * 文章 HTML，再经 Turndown（converter）转为 Markdown，作为 CONTENT_RESULT
 * 返回 Popup。
 */
import { MESSAGE_TYPES } from '../shared/messages'
import type { ExtractResult as MessageExtractResult } from '../shared/types'
import extractContent from './extractor'
import { cleanText } from './extractor/types'
import htmlToMarkdown from './converter/turndown'

/**
 * 快速检测页面是否可能是文章页面。
 * 在调用完整提取引擎之前做一次轻量预检，过滤明显非文章页面（视频页、首页等）。
 */
function isCandidatePage(): boolean {
  const body = document.body
  if (!body) return false

  // 正文文本少于 200 个有效字符则不可能是文章
  const text = (body.textContent ?? '').replace(/\s/g, '')
  if (text.length < 200) return false

  // 无有效段落则不可能是文章
  const paragraphs = document.querySelectorAll('p').length
  if (paragraphs < 2) return false

  return true
}

/** 提取当前页面并组装为可直接通过消息返回的结果 */
function runExtraction(): MessageExtractResult {
  const originalUrl = location.href
  // 空结果：供 Popup 展示「未在页面中找到文章内容」提示
  const empty: MessageExtractResult = {
    title: '',
    author: '',
    originalUrl,
    markdown: '',
  }

  // 快速预检：明显不是文章页面的直接返回空结果
  if (!isCandidatePage()) {
    return empty
  }

  try {
    const result = extractContent(document, originalUrl)
    if (!result) return empty
    return {
      title: cleanText(result.title),
      author: cleanText(result.author),
      originalUrl,
      markdown: htmlToMarkdown(result.content, originalUrl),
    }
  } catch (error) {
    console.warn('[content] 内容提取失败:', error)
    return empty
  }
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (
    typeof message === 'object' &&
    message !== null &&
    (message as { type: string }).type === MESSAGE_TYPES.EXTRACT_CONTENT
  ) {
    sendResponse(runExtraction())
  }
})
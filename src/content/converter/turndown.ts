/**
 * Turndown 转换配置
 *
 * 将提取引擎输出的干净 HTML 转换为标准 Markdown，并自定义图片、链接、
 * 代码块规则（保留语言标记、资源地址转绝对路径）。
 */
import TurndownService from 'turndown'
import toAbsoluteUrl, { resolveImageUrl } from './image-handler'

/** 当前页面地址，用于把相对路径资源解析为绝对地址（同步使用，无并发问题） */
let activeBaseUrl = ''

function configureService(): TurndownService {
  const service = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  })

  // 移除默认的 image / link / pre 规则，改用自定义规则以保证行为一致
  service.rules.remove(['img', 'a', 'pre'])

  // 图片：![alt](绝对地址)，无效图片忽略
  service.addRule('image', {
    filter: 'img',
    replacement: (_content, node) => {
      const img = node as HTMLImageElement
      const src = resolveImageUrl(img.getAttribute('src') ?? '', activeBaseUrl)
      if (!src) return ''
      const alt = (img.getAttribute('alt') ?? '').replace(/\s+/g, ' ').trim()
      return `![${alt}](${src})`
    },
  })

  // 链接：[text](绝对地址)，危险协议降级为纯文本
  service.addRule('link', {
    filter: 'a',
    replacement: (content, node) => {
      const anchor = node as HTMLAnchorElement
      const href = (anchor.getAttribute('href') ?? '').trim()
      if (!href) return content
      const absolute = toAbsoluteUrl(href, activeBaseUrl)
      if (!absolute || /^(javascript:|blob:|data:text\/html)/i.test(absolute)) {
        return content
      }
      return content ? `[${content}](${absolute})` : ''
    },
  })

  // 代码块：保留语言标记 ```language
  service.addRule('codeBlock', {
    filter: (node) => node.nodeName === 'PRE',
    replacement: (content, node) => {
      const pre = node as HTMLElement
      const codeEl = pre.querySelector('code')
      const language =
        (codeEl
          ?.getAttribute('class')
          ?.match(/language-(\S+)/)?.[1] ?? '')
      return `\`\`\`${language}\n${trimTrailingNewline(content)}\n\`\`\`\n\n`
    },
  })

  return service
}

/** 移除代码内容末尾多余的换行，避免出现空行 */
function trimTrailingNewline(text: string): string {
  return text.replace(/\n+$/, '')
}

const service = configureService()

/**
 * 将 HTML 转换为 Markdown。
 * @param html    待转换的 HTML 片段
 * @param baseUrl 页面地址，用于把相对路径的图片/链接解析为绝对地址
 */
export default function htmlToMarkdown(html: string, baseUrl: string): string {
  activeBaseUrl = baseUrl
  return service.turndown(html)
}
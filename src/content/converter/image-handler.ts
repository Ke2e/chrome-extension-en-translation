/**
 * 图片 / 链接 URL 处理
 *
 * 将相对路径解析为绝对路径，并过滤掉无效或危险的资源地址。
 */

/** 可接受的 data URI 最大长度，超出视为占位/无用图片 */
const MAX_DATA_URI_LENGTH = 20000

/** 判断一个资源地址是否可安全使用 */
export function isValidImageUrl(raw: string): boolean {
  if (!raw) return false
  // 仅接受体积较小的 base64 图片，过滤超长占位 SVG 等
  if (raw.startsWith('data:')) {
    return raw.length <= MAX_DATA_URI_LENGTH
  }
  // 过滤脚本等危险协议的图片
  if (/^(javascript:|blob:)/i.test(raw)) return false
  return true
}

/**
 * 将相对路径的资源地址解析为绝对地址（以页面地址为基准）。
 * 无法解析或本身就是完整地址时原样返回。
 */
export default function toAbsoluteUrl(raw: string, baseUrl: string): string {
  if (!raw || raw.startsWith('data:')) return raw
  try {
    return new URL(raw, baseUrl).href
  } catch {
    return raw
  }
}

/**
 * 图片专用解析：先校验有效性，再解析为绝对地址。
 * 地址无效时返回空串（表示该图片应被忽略）。
 */
export function resolveImageUrl(raw: string, baseUrl: string): string {
  if (!isValidImageUrl(raw)) return ''
  return toAbsoluteUrl(raw, baseUrl)
}
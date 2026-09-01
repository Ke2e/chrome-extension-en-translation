/**
 * 全局共享类型定义
 *
 * 供 Popup、Content Script、Service Worker 三方复用。
 * 所有在此定义的类型必须可序列化（可安全通过 Chrome 消息 API 传递），
 * 禁止包含函数、DOM 节点、AbortController 等运行时对象。
 */

/** 最近一次完整翻译结果，与 chrome.storage.local 的存储结构保持一致 */
export interface TranslationResult {
  /** 文章标题 */
  title: string
  /** 作者名，未知时为空字符串 */
  author: string
  /** 原文链接 */
  originalUrl: string
  /** 原文 Markdown */
  originalMarkdown: string
  /** 翻译后的 Markdown */
  translatedMarkdown: string
  /** 翻译完成时间戳（毫秒） */
  translatedAt: number
}

/** 最近一次翻译的元数据，不包含正文，用于快速判断是否存在可用结果 */
export interface TranslationMeta {
  title: string
  originalUrl: string
  translatedAt: number
}

/** 应用配置，由设置页维护并持久化到 chrome.storage.local */
export interface AppConfig {
  /** AI 模型 API Key，仅存于 chrome.storage.local，不进入源码 */
  apiKey: string
  /** OpenAI SDK 兼容接口地址 */
  apiUrl: string
  /** 模型名称 */
  model: string
  /** 系统提示词，翻译指令 */
  systemPrompt: string
  /** 采样温度，翻译场景使用较低值保证准确性 */
  temperature: number
}

/** Popup 的 UI 状态 */
export type PopupState =
  | 'idle'
  | 'extracting'
  | 'translating'
  | 'done'
  | 'error'

/** 内容提取结果，Content Script 返回给 Popup */
export interface ExtractResult {
  title: string
  author: string
  originalUrl: string
  /** 提取后的原文 Markdown */
  markdown: string
}

/** 翻译请求上下文，Popup 发起翻译时携带的输入 */
export interface TranslateRequest {
  title: string
  originalUrl: string
  /** 待翻译的原文 Markdown */
  markdown: string
}

/** 翻译结束信息，成功与失败共用 */
export interface TranslateResult {
  /** 全文翻译完成时间戳（毫秒） */
  translatedAt: number
  /** 翻译过程中的错误信息，成功时为空字符串 */
  errorMessage: string
}
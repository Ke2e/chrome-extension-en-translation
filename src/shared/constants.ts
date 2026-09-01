/**
 * 全局共享常量定义
 *
 * 供 Popup、Content Script、Service Worker 三方复用。
 * 注意：API Key 属于敏感信息，不允许写入本文件，仅可通过设置页存入
 * chrome.storage.local。
 */

/** 默认 API 地址：阿里云 DashScope 的 OpenAI 兼容接口 */
export const DEFAULT_API_URL =
  'https://dashscope.aliyuncs.com/compatible-mode/v1'

/** 默认模型名称 */
export const DEFAULT_MODEL = 'qwen-turbo'

/** 默认采样温度，翻译场景使用较低值保证准确性 */
export const DEFAULT_TEMPERATURE = 0.3

/** 默认系统提示词（翻译指令） */
export const DEFAULT_SYSTEM_PROMPT = [
  '请将用户提供的英文 Markdown 内容翻译为中文。',
  '保留所有 Markdown 格式标记（标题、图片、链接、代码块等）。',
  '不翻译代码块中的内容。',
  '图片的 ![alt](src) 中 alt 文本需要翻译，src 保持原样。',
  '链接的 [text](url) 中 text 需要翻译，url 保持原样。',
].join('\n')

/** chrome.storage.local 中使用的存储键 */
export const STORAGE_KEYS = {
  /** 最近一次完整翻译结果 */
  LAST_TRANSLATION: 'lastTranslation',
  /** 最近一次翻译的元数据 */
  LAST_TRANSLATION_META: 'lastTranslationMeta',
  /** 应用配置（API Key、地址、模型等） */
  APP_CONFIG: 'appConfig',
} as const
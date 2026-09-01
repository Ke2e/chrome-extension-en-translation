/**
 * 翻译服务
 *
 * 负责通过 OpenAI SDK（兼容接口）调用大模型，以流式方式将
 * 英文 Markdown 原文翻译为中文，并将增量文本逐块交给调用方。
 *
 * 安全约定：API Key 仅从 chrome.storage.local 读取，绝不写入源码。
 */

import OpenAI from 'openai'
import type { AppConfig, TranslateRequest } from '../shared/types'
import {
  DEFAULT_API_URL,
  DEFAULT_MODEL,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TEMPERATURE,
  STORAGE_KEYS,
} from '../shared/constants'

/** 翻译过程中逐块回调 */
export interface TranslateCallbacks {
  /** 收到新的增量文本块时触发 */
  onChunk: (content: string) => void
}

/** 一次完整翻译的结果判定，调用方据此发出 DONE / ERROR 消息 */
export type TranslateOutcome =
  | { status: 'done' }
  | { status: 'cancelled' }
  | { status: 'error'; message: string }

/** 附加在系统提示词末尾的固定输出格式要求 */
const OUTPUT_FORMAT_PROMPT = [
  '输出格式要求：',
  '先输出一级标题：# [文章标题]。',
  '再输出引用块两行：" > **作者**: [作者名] " 与 " > **原文链接**: [原始文章 URL] "，作者名未知时填写"未知"。',
  '最后输出翻译后的正文，保留原文所有 Markdown 格式标记（标题、图片、链接、代码块、列表、引用等）。',
  '代码块中的内容保持原样，不翻译。',
  '图片的 ![alt](src) 中 alt 文本需要翻译，src 保持原样；链接的 [text](url) 中 text 需要翻译，url 保持原样。',
].join('\n')

class TranslateService {
  /**
   * 发起一次流式翻译。
   *
   * @param request   待翻译的原文信息
   * @param callbacks 增量文本回调
   * @param signal    取消信号（由 background 传入 AbortController.signal）
   * @returns 翻译结果判定，成功 / 取消 / 错误
   */
  async translate(
    request: TranslateRequest,
    callbacks: TranslateCallbacks,
    signal?: AbortSignal,
  ): Promise<TranslateOutcome> {
    const config = await this.loadConfig()

    if (!config.apiKey) {
      return { status: 'error', message: '请先在设置页配置 API Key' }
    }

    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.apiUrl,
      timeout: 60_000,
      maxRetries: 0,
      dangerouslyAllowBrowser: true,
    })

    return this.stream(client, config, request.markdown, callbacks, signal)
  }

  /** 从 chrome.storage.local 读取最新配置，缺失字段回退默认值 */
  private async loadConfig(): Promise<AppConfig> {
    const stored = await chrome.storage.local.get(STORAGE_KEYS.APP_CONFIG)
    const saved = stored[STORAGE_KEYS.APP_CONFIG] as
      Partial<AppConfig> | undefined

    return {
      apiKey: saved?.apiKey?.trim() ?? '',
      apiUrl: saved?.apiUrl?.trim() || DEFAULT_API_URL,
      model: saved?.model?.trim() || DEFAULT_MODEL,
      systemPrompt: saved?.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT,
      temperature: saved?.temperature ?? DEFAULT_TEMPERATURE,
    }
  }

  /** 拼接系统提示词：用户配置（或默认）+ 固定输出格式要求 */
  private buildSystemPrompt(config: AppConfig): string {
    return [config.systemPrompt, OUTPUT_FORMAT_PROMPT].join('\n\n')
  }

  private async stream(
    client: OpenAI,
    config: AppConfig,
    markdown: string,
    callbacks: TranslateCallbacks,
    signal?: AbortSignal,
  ): Promise<TranslateOutcome> {
    try {
      const stream = await client.chat.completions.create(
        {
          model: config.model,
          temperature: config.temperature,
          stream: true,
          messages: [
            { role: 'system', content: this.buildSystemPrompt(config) },
            { role: 'user', content: markdown },
          ],
        },
        signal ? { signal } : undefined,
      )

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content
        if (delta && delta.length > 0) {
          callbacks.onChunk(delta)
        }
      }

      return { status: 'done' }
    } catch (error) {
      if (this.isCancelled(error, signal)) {
        return { status: 'cancelled' }
      }
      return { status: 'error', message: this.mapError(error) }
    }
  }

  /** 判断异常是否由用户主动取消导致 */
  private isCancelled(error: unknown, signal?: AbortSignal): boolean {
    if (signal?.aborted) return true
    return error instanceof OpenAI.APIUserAbortError
  }

  /** 将异常归一化为面向用户的中文错误提示 */
  private mapError(error: unknown): string {
    // APIConnectionTimeoutError 继承自 APIConnectionError，须先判断超时
    if (error instanceof OpenAI.APIConnectionTimeoutError) {
      return '请求超时，请稍后重试'
    }
    if (error instanceof OpenAI.APIConnectionError) {
      return '网络连接失败，请检查网络后重试'
    }
    if (error instanceof OpenAI.APIError) {
      switch (error.status) {
        case 401:
        case 403:
          return 'API Key 无效，请检查设置'
        case 404:
          return '模型不可用，请检查模型名称配置'
        case 429:
          return '请求过于频繁，请稍后重试'
        default:
          // 暴露服务端返回的具体错误信息，便于用户/开发者定位问题根因
          return `AI 服务出错（${error.status ?? '未知'}）：${error.message}`
      }
    }
    return '翻译失败，请稍后重试'
  }
}

export default TranslateService

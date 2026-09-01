/**
 * 存储服务
 *
 * 封装 chrome.storage.local，负责翻译结果与应用配置的持久化读取与写入。
 * 约定：每次新翻译完成后覆盖上一次存储，不保留历史记录。
 */

import type {
  AppConfig,
  TranslationMeta,
  TranslationResult,
} from '../shared/types'
import {
  DEFAULT_API_URL,
  DEFAULT_MODEL,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TEMPERATURE,
  STORAGE_KEYS,
} from '../shared/constants'

class StorageService {
  /** 写入最近一次完整翻译结果（含元数据），覆盖历史，不保留上一份 */
  async saveTranslation(result: TranslationResult): Promise<void> {
    const meta: TranslationMeta = {
      title: result.title,
      originalUrl: result.originalUrl,
      translatedAt: result.translatedAt,
    }
    await chrome.storage.local.set({
      [STORAGE_KEYS.LAST_TRANSLATION]: result,
      [STORAGE_KEYS.LAST_TRANSLATION_META]: meta,
    })
  }

  /** 读取上次翻译结果，不存在时返回 null */
  async loadTranslation(): Promise<TranslationResult | null> {
    const stored = await chrome.storage.local.get(
      STORAGE_KEYS.LAST_TRANSLATION,
    )
    const saved = stored[STORAGE_KEYS.LAST_TRANSLATION] as
      | TranslationResult
      | undefined
    return saved ?? null
  }

  /** 清除已存储的翻译结果（含元数据） */
  async clearTranslation(): Promise<void> {
    await chrome.storage.local.remove([
      STORAGE_KEYS.LAST_TRANSLATION,
      STORAGE_KEYS.LAST_TRANSLATION_META,
    ])
  }

  /** 写入应用配置，整体覆盖旧配置 */
  async saveConfig(config: AppConfig): Promise<void> {
    await chrome.storage.local.set({
      [STORAGE_KEYS.APP_CONFIG]: config,
    })
  }

  /** 读取应用配置，缺失字段回退默认值 */
  async loadConfig(): Promise<AppConfig> {
    const stored = await chrome.storage.local.get(STORAGE_KEYS.APP_CONFIG)
    const saved = stored[STORAGE_KEYS.APP_CONFIG] as
      | Partial<AppConfig>
      | undefined

    return {
      apiKey: saved?.apiKey?.trim() ?? '',
      apiUrl: saved?.apiUrl?.trim() || DEFAULT_API_URL,
      model: saved?.model?.trim() || DEFAULT_MODEL,
      systemPrompt: saved?.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT,
      temperature: saved?.temperature ?? DEFAULT_TEMPERATURE,
    }
  }

  /** 清除应用配置 */
  async clearConfig(): Promise<void> {
    await chrome.storage.local.remove(STORAGE_KEYS.APP_CONFIG)
  }
}

export default StorageService
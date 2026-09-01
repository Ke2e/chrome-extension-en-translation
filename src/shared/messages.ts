/**
 * 消息协议定义
 *
 * 统一定义 Popup ↔ Content Script ↔ Service Worker 三端之间的
 * Chrome 消息 API 通信契约。
 *
 * 设计约定：
 * - 使用字符串字面量 + 判别联合（discriminated union），
 *   通过 message.type 可自动收窄 message.payload 的类型。
 * - 所有载荷必须可序列化，仅包含纯数据。
 */

import type { ExtractResult, TranslateRequest, TranslationResult } from './types'

/** 消息类型常量，运行时据此调度 */
export const MESSAGE_TYPES = {
  EXTRACT_CONTENT: 'EXTRACT_CONTENT',
  CONTENT_RESULT: 'CONTENT_RESULT',
  TRANSLATE_STREAM: 'TRANSLATE_STREAM',
  TRANSLATE_CHUNK: 'TRANSLATE_CHUNK',
  TRANSLATE_DONE: 'TRANSLATE_DONE',
  TRANSLATE_ERROR: 'TRANSLATE_ERROR',
  TRANSLATE_CANCEL: 'TRANSLATE_CANCEL',
  SAVE_RESULT: 'SAVE_RESULT',
  LOAD_RESULT: 'LOAD_RESULT',
} as const

/** 消息类型联合 */
export type MessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES]

/** 无参数消息的载荷 */
export type EmptyPayload = Record<string, never>

/** EXTRACT_CONTENT：Popup → Content，请求提取当前页面内容 */
export type ExtractContentRequest = EmptyPayload

/** CONTENT_RESULT：Content → Popup，返回提取结果 */
export type ContentResultResponse = ExtractResult

/** TRANSLATE_STREAM：Popup → Background，发起流式翻译请求 */
export type TranslateStreamRequest = TranslateRequest

/** TRANSLATE_CHUNK：Background → Popup，流式翻译逐块返回 */
export interface TranslateChunkMessage {
  /** 本次返回的增量文本块 */
  content: string
}

/** TRANSLATE_DONE：Background → Popup，翻译完成通知 */
export interface TranslateDoneMessage {
  /** 翻译完成时间戳（毫秒） */
  translatedAt: number
}

/** TRANSLATE_ERROR：Background → Popup，翻译错误通知 */
export interface TranslateErrorMessage {
  /** 面向用户的错误提示 */
  message: string
}

/** TRANSLATE_CANCEL：Popup → Background，取消翻译 */
export type TranslateCancelRequest = EmptyPayload

/** SAVE_RESULT：Popup → Background，保存翻译结果 */
export type SaveResultRequest = TranslationResult

/** LOAD_RESULT：Popup → Background，加载上次翻译结果 */
export type LoadResultRequest = EmptyPayload

/**
 * 统一扩展消息类型（判别联合）
 *
 * 使用示例：
 * ```
 * switch (msg.type) {
 *   case MESSAGE_TYPES.CONTENT_RESULT:
 *     // 此处 msg.payload 自动收窄为 ContentResultResponse
 *     break
 * }
 * ```
 */
export type ExtensionMessage =
  | { type: typeof MESSAGE_TYPES.EXTRACT_CONTENT; payload: ExtractContentRequest }
  | { type: typeof MESSAGE_TYPES.CONTENT_RESULT; payload: ContentResultResponse }
  | { type: typeof MESSAGE_TYPES.TRANSLATE_STREAM; payload: TranslateStreamRequest }
  | { type: typeof MESSAGE_TYPES.TRANSLATE_CHUNK; payload: TranslateChunkMessage }
  | { type: typeof MESSAGE_TYPES.TRANSLATE_DONE; payload: TranslateDoneMessage }
  | { type: typeof MESSAGE_TYPES.TRANSLATE_ERROR; payload: TranslateErrorMessage }
  | { type: typeof MESSAGE_TYPES.TRANSLATE_CANCEL; payload: TranslateCancelRequest }
  | { type: typeof MESSAGE_TYPES.SAVE_RESULT; payload: SaveResultRequest }
  | { type: typeof MESSAGE_TYPES.LOAD_RESULT; payload: LoadResultRequest }
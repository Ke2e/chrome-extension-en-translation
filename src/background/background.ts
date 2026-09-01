/**
 * Service Worker 入口
 *
 * 负责消息路由分发。处理：
 * - TRANSLATE_STREAM：发起流式翻译，逐块推送 TRANSLATE_CHUNK
 * - TRANSLATE_CANCEL：取消正在进行的翻译
 * - SAVE_RESULT：保存翻译结果到 storage
 * - LOAD_RESULT：加载上次翻译结果，返回给 Popup
 *
 * TRANSLATE_DONE 后自动调用 StorageService.saveTranslation() 持久化结果。
 */

import { MESSAGE_TYPES } from '../shared/messages'
import type {
  ExtensionMessage,
  TranslateStreamRequest,
  SaveResultRequest,
} from '../shared/messages'
import type { TranslationResult } from '../shared/types'
import TranslateService from './translator'
import StorageService from './storage'

const translator = new TranslateService()
const storageService = new StorageService()

/* ========== 侧边栏初始化：点击图标打开侧边栏 ========== */

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    // 静默处理，某些 Chrome 版本可能不支持
  })
})

/** 当前活动翻译的取消控制器，用于支持 TRANSLATE_CANCEL */
let abortController: AbortController | null = null

/** 当前翻译请求的上下文，用于完成后自动保存完整结果 */
let currentRequest: TranslateStreamRequest | null = null
/** 当前翻译的累计完整译文 */
let accumulatedTranslation = ''

/** 向 Popup 推送一条扩展消息 */
function sendToPopup(message: ExtensionMessage): void {
  void chrome.runtime.sendMessage(message)
}

async function handleTranslate(request: TranslateStreamRequest): Promise<void> {
  // 新的翻译开始时，中止上一次仍在进行的翻译
  abortController?.abort()
  abortController = new AbortController()

  // 记录当前请求上下文，用于后续自动保存
  currentRequest = request
  accumulatedTranslation = ''

  const outcome = await translator.translate(
    request,
    {
      onChunk: (content) => {
        accumulatedTranslation += content
        sendToPopup({
          type: MESSAGE_TYPES.TRANSLATE_CHUNK,
          payload: { content },
        })
      },
    },
    abortController.signal,
  )

  abortController = null

  if (outcome.status === 'done') {
    sendToPopup({
      type: MESSAGE_TYPES.TRANSLATE_DONE,
      payload: { translatedAt: Date.now() },
    })

    // 自动保存完整翻译结果
    if (currentRequest) {
      const result: TranslationResult = {
        title: currentRequest.title,
        author: '',
        originalUrl: currentRequest.originalUrl,
        originalMarkdown: currentRequest.markdown,
        translatedMarkdown: accumulatedTranslation,
        translatedAt: Date.now(),
      }
      await storageService.saveTranslation(result)
    }
  } else if (outcome.status === 'error') {
    sendToPopup({
      type: MESSAGE_TYPES.TRANSLATE_ERROR,
      payload: { message: outcome.message },
    })
  }

  currentRequest = null
  accumulatedTranslation = ''
}

function handleCancel(): void {
  abortController?.abort()
}

async function handleSaveResult(payload: SaveResultRequest): Promise<void> {
  await storageService.saveTranslation(payload)
}

function handleLoadResult(
  sendResponse: (response?: TranslationResult | null) => void,
): void {
  void (async () => {
    const result = await storageService.loadTranslation()
    sendResponse(result)
  })()
}

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    const msg = message as ExtensionMessage

    switch (msg.type) {
      case MESSAGE_TYPES.TRANSLATE_STREAM:
        void handleTranslate(msg.payload)
        break
      case MESSAGE_TYPES.TRANSLATE_CANCEL:
        handleCancel()
        break
      case MESSAGE_TYPES.SAVE_RESULT:
        void handleSaveResult(msg.payload)
        break
      case MESSAGE_TYPES.LOAD_RESULT:
        handleLoadResult(sendResponse)
        return true // 保持通道开放以支持异步响应
      default:
        break
    }
  },
)
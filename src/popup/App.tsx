import React, { useEffect, useState, useCallback, useRef } from 'react'
import { MESSAGE_TYPES } from '../shared/messages'
import type { ExtensionMessage } from '../shared/messages'
import type { ExtractResult, PopupState, TranslationResult } from '../shared/types'
import StatusBar from './components/StatusBar'
import TranslationView from './components/TranslationView'
import ActionButtons from './components/ActionButtons'
import '../shared/styles/tokens.css'
import './styles/popup.css'

/** 计算字符串去掉空白后的字数 */
function countChars(text: string): number {
  return text.replace(/\s/g, '').length
}

/**
 * 弹窗主组件：管理五个 UI 状态（idle / extracting / translating / done / error），
 * 通过真实消息通信驱动完整翻译流程。
 *
 * ### 数据流
 * 1. Popup 打开 → LOAD_RESULT → 加载上次结果（如有则展示）
 * 2. 点击"翻译当前页面" → EXTRACT_CONTENT → Content Script 提取 → TRANSLATE_STREAM → Background 流式翻译
 * 3. Background 逐块推送 TRANSLATE_CHUNK → Popup 累加 buffer → 打字机效果
 * 4. 翻译完成 → TRANSLATE_DONE（Background 自动保存）→ Popup 切换到 done
 * 5. 出错 → TRANSLATE_ERROR → Popup 切换到 error
 */
const App: React.FC = () => {
  const [status, setStatus] = useState<PopupState>('idle')
  const [progress, setProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [buffer, setBuffer] = useState('')

  /** 保存当前提取结果，用于重新翻译 */
  const extractResultRef = useRef<ExtractResult | null>(null)

  const wordCount = countChars(buffer)

  /* ========== 消息监听：Background → Popup ========== */

  useEffect(() => {
    const handler = (message: unknown): void => {
      const msg = message as ExtensionMessage

      switch (msg.type) {
        case MESSAGE_TYPES.TRANSLATE_CHUNK:
          setBuffer((prev) => prev + msg.payload.content)
          break
        case MESSAGE_TYPES.TRANSLATE_DONE:
          setStatus('done')
          break
        case MESSAGE_TYPES.TRANSLATE_ERROR:
          setErrorMessage(msg.payload.message)
          setStatus('error')
          break
      }
    }

    chrome.runtime.onMessage.addListener(handler)
    return () => chrome.runtime.onMessage.removeListener(handler)
  }, [])

  /* ========== 加载上次结果 ========== */

  useEffect(() => {
    chrome.runtime.sendMessage(
      { type: MESSAGE_TYPES.LOAD_RESULT, payload: {} },
      (response: TranslationResult | null) => {
        if (response && response.translatedMarkdown) {
          setBuffer(response.translatedMarkdown)
          setStatus('done')
        }
      },
    )
  }, [])

  /* ========== 回调函数 ========== */

  /** 发起提取 → 翻译完整流程 */
  const handleStart = useCallback(async (): Promise<void> => {
    setErrorMessage('')
    setBuffer('')
    setStatus('extracting')
    setProgress(0)

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      })
      if (!tab.id) {
        setErrorMessage('无法获取当前标签页')
        setStatus('error')
        return
      }

      const result = (await chrome.tabs.sendMessage(tab.id, {
        type: MESSAGE_TYPES.EXTRACT_CONTENT,
        payload: {},
      })) as ExtractResult

      if (!result.markdown) {
        setErrorMessage('未能在当前页面中找到文章内容')
        setStatus('error')
        return
      }

      // 保存提取结果，供重新翻译使用
      extractResultRef.current = result

      // 进入翻译阶段
      setProgress(100)
      setStatus('translating')
      chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.TRANSLATE_STREAM,
        payload: {
          title: result.title,
          originalUrl: result.originalUrl,
          markdown: result.markdown,
        },
      })
    } catch {
      setErrorMessage('无法与当前页面通信，请刷新后重试')
      setStatus('error')
    }
  }, [])

  /** 复制到剪贴板 */
  const handleCopy = useCallback((): void => {
    navigator.clipboard.writeText(buffer).catch(() => {
      /* 静默失败 */
    })
  }, [buffer])

  /** 重新翻译：重新发起提取 → 翻译流程 */
  const handleRetranslate = useCallback((): void => {
    // 如果已有提取结果，直接翻译，否则重新提取
    if (extractResultRef.current) {
      setBuffer('')
      setErrorMessage('')
      setStatus('translating')
      chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.TRANSLATE_STREAM,
        payload: {
          title: extractResultRef.current.title,
          originalUrl: extractResultRef.current.originalUrl,
          markdown: extractResultRef.current.markdown,
        },
      })
    } else {
      void handleStart()
    }
  }, [handleStart])

  /** 取消翻译：通知 Background 中止 + 保留已翻译部分 */
  const handleCancel = useCallback((): void => {
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.TRANSLATE_CANCEL,
      payload: {},
    })
    setProgress(0)
    setErrorMessage('')
    // 保留已翻译的部分，展示为完成状态（不报错）
    setStatus('done')
  }, [])

  /** 下载为 .md 文件 */
  const handleDownload = (): void => {
    const blob = new Blob([buffer], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '翻译结果.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  /** 打开设置页面 */
  const handleOpenSettings = (): void => {
    chrome.runtime.openOptionsPage()
  }

  /* ========== 渲染 ========== */

  return (
    <div className="popup">
      {/* 顶部标题栏 */}
      <header className="popup__header">网页翻译助手</header>

      {/* 内容区 */}
      <div className="popup__body">
        <StatusBar status={status} wordCount={wordCount} />

        {/* ----- idle ----- */}
        {status === 'idle' && (
          <div className="center">
            <button
              className="primary-btn"
              type="button"
              onClick={handleStart}
            >
              翻译当前页面
            </button>
            <p className="hint">
              点击后将从当前页面提取正文内容，并调用 AI 大模型翻译为中文，
              以打字机效果动态展示翻译结果。
            </p>
          </div>
        )}

        {/* ----- extracting ----- */}
        {status === 'extracting' && (
          <div className="center">
            <div className="progress">
              <div className="progress__bar" style={{ width: `${progress}%` }} />
            </div>
            <div className="progress__value">{progress}%</div>
          </div>
        )}

        {/* ----- translating ----- */}
        {status === 'translating' && (
          <>
            <TranslationView markdown={buffer} showCursor />
            <ActionButtons
              status={status}
              onCopy={handleCopy}
              onRetranslate={handleRetranslate}
              onCancel={handleCancel}
              onDownload={handleDownload}
              onOpenSettings={handleOpenSettings}
              wordCount={wordCount}
              translatedText={buffer}
            />
          </>
        )}

        {/* ----- done ----- */}
        {status === 'done' && (
          <>
            <TranslationView markdown={buffer} showCursor={false} />
            <ActionButtons
              status={status}
              onCopy={handleCopy}
              onRetranslate={handleRetranslate}
              onCancel={handleCancel}
              onDownload={handleDownload}
              onOpenSettings={handleOpenSettings}
              wordCount={wordCount}
              translatedText={buffer}
            />
          </>
        )}

        {/* ----- error ----- */}
        {status === 'error' && (
          <>
            <div className="error-box">
              <div className="error-box__title">❌ 翻译失败</div>
              <div className="error-box__reason">
                {errorMessage || '发生未知错误，请稍后重试。'}
              </div>
            </div>
            {/* 提取成功但翻译失败时，展示原文内容供用户手动复制 */}
            {extractResultRef.current?.markdown && (
              <div className="original-article">
                <div className="original-article__header">⚠ 当前页面原文</div>
                <div className="original-article__title">
                  {extractResultRef.current.title}
                </div>
                {(extractResultRef.current.author || extractResultRef.current.originalUrl) && (
                  <div className="original-article__meta">
                    {extractResultRef.current.author && (
                      <span>{'> 作者：'}{extractResultRef.current.author}</span>
                    )}
                    {extractResultRef.current.author && extractResultRef.current.originalUrl && <br />}
                    {extractResultRef.current.originalUrl && (
                      <span>
                        {'> 原文链接：'}
                        <a
                          href={extractResultRef.current.originalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {extractResultRef.current.originalUrl}
                        </a>
                      </span>
                    )}
                  </div>
                )}
                <TranslationView
                  markdown={extractResultRef.current.markdown}
                  showCursor={false}
                />
              </div>
            )}
            <ActionButtons
              status={status}
              onCopy={handleCopy}
              onRetranslate={handleRetranslate}
              onCancel={handleCancel}
              onDownload={handleDownload}
              onOpenSettings={handleOpenSettings}
              wordCount={wordCount}
              translatedText={buffer}
            />
          </>
        )}
      </div>

      {/* 底部固定设置入口 */}
      <footer className="popup__footer">
        <button className="footer__link" type="button" onClick={handleOpenSettings}>
          ⚙ 设置
        </button>
      </footer>
    </div>
  )
}

export default App
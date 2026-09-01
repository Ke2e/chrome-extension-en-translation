import { useCallback, useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'

import {
  DEFAULT_API_URL,
  DEFAULT_MODEL,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TEMPERATURE,
  STORAGE_KEYS,
} from '../../shared/constants'
import type { AppConfig } from '../../shared/types'

/** 表单字段的错误信息 */
type FormErrors = {
  apiKey?: string
  apiUrl?: string
  model?: string
}

/** 页面保存后的状态提示 */
type StatusMessage =
  | { type: 'success'; text: string }
  | { type: 'error'; text: string }
  | null

/** 生成一份完整的默认配置（apiKey 为空） */
const createDefaultConfig = (): AppConfig => ({
  apiKey: '',
  apiUrl: DEFAULT_API_URL,
  model: DEFAULT_MODEL,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  temperature: DEFAULT_TEMPERATURE,
})

/** 校验表单字段，返回错误信息字典（无错误项时为空对象） */
const validate = (config: AppConfig): FormErrors => {
  const errors: FormErrors = {}

  if (!config.apiKey.trim()) {
    errors.apiKey = 'API Key 不能为空'
  }

  if (!config.apiUrl.trim()) {
    errors.apiUrl = '请输入有效的 API 地址'
  } else {
    try {
      const parsed = new URL(config.apiUrl.trim())
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('仅支持 http/https 协议')
      }
    } catch {
      errors.apiUrl = '请输入有效的 API 地址'
    }
  }

  if (!config.model.trim()) {
    errors.model = '模型名称不能为空'
  }

  return errors
}

/** 设置页主表单组件：负责配置的加载、编辑、校验、保存与恢复默认 */
const SettingsForm: React.FC = () => {
  const [config, setConfig] = useState<AppConfig>(createDefaultConfig)
  const [errors, setErrors] = useState<FormErrors>({})
  const [status, setStatus] = useState<StatusMessage>(null)
  const [loading, setLoading] = useState(true)

  // 组件挂载时读取 chrome.storage.local 已有配置并回填，缺失字段使用默认值
  useEffect(() => {
    let cancelled = false

    const loadConfig = async (): Promise<void> => {
      try {
        const stored = await chrome.storage.local.get(STORAGE_KEYS.APP_CONFIG)
        if (cancelled) return
        const existing = stored[STORAGE_KEYS.APP_CONFIG] as
          | Partial<AppConfig>
          | undefined
        setConfig({
          ...createDefaultConfig(),
          ...(existing ?? {}),
        })
      } catch (error: unknown) {
        if (cancelled) return
        setStatus({ type: 'error', text: '加载已有设置失败' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadConfig()
    return () => {
      cancelled = true
    }
  }, [])

  /** 更新单个字段 */
  const handleChange = useCallback(
    (field: keyof AppConfig) => (
      e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      const value = e.target.value
      setConfig(prev => ({ ...prev, [field]: value }))
      setStatus(null)
    },
    [],
  )

  /** 保存设置到 chrome.storage.local */
  const handleSave = useCallback(async (): Promise<void> => {
    const validationErrors = validate(config)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) {
      setStatus({ type: 'error', text: '请修正表单中的错误后再保存' })
      return
    }

    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.APP_CONFIG]: config })
      setStatus({ type: 'success', text: '✅ 设置已保存' })
    } catch {
      setStatus({ type: 'error', text: '保存设置失败' })
    }
  }, [config])

  /** 恢复所有字段为默认值 */
  const handleReset = useCallback((): void => {
    setConfig(createDefaultConfig())
    setErrors({})
    setStatus({ type: 'success', text: '已恢复默认设置' })
  }, [])

  if (loading) {
    return <p className='options-loading'>加载设置中…</p>
  }

  return (
    <form
      className='options-form'
      onSubmit={e => {
        e.preventDefault()
        void handleSave()
      }}
    >
      <section className='options-section'>
        <h2 className='section-title'>AI 模型配置</h2>

        <div className='form-row'>
          <label className='form-label' htmlFor='apiKey'>
            API Key <span className='required'>*</span>
          </label>
          <input
            id='apiKey'
            type='password'
            className='form-input'
            value={config.apiKey}
            onChange={handleChange('apiKey')}
            placeholder='请输入模型平台的 API Key'
            autoComplete='off'
          />
          {errors.apiKey && (
            <p className='form-error'>{errors.apiKey}</p>
          )}
        </div>

        <div className='form-row'>
          <label className='form-label' htmlFor='apiUrl'>
            API 地址 <span className='required'>*</span>
          </label>
          <input
            id='apiUrl'
            type='text'
            className='form-input'
            value={config.apiUrl}
            onChange={handleChange('apiUrl')}
            placeholder='https://dashscope.aliyuncs.com/compatible-mode/v1'
          />
          {errors.apiUrl && (
            <p className='form-error'>{errors.apiUrl}</p>
          )}
        </div>

        <div className='form-row'>
          <label className='form-label' htmlFor='model'>
            模型名称 <span className='required'>*</span>
          </label>
          <input
            id='model'
            type='text'
            className='form-input'
            value={config.model}
            onChange={handleChange('model')}
            placeholder='qwen-turbo'
          />
          {errors.model && (
            <p className='form-error'>{errors.model}</p>
          )}
        </div>
      </section>

      <section className='options-section'>
        <h2 className='section-title'>翻译设置</h2>

        <div className='form-row'>
          <label className='form-label' htmlFor='systemPrompt'>
            系统提示词（可选）
          </label>
          <textarea
            id='systemPrompt'
            className='form-textarea'
            value={config.systemPrompt}
            onChange={handleChange('systemPrompt')}
            rows={5}
            placeholder='请输入翻译指令…'
          />
        </div>
      </section>

      <section className='options-section'>
        <h2 className='section-title'>关于</h2>
        <p className='about-version'>版本号 v1.0.0</p>
        <p className='about-stack'>
          技术栈：Chrome MV3 · React 18 · TypeScript · Vite
        </p>
      </section>

      {status && (
        <p className={`options-status options-status--${status.type}`}>
          {status.text}
        </p>
      )}

      <div className='options-actions'>
        <button type='submit' className='btn btn-primary'>
          保存设置
        </button>
        <button
          type='button'
          className='btn btn-secondary'
          onClick={handleReset}
        >
          恢复默认
        </button>
      </div>
    </form>
  )
}

export default SettingsForm
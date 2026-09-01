import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import SettingsForm from './components/SettingsForm'
import '../shared/styles/tokens.css'
import './styles/options.css'

const root = createRoot(document.getElementById('root')!)

root.render(
  <StrictMode>
    <div className='options-page'>
      <header className='options-header'>
        <h1 className='options-title'>网页翻译助手 · 设置</h1>
        <p className='options-subtitle'>
          配置 AI 模型与翻译偏好，设置将保存在本地浏览器中
        </p>
      </header>
      <SettingsForm />
      <footer className='options-footer'>
        数据仅存储于本机 chrome.storage.local，不会上传
      </footer>
    </div>
  </StrictMode>,
)
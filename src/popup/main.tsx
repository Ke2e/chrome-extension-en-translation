import React from 'react'
import ReactDOM from 'react-dom/client'

const PopupApp: React.FC = () => {
  return <div style={{ width: '420px', minHeight: '200px' }} />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>,
)

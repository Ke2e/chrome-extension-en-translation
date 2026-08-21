import React from 'react'
import ReactDOM from 'react-dom/client'

const OptionsApp: React.FC = () => {
  return <div style={{ minHeight: '100vh' }} />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>,
)

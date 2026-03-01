import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './lib/setupAxios' // Configura axios global (withCredentials + interceptor 401)
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

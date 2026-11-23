import { createRoot } from 'react-dom/client'
import App from './App'
import { loadSharedWorkspace } from './workspaceClient'
import './style.css'

void loadSharedWorkspace().finally(() => {
  createRoot(document.getElementById('root')!).render(<App />)
})

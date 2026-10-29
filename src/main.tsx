import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PwaControls } from './components/PwaControls'
import { registerPwa } from './lib/pwa'
import { startGymSync } from './lib/gymSync'

void registerPwa();
startGymSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PwaControls />
    <App />
  </StrictMode>,
)

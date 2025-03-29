import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MixerDecksProvider } from './contexts/MixerDecksProvider';
import './index.css';
import App from './App.js';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <MixerDecksProvider>
      <App />
    </MixerDecksProvider>
  </StrictMode>,
);

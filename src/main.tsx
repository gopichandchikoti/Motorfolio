import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/dm-sans';
import '@fontsource/instrument-serif';
import './style.css';
import './app.css';
import App from './App';
const root = document.getElementById('root');
if (root)
  createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
if ('serviceWorker' in navigator && location.protocol === 'http:')
  navigator.serviceWorker.register('/sw.js').catch(() => undefined);

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register Service Worker early for PWA (disabled in dev/iframe to avoid auth proxy MIME type errors and cache interference)
const isDevOrIframe = 
  typeof window !== 'undefined' && (
    window.self !== window.top || 
    window.location.hostname.includes('localhost') || 
    window.location.hostname.includes('127.0.0.1') || 
    window.location.hostname.includes('ais-dev-') ||
    window.location.hostname.includes('ais-pre-') ||
    window.location.hostname.includes('.run.app')
  );

if ('serviceWorker' in navigator) {
  if (isDevOrIframe) {
    // Unregister any stale dev service workers to avoid caching issues during development
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().then((success) => {
          if (success) console.log('Stale dev Service Worker successfully unregistered');
        });
      }
    }).catch(err => console.debug('Error cleaning stale dev SW:', err));
  } else {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('SW registered');
        
        // Check for updates every 5 minutes
        setInterval(() => {
          reg.update();
          console.log('Checking for SW updates...');
        }, 5 * 60 * 1000);

        // Check for update on focus
        window.addEventListener('focus', () => {
          reg.update();
        });
      })
      .catch(err => console.log('SW error', err));
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register Service Worker early for PWA
if ('serviceWorker' in navigator) {
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

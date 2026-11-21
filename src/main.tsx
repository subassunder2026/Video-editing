import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Ignore third-party browser extension injection errors (e.g. extensions attempting to overwrite read-only window.fetch)
window.addEventListener(
  'error',
  (event) => {
    if (event.filename && event.filename.startsWith('chrome-extension://')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },
  true
);

// Register service worker for offline caching and desktop PWA installability
try {
  registerSW({immediate: true});
} catch {
  // Ignore SW registration errors in restricted iframe sandboxes
}

createRoot(document.getElementById('root')!).render(<App />);

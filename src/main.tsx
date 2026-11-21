import {createRoot} from 'react-dom/client';
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

createRoot(document.getElementById('root')!).render(<App />);

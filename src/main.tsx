import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css';
import './competition.css';
import 'leaflet/dist/leaflet.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);\n\nif ('serviceWorker' in navigator && import.meta.env.PROD) {\n  window.addEventListener('load', () => {\n    void navigator.serviceWorker.register('/sw.js').catch((error) => {\n      console.warn('TransitIQ offline shell could not be registered:', error);\n    });\n  });\n}

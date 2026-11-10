import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css';
import './competition.css';
import 'leaflet/dist/leaflet.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('TransitIQ offline shell could not be registered:', error);
    });
  });
}

import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<App />);

// La app queda guardada en el móvil: abre al instante y aguanta sin cobertura.
if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
  // Al tocar un aviso con la app ya abierta, se va a la pantalla que indica.
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'go' && typeof event.data.hash === 'string' && event.data.hash.startsWith('#/')) {
      window.location.hash = event.data.hash;
    }
  });
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { Splash } from './components/Splash';
import { installViewportGuard } from './lib/viewportGuard';
import { initAppearance } from './store/appearance';
import './styles/index.css';

initAppearance();
installViewportGuard();

// The PKCE verifier lives in per-origin sessionStorage and Spotify redirects to 127.0.0.1,
// so a login started on "localhost" could never complete. Normalise the host first.
if (window.location.hostname === 'localhost') {
  const url = new URL(window.location.href);
  url.hostname = '127.0.0.1';
  window.location.replace(url);
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
        <Splash />
      </BrowserRouter>
    </StrictMode>,
  );
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ambience } from './audio';
import { registerServiceWorker } from './pwa';
import { App } from './ui/App';
import { ErrorBoundary } from './ui/ErrorBoundary';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

registerServiceWorker();

// Handle for the QA script, which renders each sound mood offline to check its loudness.
(window as unknown as { __tlwAmbience: typeof ambience }).__tlwAmbience = ambience;

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { detectLanguage, isLang, UI } from '../i18n/ui';
import { KEYS, readJson, remove } from '../storage';

interface State {
  error: Error | null;
}

/**
 * Last line of defence: if rendering ever throws, show a calm screen with a way back
 * instead of a blank page. "Try again" re-renders; "Start a new run" clears the saved run.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('The Last Weather stopped:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const saved = readJson<{ lang?: unknown }>(KEYS.settings);
    const lang = isLang(saved?.lang) ? saved.lang : detectLanguage(typeof navigator !== 'undefined' ? navigator.languages : undefined);
    const ui = UI[lang];
    return (
      <div className="app crash-screen">
        <main className="crash-main" role="alert">
          <h1 className="scene-title">{ui.errorTitle}</h1>
          <p className="narration">{ui.errorBody}</p>
          <div className="title-actions">
            <button type="button" className="btn btn-primary" data-action="crash-retry" onClick={() => this.setState({ error: null })}>
              {ui.errorRetry}
            </button>
            <button
              type="button"
              className="btn"
              data-action="crash-reset"
              onClick={() => {
                remove(KEYS.run);
                if (window.location.hash === '#crash-test') history.replaceState(null, '', window.location.pathname);
                window.location.reload();
              }}
            >
              {ui.errorReset}
            </button>
          </div>
        </main>
      </div>
    );
  }
}

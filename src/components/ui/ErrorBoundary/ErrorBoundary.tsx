import { Component, type ErrorInfo, type ReactNode } from 'react';
import styles from './ErrorBoundary.module.css';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    // Clear local storage and state, and reload
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className={styles.root}>
          <div className={styles.container}>
            <div className={styles.card}>
              <div className={styles.icon}>⚠️</div>
              <h1 className={styles.title}>Application Error</h1>
              <p className={styles.subtitle}>
                DecibelCut encountered an unexpected error. This might be due to browser privacy settings, strict shields, or a corrupted audio file.
              </p>

              {this.state.error && (
                <div className={styles.errorBox}>
                  <div className={styles.errorName}>{this.state.error.name}</div>
                  <pre className={styles.errorMessage}>{this.state.error.message}</pre>
                  {this.state.error.stack && (
                    <details className={styles.details}>
                      <summary className={styles.detailsSummary}>View Error Stack</summary>
                      <pre className={styles.stackTrace}>{this.state.error.stack}</pre>
                    </details>
                  )}
                </div>
              )}

              <div className={styles.actions}>
                <button className={styles.retryBtn} onClick={this.handleReset}>
                  Reload Application
                </button>
              </div>

              <div className={styles.suggestions}>
                <h4>Troubleshooting suggestions:</h4>
                <ul>
                  <li>If using Brave or strict ad-blockers, try temporarily disabling shields (click the lion icon in the address bar).</li>
                  <li>Check if the audio file format is supported (.mp3, .wav, .flac, .m4a, .ogg).</li>
                  <li>Check your browser developer console (F12) for detailed logs.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

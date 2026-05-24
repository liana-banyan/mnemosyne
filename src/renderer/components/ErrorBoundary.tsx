// BP041 — Renderer Error Boundary
//
// Catches React render-tree crashes so a single broken component doesn't
// white-screen the entire Mnemosyne window. Empirical anchor: Knight SAGA 1
// b53a09d wired new IPC handlers in main+preload but Vite HMR only reloads
// renderer; old main process didn't have window.amplify.pantheonGetPrefs() →
// MakeYourselfComfortableWizard threw on mount → React tree crashed → white
// screen. Founder direct: "I cannot get out of the white screen."
//
// This boundary now catches such errors, displays a recovery panel, and lets
// the rest of Mnemosyne keep functioning. Member sees what went wrong AND
// has a Reload button to re-mount the renderer.

import React, { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props {
  /** Label for the boundary — surfaces in the error message ("Tab: Substrate crashed"). */
  label?: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  info: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ info });
    console.error('[ErrorBoundary]', this.props.label ?? 'unknown', error, info);
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null, info: null });
  };

  reload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const errMsg = this.state.error?.message ?? String(this.state.error);
      const stack = this.state.error?.stack ?? '';
      const componentStack = this.state.info?.componentStack ?? '';
      return (
        <div style={styles.container}>
          <div style={styles.header}>
            <span style={styles.icon}>⚠️</span>
            <span style={styles.title}>
              Component crashed{this.props.label ? `: ${this.props.label}` : ''}
            </span>
          </div>
          <div style={styles.body}>
            <p style={styles.hint}>
              The rest of Mnemosyne is still working. Try the actions below, or click another tab.
            </p>
            <details style={styles.details}>
              <summary style={styles.summary}>📋 Error details (click to expand)</summary>
              <div style={styles.errBlock}>
                <strong>Message:</strong>
                <pre style={styles.pre}>{errMsg}</pre>
                {componentStack && (
                  <>
                    <strong>Component stack:</strong>
                    <pre style={styles.pre}>{componentStack.trim()}</pre>
                  </>
                )}
                {stack && (
                  <>
                    <strong>Stack:</strong>
                    <pre style={styles.pre}>{stack}</pre>
                  </>
                )}
              </div>
            </details>
            <div style={styles.actions}>
              <button onClick={this.reset} style={styles.btnSecondary}>
                ↻ Try again (re-mount this component)
              </button>
              <button onClick={this.reload} style={styles.btnPrimary}>
                🔄 Reload window
              </button>
            </div>
            <p style={styles.diagnostic}>
              <strong>Common cause:</strong> Vite HMR hot-reloaded the renderer, but the
              main process / preload bridge wasn't restarted, so a new IPC handler
              (e.g. <code>window.amplify.someNewMethod()</code>) doesn't exist yet.
              Fix: Ctrl+C the <code>npm run dev</code> terminal and re-run.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    margin: 16,
    border: '1px solid #f59e0b',
    borderRadius: 8,
    background: '#1a0f00',
    color: '#fef3c7',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    background: '#2a1a05',
    borderBottom: '1px solid #f59e0b44',
  },
  icon: { fontSize: 18 },
  title: { fontSize: 14, fontWeight: 700, color: '#fbbf24' },
  body: { padding: '12px 14px' },
  hint: { fontSize: 12, color: '#fef3c7', marginBottom: 10 },
  details: { marginBottom: 12 },
  summary: { fontSize: 11, color: '#fbbf24', cursor: 'pointer', userSelect: 'none' },
  errBlock: { marginTop: 8, fontSize: 11, color: '#fef3c7' },
  pre: {
    background: '#0a0a12',
    padding: 8,
    borderRadius: 4,
    margin: '4px 0 10px 0',
    fontSize: 10,
    color: '#cbd5e0',
    overflow: 'auto',
    maxHeight: 200,
    whiteSpace: 'pre-wrap',
    userSelect: 'text',
  },
  actions: { display: 'flex', gap: 8, marginTop: 8 },
  btnPrimary: {
    background: '#1f6feb',
    border: 'none',
    color: '#fff',
    padding: '6px 14px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
  },
  btnSecondary: {
    background: '#21262d',
    border: '1px solid #30363d',
    color: '#c9d1d9',
    padding: '6px 14px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
  },
  diagnostic: {
    marginTop: 14,
    padding: 10,
    background: '#0a0a12',
    borderRadius: 4,
    fontSize: 10,
    color: '#a0aec0',
    lineHeight: 1.5,
  },
};

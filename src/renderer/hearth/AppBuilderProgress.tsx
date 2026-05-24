// AMPLIFY Computer — Hearth App Builder — Progress Panel
// B69b — Live build progress visualization with status steps.

import type { BuildProgress, BuildStatus } from '../../main/hearth_app_builder/types';

interface AppBuilderProgressProps {
  progress: BuildProgress | null;
  appName?: string;
}

interface Step {
  key: BuildStatus;
  label: string;
  icon: string;
}

const STEPS: Step[] = [
  { key: 'extracting_spec', label: 'Understanding your request', icon: '🧠' },
  { key: 'spec_ready', label: 'App spec ready', icon: '📋' },
  { key: 'generating_code', label: 'Generating code', icon: '⚙️' },
  { key: 'installing_deps', label: 'Installing dependencies', icon: '📦' },
  { key: 'building', label: 'Building installer', icon: '🔨' },
  { key: 'complete', label: 'Ready to install!', icon: '✅' },
];

const STATUS_ORDER: BuildStatus[] = [
  'extracting_spec',
  'spec_ready',
  'generating_code',
  'installing_deps',
  'building',
  'complete',
];

function getStepState(step: BuildStatus, current: BuildStatus): 'done' | 'active' | 'pending' | 'error' {
  if (current === 'error') {
    const currentIdx = STATUS_ORDER.indexOf(current);
    const stepIdx = STATUS_ORDER.indexOf(step);
    return stepIdx < currentIdx ? 'done' : stepIdx === currentIdx ? 'error' : 'pending';
  }
  const currentIdx = STATUS_ORDER.indexOf(current);
  const stepIdx = STATUS_ORDER.indexOf(step);
  if (stepIdx < currentIdx) return 'done';
  if (stepIdx === currentIdx) return 'active';
  return 'pending';
}

export function AppBuilderProgress({ progress, appName }: AppBuilderProgressProps) {
  if (!progress) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyIcon}>🔥</div>
        <div style={styles.emptyText}>Hearth is ready to build your app.</div>
        <div style={styles.emptySubtext}>Describe what you want in the chat →</div>
      </div>
    );
  }

  const currentStatus = progress.status;
  const isError = currentStatus === 'error';

  return (
    <div style={styles.container}>
      {appName && <div style={styles.appTitle}>Building: {appName}</div>}

      {/* Step indicators */}
      <div style={styles.steps}>
        {STEPS.map((step) => {
          const state = getStepState(step.key, currentStatus);
          return (
            <div key={step.key} style={{ ...styles.step, ...(state === 'active' ? styles.stepActive : {}) }}>
              <div
                style={{
                  ...styles.stepIcon,
                  ...(state === 'done' ? styles.stepIconDone : {}),
                  ...(state === 'active' ? styles.stepIconActive : {}),
                  ...(state === 'error' ? styles.stepIconError : {}),
                }}
              >
                {state === 'done' ? '✓' : state === 'error' ? '✗' : step.icon}
              </div>
              <div
                style={{
                  ...styles.stepLabel,
                  ...(state === 'done' ? styles.stepLabelDone : {}),
                  ...(state === 'active' ? styles.stepLabelActive : {}),
                  ...(state === 'pending' ? styles.stepLabelPending : {}),
                }}
              >
                {step.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      {!isError && currentStatus !== 'complete' && (
        <div style={styles.progressBar}>
          <div style={{ ...styles.progressFill, width: `${progress.percent ?? 0}%` }} />
        </div>
      )}

      {/* Status message */}
      <div
        style={{
          ...styles.statusMessage,
          ...(isError ? styles.statusError : {}),
          ...(currentStatus === 'complete' ? styles.statusComplete : {}),
        }}
      >
        {progress.message}
      </div>

      {/* Installer path on complete */}
      {currentStatus === 'complete' && progress.installerPath && (
        <div style={styles.installerBox}>
          <div style={styles.installerLabel}>Installer ready:</div>
          <div style={styles.installerPath}>{progress.installerPath}</div>
        </div>
      )}

      {/* Error details */}
      {isError && progress.error && (
        <div style={styles.errorBox}>
          <div style={styles.errorTitle}>Error details:</div>
          <pre style={styles.errorPre}>{progress.error.slice(0, 500)}</pre>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '1.25rem',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  appTitle: {
    fontWeight: 700,
    fontSize: '1rem',
    marginBottom: '1rem',
    color: '#2c3e50',
  },
  steps: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    marginBottom: '1rem',
  },
  step: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.4rem 0',
  },
  stepActive: {
    background: '#fff8f3',
    borderRadius: '6px',
    padding: '0.4rem 0.5rem',
    marginLeft: '-0.5rem',
    marginRight: '-0.5rem',
  },
  stepIcon: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: '#f1f3f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.9rem',
    flexShrink: 0,
  },
  stepIconDone: {
    background: '#d4edda',
    color: '#28a745',
    fontWeight: 700,
  },
  stepIconActive: {
    background: '#ffe0c2',
    color: '#e67e22',
  },
  stepIconError: {
    background: '#f8d7da',
    color: '#dc3545',
    fontWeight: 700,
  },
  stepLabel: {
    fontSize: '0.9rem',
    color: '#adb5bd',
  },
  stepLabelDone: {
    color: '#28a745',
    textDecoration: 'line-through',
  },
  stepLabelActive: {
    color: '#e67e22',
    fontWeight: 600,
  },
  stepLabelPending: {
    color: '#adb5bd',
  },
  progressBar: {
    height: '6px',
    background: '#dee2e6',
    borderRadius: '3px',
    overflow: 'hidden',
    marginBottom: '0.75rem',
  },
  progressFill: {
    height: '100%',
    background: '#e67e22',
    borderRadius: '3px',
    transition: 'width 0.4s ease',
  },
  statusMessage: {
    fontSize: '0.85rem',
    color: '#6c757d',
    fontStyle: 'italic',
    marginBottom: '0.75rem',
    wordBreak: 'break-word',
  },
  statusError: {
    color: '#dc3545',
    fontStyle: 'normal',
    fontWeight: 600,
  },
  statusComplete: {
    color: '#28a745',
    fontStyle: 'normal',
    fontWeight: 600,
  },
  installerBox: {
    background: '#d4edda',
    border: '1px solid #c3e6cb',
    borderRadius: '6px',
    padding: '0.75rem',
    marginTop: '0.5rem',
  },
  installerLabel: {
    fontWeight: 600,
    fontSize: '0.85rem',
    color: '#155724',
    marginBottom: '0.25rem',
  },
  installerPath: {
    fontSize: '0.8rem',
    color: '#155724',
    wordBreak: 'break-all',
    fontFamily: 'monospace',
  },
  errorBox: {
    background: '#f8d7da',
    border: '1px solid #f5c6cb',
    borderRadius: '6px',
    padding: '0.75rem',
    marginTop: '0.5rem',
  },
  errorTitle: {
    fontWeight: 600,
    fontSize: '0.85rem',
    color: '#721c24',
    marginBottom: '0.25rem',
  },
  errorPre: {
    fontSize: '0.75rem',
    color: '#721c24',
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: '120px',
    overflowY: 'auto',
  },
  empty: {
    textAlign: 'center',
    padding: '2rem 1rem',
    color: '#6c757d',
  },
  emptyIcon: {
    fontSize: '2.5rem',
    marginBottom: '0.75rem',
  },
  emptyText: {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#495057',
    marginBottom: '0.25rem',
  },
  emptySubtext: {
    fontSize: '0.85rem',
    color: '#adb5bd',
  },
};

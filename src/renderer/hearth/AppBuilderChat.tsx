// AMPLIFY Computer — Hearth App Builder — Chat UI
// B69b — Member types a plain-English request; Hearth builds the app.
// Warm, friendly, accessible register (BP028 — Hearth is the consumer brand).

import { useState, useRef, useEffect } from 'react';
import type { BuildProgress } from '../../main/hearth_app_builder/types';
import { NotCentsGlyph } from '../components/NotCentsGlyph';

interface ChatMessage {
  role: 'member' | 'hearth';
  content: string;
  ts: string;
}

interface AppBuilderChatProps {
  onBuildComplete?: (result: {
    appUuid: string;
    appName: string;
    appDir: string;
    installerPath?: string;
  }) => void;
  onBuildError?: (error: string) => void;
  onProgress?: (progress: BuildProgress) => void;
}

const PLACEHOLDER_EXAMPLES = [
  'build me a daily-log app where I rate my mood 1-10 and write a note',
  'create a simple budget tracker with amount, category, and date',
  'I want a recipe organizer where I can save recipes with ingredients and steps',
  'make a task list where I can check off completed items',
  'build a contact book with name, email, and phone number',
];

// §2+§5 BP041 — CAI rebrand + Helena Pedagogy copy (give the answer first + prime with example).
// "Hearth" is the internal Ollama-fallback label; member-facing brand is CAI.
const CAI_GREETING =
  "Hi! I'm CAI. Describe a tool you want — a task list, a chore tracker, " +
  "a co-op budget that converts dollars to Marks — and I'll build it on your machine. " +
  "Free, local, no cloud needed. Try: 'a task list where I can check off completed items.'";

export function AppBuilderChat({ onBuildComplete, onBuildError, onProgress }: AppBuilderChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'hearth',
      content: CAI_GREETING,
      ts: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [building, setBuilding] = useState(false);
  const [progress, setProgress] = useState<BuildProgress | null>(null);
  const [placeholder, setPlaceholder] = useState(PLACEHOLDER_EXAMPLES[0]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const idx = Math.floor(Math.random() * PLACEHOLDER_EXAMPLES.length);
    setPlaceholder(PLACEHOLDER_EXAMPLES[idx]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, progress]);

  useEffect(() => {
    const cleanup = window.amplify.onHearthBuildProgress?.((p: BuildProgress) => {
      setProgress(p);
      onProgress?.(p);

      if (p.status === 'complete' || p.status === 'error') {
        setBuilding(false);
        if (p.status === 'complete') {
          addMessage('hearth',
            p.installerPath
              ? `Done! Your app "${p.appUuid}" is built and ready to install.\n\nInstaller: ${p.installerPath}`
              : `Done! Your app is built. Click Install below to run it.`
          );
        } else if (p.error) {
          addMessage('hearth', `Something went wrong: ${p.error.slice(0, 300)}\n\nTry describing your app a bit differently, or contact support.`);
          onBuildError?.(p.error);
        }
      }
    });
    return cleanup;
  }, [onBuildError, onProgress]);

  function addMessage(role: 'member' | 'hearth', content: string) {
    setMessages((prev) => [...prev, { role, content, ts: new Date().toISOString() }]);
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || building) return;

    setInput('');
    addMessage('member', trimmed);
    addMessage('hearth', "Got it! I'm building your app now. This takes a few minutes…");
    setBuilding(true);
    setProgress(null);

    try {
      const result = await window.amplify.hearthBuild?.(trimmed);
      if (result?.ok && result.appUuid) {
        onBuildComplete?.({
          appUuid: result.appUuid,
          appName: result.spec?.appName ?? 'Your App',
          appDir: result.appDir ?? '',
          installerPath: result.installerPath,
        });
      } else if (result?.error) {
        setBuilding(false);
        addMessage('hearth', `Hmm, I ran into a problem: ${result.error.slice(0, 300)}\n\nPlease try rephrasing your request.`);
        onBuildError?.(result.error);
      }
    } catch (err) {
      setBuilding(false);
      addMessage('hearth', 'Something unexpected happened. Please try again.');
      onBuildError?.(String(err));
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div style={styles.container}>
      {/* Messages */}
      <div style={styles.messages}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              ...styles.bubble,
              ...(msg.role === 'member' ? styles.memberBubble : styles.hearthBubble),
            }}
          >
            <div style={styles.bubbleRole}>{msg.role === 'member' ? 'You' : (<><NotCentsGlyph size="0.95em" /> CAI</>)}</div>
            <div style={styles.bubbleContent}>{msg.content}</div>
          </div>
        ))}

        {/* Live build progress */}
        {building && progress && (
          <div style={{ ...styles.bubble, ...styles.hearthBubble }}>
            <div style={styles.bubbleRole}><NotCentsGlyph size="0.95em" /> CAI</div>
            <div style={styles.progressBar}>
              <div
                style={{ ...styles.progressFill, width: `${progress.percent ?? 0}%` }}
              />
            </div>
            <div style={styles.progressLabel}>{progress.message}</div>
          </div>
        )}

        {building && !progress && (
          <div style={{ ...styles.bubble, ...styles.hearthBubble }}>
            <div style={styles.bubbleRole}><NotCentsGlyph size="0.95em" /> CAI</div>
            <div style={styles.spinner}>Building…</div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={styles.inputArea}>
        <textarea
          ref={textareaRef}
          style={styles.textarea}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={building}
          rows={3}
        />
        <button
          style={{ ...styles.sendBtn, ...(building ? styles.sendBtnDisabled : {}) }}
          onClick={handleSend}
          disabled={building}
        >
          {building ? 'Building…' : 'Build App'}
        </button>
      </div>
      <div style={styles.hint}>Ctrl+Enter to send</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: '12px',
    padding: '0.75rem 1rem',
    lineHeight: 1.5,
  },
  memberBubble: {
    alignSelf: 'flex-end',
    background: '#2c3e50',
    color: 'white',
  },
  hearthBubble: {
    alignSelf: 'flex-start',
    background: '#f1f3f5',
    color: '#212529',
    border: '1px solid #dee2e6',
  },
  bubbleRole: {
    fontSize: '0.75rem',
    fontWeight: 700,
    marginBottom: '0.25rem',
    opacity: 0.7,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  bubbleContent: {
    fontSize: '0.95rem',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  progressBar: {
    height: '6px',
    background: '#dee2e6',
    borderRadius: '3px',
    overflow: 'hidden',
    margin: '0.5rem 0',
  },
  progressFill: {
    height: '100%',
    background: '#e67e22',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  progressLabel: {
    fontSize: '0.8rem',
    color: '#6c757d',
    marginTop: '0.25rem',
  },
  spinner: {
    fontSize: '0.9rem',
    color: '#6c757d',
    fontStyle: 'italic',
  },
  inputArea: {
    display: 'flex',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    borderTop: '1px solid #dee2e6',
    background: 'white',
  },
  textarea: {
    flex: 1,
    resize: 'none',
    border: '1px solid #ced4da',
    borderRadius: '8px',
    padding: '0.5rem 0.75rem',
    fontSize: '0.95rem',
    fontFamily: 'inherit',
    lineHeight: 1.5,
    outline: 'none',
  },
  sendBtn: {
    background: '#e67e22',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '0.5rem 1.25rem',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.9rem',
    transition: 'background 0.15s',
    alignSelf: 'flex-end',
  },
  sendBtnDisabled: {
    background: '#adb5bd',
    cursor: 'not-allowed',
  },
  hint: {
    textAlign: 'right',
    fontSize: '0.75rem',
    color: '#adb5bd',
    paddingRight: '1rem',
    paddingBottom: '0.5rem',
  },
};

import {
  ArrowUp,
  Bot,
  Code2,
  Command,
  FolderOpen,
  Gauge,
  Heart,
  History,
  Keyboard,
  MessageSquare,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Workflow,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';

type Mode = 'plan' | 'build';
type Message = { id: string; role: 'user' | 'agent'; content: string; time: string };
type Session = { id: string; title: string; messages: Message[]; contextStart: number };
type WorkspaceState = {
  activeId: string;
  sessions: Session[];
  mode: Mode;
  model: string;
  folder: string;
  ctxLimit: number;
  textLimit: number;
  textLimitOn: boolean;
};

const storageKey = 'zanshin.workspace.v1';
const desktop = window.zanshinDesktop;
const modifierKey = desktop?.platform === 'darwin' ? '⌘' : 'Ctrl';

function newSession(): Session {
  return { id: crypto.randomUUID(), title: 'New session', messages: [], contextStart: 0 };
}

function loadWorkspace(): WorkspaceState {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const saved = JSON.parse(raw) as WorkspaceState;
      if (saved.sessions.some((session) => session.id === saved.activeId)) return saved;
    }
  } catch {
    // An unavailable or invalid store should not prevent startup.
  }
  const session = newSession();
  return { activeId: session.id, sessions: [session], mode: 'build', model: 'qwen2.5-coder:7b', folder: '', ctxLimit: 8192, textLimit: 120, textLimitOn: false };
}

function requestHistory(messages: Message[], budget: number): OllamaMessage[] {
  const history: OllamaMessage[] = [];
  for (const message of messages.slice(-199).reverse()) {
    budget -= message.content.length;
    if (budget < 0) break;
    history.unshift({ role: message.role === 'agent' ? 'assistant' : 'user', content: message.content });
  }
  if (history[0]?.role === 'assistant') history.shift();
  return history;
}

const paletteItems = [
  { label: 'Switch to Plan Mode', shortcut: 'Alt+M', action: 'plan' },
  { label: 'Switch to Build Mode', shortcut: 'Alt+M', action: 'build' },
  { label: 'Open model picker', shortcut: '/model', action: 'model' },
  { label: 'Show context status', shortcut: '/ctxstatus', action: 'ctxstatus' },
  { label: 'Toggle text limiter', shortcut: `${modifierKey}+Alt+L`, action: 'limiter' },
];

function timeNow(): string {
  return new Date().toLocaleTimeString([], { hour12: false });
}

function App() {
  const [workspace, setWorkspace] = useState(loadWorkspace);
  const { activeId, sessions, mode, model, folder, ctxLimit, textLimit, textLimitOn } = workspace;
  const active = sessions.find((session) => session.id === activeId)!;
  const { messages, contextStart } = active;
  const [input, setInput] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(() => window.innerWidth > 1060);
  const [sessionQuery, setSessionQuery] = useState('');
  const [toast, setToast] = useState('');
  const transcriptRef = useRef<HTMLDivElement>(null);
  const charBudget = Math.min(ctxLimit * 4, 98000);
  const ctxUsed = Math.ceil(requestHistory(messages.slice(contextStart), charBudget)
    .reduce((sum, message) => sum + message.content.length, 0) / 4);
  const ctxPercent = Math.round((ctxUsed / ctxLimit) * 100);

  const update = (patch: Partial<WorkspaceState>) => setWorkspace((current) => ({ ...current, ...patch }));
  const updateSession = (id: string, transform: (session: Session) => Session) => {
    setWorkspace((current) => ({ ...current, sessions: current.sessions.map((session) => session.id === id ? transform(session) : session) }));
  };

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(workspace));
    } catch {
      setToast('Could not save workspace data locally.');
    }
  }, [workspace]);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript) transcript.scrollTop = transcript.scrollHeight;
  }, [messages, pendingId]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (modifier && key === 'k') {
        event.preventDefault();
        setPaletteQuery('');
        setPaletteOpen((open) => !open);
      }
      if (modifier && event.altKey && key === 'l') {
        event.preventDefault();
        setWorkspace((current) => ({ ...current, textLimitOn: !current.textLimitOn }));
      }
      if (!modifier && event.altKey && key === 'm') {
        event.preventDefault();
        setWorkspace((current) => ({ ...current, mode: current.mode === 'build' ? 'plan' : 'build' }));
      }
      if (event.key === 'Escape') {
        setPaletteOpen(false);
        setSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const chooseWorkspace = async () => {
    if (!desktop) { setToast('Open the desktop app to select a folder.'); return; }
    try {
      const selected = await desktop.chooseWorkspace();
      if (selected) update({ folder: selected });
    } catch {
      setToast('Could not open the folder picker.');
    }
  };

  const showContext = () => setToast(`Approx. ${ctxUsed.toLocaleString()} / ${ctxLimit.toLocaleString()} context tokens`);

  const runCommand = (value: string) => {
    const [command, argument] = value.toLowerCase().split(/\s+/);
    switch (command) {
      case '/mode':
        if (argument === 'plan' || argument === 'build') update({ mode: argument });
        else setToast('Use /mode plan or /mode build');
        break;
      case '/ctxlimit': {
        const limit = /^\d+(?:\.\d+)?k$/.test(argument) ? Number(argument.slice(0, -1)) * 1000 : Number(argument);
        if (Number.isInteger(limit) && limit >= 1024 && limit <= 24500) update({ ctxLimit: limit });
        else setToast('Use a context limit between 1,024 and 24,500');
        break;
      }
      case '/ctxstatus': showContext(); break;
      case '/wordlimit':
      case '/textlimit': {
        const count = Number(argument);
        if (argument === 'off' || argument === 'on') update({ textLimitOn: argument === 'on' });
        else if (argument === 'toggle' || !argument) update({ textLimitOn: !textLimitOn });
        else if (Number.isInteger(count) && count >= 1 && count <= 500) update({ textLimit: count, textLimitOn: true });
        else setToast('Use a word limit between 1 and 500');
        break;
      }
      case '/clearcontext':
        if (pendingId === activeId) { setToast('Wait for the current response.'); break; }
        updateSession(activeId, (session) => ({ ...session, contextStart: session.messages.length }));
        setToast('Context cleared; transcript kept.');
        break;
      case '/model': setSettingsOpen(true); break;
      default: setToast(`Unknown command: ${command}`);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = input.trim();
    if (!value) return;
    if (value.startsWith('/')) { setInput(''); runCommand(value); return; }
    if (!desktop) { setToast('Launch the desktop app to chat with Ollama.'); return; }
    if (pendingId) return;
    if (value.length > charBudget) { setToast('This message exceeds the context budget.'); return; }

    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content: value, time: timeNow() };
    const history = requestHistory([...messages.slice(contextStart), userMessage], charBudget);
    const system = mode === 'plan'
      ? 'You are a coding assistant. Respond with a plan. You cannot inspect or change local files or run commands.'
      : 'You are a coding assistant. Provide implementation guidance and code. You cannot inspect or change local files or run commands.';
    setInput('');
    setPendingId(activeId);
    updateSession(activeId, (session) => ({ ...session, title: session.messages.length === 0 ? value.slice(0, 48) : session.title, messages: [...session.messages, userMessage] }));
    try {
      const result = await desktop.chat(model.trim(), [{ role: 'system', content: system + (textLimitOn ? ` Respond in at most ${textLimit} words.` : '') }, ...history]);
      if ('error' in result) { setToast(result.error); return; }
      const words = result.content.match(/\S+/g) ?? [];
      const content = textLimitOn && words.length > textLimit ? words.slice(0, textLimit).join(' ') : result.content;
      const response: Message = { id: crypto.randomUUID(), role: 'agent', content, time: timeNow() };
      updateSession(activeId, (session) => ({ ...session, messages: [...session.messages, response] }));
    } catch {
      setToast('Could not send the request to the desktop runtime.');
    } finally {
      setPendingId(null);
    }
  };

  const handlePaletteAction = (action: string) => {
    setPaletteOpen(false);
    if (action === 'plan' || action === 'build') update({ mode: action });
    else if (action === 'model') setSettingsOpen(true);
    else if (action === 'ctxstatus') showContext();
    else if (action === 'limiter') update({ textLimitOn: !textLimitOn });
  };

  const handleNewSession = () => {
    const next = newSession();
    update({ activeId: next.id, sessions: [next, ...sessions] });
    setInput('');
  };

  const visibleCommands = paletteItems.filter((item) => item.label.toLowerCase().includes(paletteQuery.toLowerCase()));

  return (
    <main className={`app-shell ${mode === 'plan' ? 'plan-accent' : ''}`}>
      <div className="background-wash" />
      <div className="petal-field" aria-hidden="true">
        {Array.from({ length: 16 }, (_, index) => <span key={index} className={`petal petal-${index + 1}`} />)}
      </div>

      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><CatMark /></div>
          <div>
            <div className="brand-name">Zanshin <span>Harness</span></div>
            <div className="brand-subtitle">open agent workspace <span className="brand-heart"><Heart size={10} fill="currentColor" /></span></div>
          </div>
        </div>
        <div className="topbar-center">
          <button className="workspace-pill" type="button" onClick={chooseWorkspace} title={folder || undefined}><FolderOpen size={13} /> <span>{folder.split(/[\\/]/).filter(Boolean).pop() || 'Open folder'}</span></button>
          <div className={`mode-switch ${mode}`}>
            <button className={mode === 'plan' ? 'active' : ''} onClick={() => update({ mode: 'plan' })} type="button"><ShieldCheck size={13} /> Plan</button>
            <button className={mode === 'build' ? 'active' : ''} onClick={() => update({ mode: 'build' })} type="button"><Code2 size={13} /> Build</button>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="icon-button" onClick={() => setSessionOpen((open) => !open)} aria-expanded={sessionOpen} aria-label="Toggle sessions" type="button"><History size={16} /></button>
          <button className="icon-button" onClick={() => { setPaletteQuery(''); setPaletteOpen(true); }} aria-label="Open command palette" type="button"><Command size={16} /></button>
          <button className="icon-button" onClick={() => setSettingsOpen((open) => !open)} aria-label="Open settings" type="button"><Settings2 size={16} /></button>
          <div className="avatar">ZA</div>
        </div>
      </header>

      <div className={`workspace-grid${sessionOpen ? ' with-sessions' : ''}`}>
        {sessionOpen && <aside className="session-sidebar glass-panel">
          <div className="sidebar-heading"><span>Sessions</span><button className="tiny-button" onClick={handleNewSession} aria-label="New session" type="button"><Plus size={14} /></button></div>
          <div className="session-search"><Search size={13} /><input aria-label="Search sessions" placeholder="Search sessions" value={sessionQuery} onChange={(event) => setSessionQuery(event.target.value)} /></div>
          <div className="session-list">
            {sessions.filter((session) => session.title.toLowerCase().includes(sessionQuery.toLowerCase())).map((session) => <button key={session.id} className={`session-item ${session.id === activeId ? 'active' : ''}`} onClick={() => { update({ activeId: session.id }); setInput(''); if (window.innerWidth <= 1060) setSessionOpen(false); }} type="button">
              <MessageSquare size={14} />
              <span className="session-copy"><strong>{session.title}</strong><small>{session.messages.length} messages</small></span>
              {session.id === activeId && <span className="session-live" />}
            </button>)}
          </div>
          <div className="sidebar-foot"><div className="open-source-note"><Sparkles size={13} /><span>Built for local-first agents</span></div><span className="version-label">v0.1.0</span></div>
        </aside>}

        <section className="left-rail">
          <section className="glass-panel status-panel">
            <div className="panel-kicker"><span>01 / RUNTIME</span><Heart size={13} fill="currentColor" /></div>
            <div className="agent-state"><div className="state-icon"><Bot size={21} /></div><div><div className="state-title">{pendingId ? 'WAITING' : desktop ? 'DESKTOP' : 'PREVIEW'}</div><div className="state-meta">{desktop ? 'Ollama · 127.0.0.1:11434' : 'Launch Electron to chat'}</div></div></div>
            <div className="model-row"><div className="provider-icon">O</div><div><strong>{model || 'No model set'}</strong><span>Ollama model</span></div><button className="icon-button" type="button" aria-label="Configure model" onClick={() => setSettingsOpen(true)}><Settings2 size={14} /></button></div>
          </section>
          <section className="glass-panel workspace-card"><div className="panel-kicker"><span>WORKSPACE</span><FolderOpen size={13} /></div><div className="workspace-path" title={folder || undefined}><span>{folder || 'No folder selected'}</span></div><button className="secondary-button full-width" onClick={chooseWorkspace} type="button"><FolderOpen size={14} /> Choose folder</button><p className="workspace-note">Saved as a reference. Chat does not read or edit files.</p></section>
        </section>

        <section className="main-column">
          <div className="transcript-header"><div><div className="eyebrow"><span className="live-pulse" /> TRANSCRIPT</div><h1>{active.title}</h1><p>{mode === 'plan' ? 'Ask for a plan.' : 'Ask for implementation guidance.'}</p></div><div className="transcript-actions"><button className="small-action" onClick={() => runCommand('/clearcontext')} type="button"><Square size={12} /> Clear context</button></div></div>
          <div className="transcript-scroll" ref={transcriptRef}>
            {messages.length === 0 && <div className="empty-transcript"><div className="empty-cat"><CatMark /></div><strong>Nothing in the transcript yet</strong><span>{desktop ? 'Start a conversation with Ollama.' : 'Chat is available in the desktop app.'}</span></div>}
            {messages.map((message) => <article className={`message ${message.role}`} key={message.id}><div className="message-avatar">{message.role === 'user' ? 'ZA' : <CatMark />}</div><div className="message-body"><div className="message-meta"><strong>{message.role === 'user' ? 'You' : 'Zanshin'}</strong><span>{message.time}</span>{message.role === 'agent' && <span className="message-badge">assistant</span>}</div><div className="message-content">{message.content}</div></div></article>)}
            {pendingId === activeId && <div className="typing-row" role="status"><div className="message-avatar"><CatMark /></div><div className="typing-card"><span /><span /><span /> <em>Waiting for Ollama</em></div></div>}
          </div>
          <div className="composer-wrap"><form className="composer" onSubmit={handleSubmit}><div className="composer-top"><span className="composer-mode"><span className="status-dot status-dot-pink" /> {mode === 'plan' ? 'Plan Mode' : 'Build Mode'}</span><span className="composer-hint">Alt+M switches mode · / commands</span></div><div className="composer-input-row"><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Message Ollama or type a /command…" aria-label="Message Zanshin" /><button className="send-button" type="submit" disabled={!input.trim() || (!!pendingId && !input.trim().startsWith('/'))} aria-label="Send message"><ArrowUp size={18} /></button></div><div className="composer-foot"><div className="composer-tools"><span>Enter to send</span></div><div className="composer-limit"><button type="button" onClick={() => update({ textLimitOn: !textLimitOn })} aria-pressed={textLimitOn}>{textLimitOn ? `≤${textLimit} words` : 'No text cap'}</button><span>·</span><span>{model}</span></div></div></form></div>
        </section>

        <aside className="right-rail">
          <section className="glass-panel context-panel"><div className="panel-kicker"><span>02 / CONTEXT BUDGET</span><Gauge size={13} /></div><div className="context-reading"><div><strong>{ctxUsed.toLocaleString()}</strong><span>estimated history tokens</span></div><div className="context-percent">{ctxPercent}%</div></div><div className="context-bar"><span style={{ width: `${ctxPercent}%` }} /></div><div className="context-labels"><span>0</span><span>{ctxLimit.toLocaleString()} limit</span></div><div className="context-detail"><div><span>Strategy</span><strong>Keep recent messages</strong></div><div><span>Clear context</span><strong>Keep transcript</strong></div></div></section>
          <section className="glass-panel guardrail-panel"><div className="guardrail-icon"><ShieldCheck size={16} /></div><div><strong>Chat only</strong><span>No command execution</span></div></section>
        </aside>
      </div>

      <footer className="statusbar"><div className="statusbar-group"><span className="statusbar-live">{desktop ? 'Desktop' : 'Browser preview'}</span><span className="statusbar-divider" /><span>{model || 'No model set'}</span></div><div className="statusbar-group"><span>{sessions.length} local {sessions.length === 1 ? 'session' : 'sessions'}</span></div></footer>

      {settingsOpen && <div className="settings-popover glass-panel"><div className="popover-heading"><div><span className="eyebrow">PREFERENCES</span><h3>Run controls</h3></div><button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings" type="button"><X size={15} /></button></div><div className="setting-section"><label className="setting-label" htmlFor="model">Model <span className="setting-value">Ollama</span></label><input className="model-input" id="model" value={model} maxLength={200} onChange={(event) => update({ model: event.target.value })} placeholder="qwen2.5-coder:7b" /><div className="model-price">Use a model listed by ollama list.</div></div><div className="setting-section"><label className="setting-label" htmlFor="context">Context budget <span className="setting-value">{ctxLimit.toLocaleString()}</span></label><input id="context" type="range" min="1024" max="24500" value={ctxLimit} onChange={(event) => update({ ctxLimit: Number(event.target.value) })} /><div className="range-labels"><span>1k</span><span>24.5k</span></div></div><div className="setting-section"><div className="setting-label"><label htmlFor="words">Word limit</label><button className={`toggle ${textLimitOn ? 'on' : ''}`} onClick={() => update({ textLimitOn: !textLimitOn })} aria-label="Toggle text limiter" aria-pressed={textLimitOn} type="button"><span /></button></div><input id="words" type="range" min="1" max="500" value={textLimit} onChange={(event) => update({ textLimit: Number(event.target.value) })} /><div className="range-labels"><span>1 word</span><span>{textLimit} words</span></div></div><div className="popover-shortcuts"><Keyboard size={14} /><span><strong>{modifierKey}+K</strong> palette</span><span><strong>Alt+M</strong> mode</span></div></div>}

      {paletteOpen && <div className="palette-backdrop" onClick={() => setPaletteOpen(false)}><div className="command-palette glass-panel" onClick={(event) => event.stopPropagation()}><div className="palette-search"><Search size={16} /><input autoFocus aria-label="Search commands" placeholder="Search commands…" value={paletteQuery} onChange={(event) => setPaletteQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && visibleCommands[0]) handlePaletteAction(visibleCommands[0].action); }} /><kbd>esc</kbd></div><div className="palette-section-label">QUICK ACTIONS</div>{visibleCommands.map((item) => <button className="palette-item" key={item.label} onClick={() => handlePaletteAction(item.action)} type="button"><span className="palette-icon"><Workflow size={15} /></span><span>{item.label}</span><kbd>{item.shortcut}</kbd></button>)}</div></div>}

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

function CatMark() {
  return <span className="cat-mark" aria-hidden="true"><span className="cat-ear left" /><span className="cat-ear right" /><span className="cat-face"><span className="cat-eye left" /><span className="cat-eye right" /><span className="cat-mouth" /></span></span>;
}

export default App;

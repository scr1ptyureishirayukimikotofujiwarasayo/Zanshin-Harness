import {
  Activity,
  ArrowUp,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code2,
  Command,
  FileCode2,
  FolderOpen,
  Gauge,
  Heart,
  History,
  Keyboard,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Terminal,
  Workflow,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

type Mode = 'plan' | 'build';
type TaskStatus = 'done' | 'active' | 'queued';
type AgentStatus = 'online' | 'busy';

type Task = {
  label: string;
  status: TaskStatus;
};

type ToolCall = {
  name: string;
  detail: string;
  output: string;
  status: 'done' | 'running';
};

type Message = {
  id: number;
  role: 'user' | 'agent';
  content: string;
  time: string;
  reasoning?: string;
  tool?: ToolCall;
};

type Session = {
  id: string;
  title: string;
  time: string;
  active?: boolean;
};

const models = [
  { name: 'Claude 3.5 Sonnet', provider: 'Anthropic', context: '200k', price: '$3 / $15', icon: 'A' },
  { name: 'GPT-4.1', provider: 'OpenAI', context: '128k', price: '$2 / $8', icon: 'O' },
  { name: 'Gemini 2.5 Pro', provider: 'Google', context: '1M', price: '$1.25 / $10', icon: 'G' },
  { name: 'Qwen 2.5 Coder 32B', provider: 'OpenRouter', context: '32k', price: '$0.18 / $0.18', icon: 'Q' },
];

const defaultTasks: Task[] = [
  { label: 'Inspect workspace', status: 'done' },
  { label: 'Draft implementation plan', status: 'done' },
  { label: 'Build interface', status: 'active' },
  { label: 'Run verification', status: 'queued' },
  { label: 'Prepare handoff', status: 'queued' },
];

const initialMessages: Message[] = [
  {
    id: 1,
    role: 'user',
    content: 'Build the first pass of the Zanshin Harness workspace.',
    time: '10:42:16',
  },
  {
    id: 2,
    role: 'agent',
    content:
      'I’ve mapped the workspace into three focused surfaces: a live agent queue, a transcript for the current run, and a system flow that keeps the build phase visible. The next pass can connect these controls to a local Node runtime.',
    time: '10:42:32',
    reasoning: 'Keep the operator’s attention in the center. Secondary controls should stay close, but never compete with the active transcript.',
    tool: {
      name: 'glob',
      detail: 'Scanned project structure',
      output: '12 files found · 0 pending changes',
      status: 'done',
    },
  },
  {
    id: 3,
    role: 'agent',
    content: 'The shell is ready. Send a task to start a new run, or switch to Plan Mode when you want a read-only investigation first.',
    time: '10:42:48',
  },
];

const flowSteps = ['Plan', 'Implement', 'Test', 'Deploy', 'Monitor'];
const paletteItems = [
  { label: 'Switch to Plan Mode', shortcut: 'Tab', action: 'plan' },
  { label: 'Switch to Build Mode', shortcut: 'Tab', action: 'build' },
  { label: 'Open model picker', shortcut: '/model', action: 'model' },
  { label: 'Show context status', shortcut: '/ctxstatus', action: 'ctxstatus' },
  { label: 'Toggle text limiter', shortcut: '⌘⌥L', action: 'limiter' },
];

function timeNow(): string {
  return new Date().toLocaleTimeString([], { hour12: false });
}

function StatusDot({ status }: { status: TaskStatus | AgentStatus }) {
  if (status === 'done' || status === 'online') {
    return <span className="status-dot status-dot-green" aria-label="Complete" />;
  }
  if (status === 'active' || status === 'busy') {
    return <span className="status-dot status-dot-pink" aria-label="In progress" />;
  }
  return <span className="status-dot status-dot-muted" aria-label="Queued" />;
}

function App() {
  const [mode, setMode] = useState<Mode>('build');
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('online');
  const [tasks, setTasks] = useState<Task[]>(defaultTasks);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [ctxLimit, setCtxLimit] = useState(33000);
  const [ctxUsed, setCtxUsed] = useState(18420);
  const [textLimit, setTextLimit] = useState(120);
  const [textLimitOn, setTextLimitOn] = useState(true);
  const [selectedModel, setSelectedModel] = useState(models[0]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(true);
  const [toolOpen, setToolOpen] = useState(true);
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [sessions, setSessions] = useState<Session[]>([
    { id: 's1', title: 'Zanshin Harness shell', time: 'Now', active: true },
    { id: 's2', title: 'Provider adapter notes', time: 'Yesterday' },
    { id: 's3', title: 'Context offloader sketch', time: 'Nov 18' },
  ]);
  const inputRef = useRef<HTMLInputElement>(null);

  const ctxPercent = Math.round((ctxUsed / ctxLimit) * 100);
  const filteredModels = useMemo(() => models, []);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
      if (modifier && event.altKey && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        setTextLimitOn((enabled) => !enabled);
        setToast(textLimitOn ? 'Text limiter paused' : `Text limiter on · ${textLimit} words`);
      }
      if (event.key === 'Tab' && document.activeElement?.tagName !== 'INPUT') {
        event.preventDefault();
        setMode((current) => (current === 'build' ? 'plan' : 'build'));
      }
      if (event.key === 'Escape') {
        setPaletteOpen(false);
        setSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [textLimit, textLimitOn]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const runCommand = (value: string) => {
    const [command, argument] = value.trim().split(/\s+/);
    const normalized = command?.toLowerCase();
    if (normalized === '/mode') {
      const nextMode: Mode = argument === 'plan' ? 'plan' : 'build';
      setMode(nextMode);
      setToast(`${nextMode === 'plan' ? 'Plan' : 'Build'} Mode active`);
      return true;
    }
    if (normalized === '/ctxlimit') {
      if (!argument) {
        setToast(`Context limit · ${ctxLimit.toLocaleString()} tokens`);
        return true;
      }
      const numeric = argument.toLowerCase().endsWith('k') ? Number.parseFloat(argument) * 1000 : Number(argument);
      if (Number.isFinite(numeric) && numeric >= 10000 && numeric <= 100000) {
        setCtxLimit(Math.round(numeric));
        setToast(`Context limit set to ${Math.round(numeric).toLocaleString()} tokens`);
      } else {
        setToast('Use a context limit between 10k and 100k');
      }
      return true;
    }
    if (normalized === '/ctxstatus') {
      setToast(`${ctxUsed.toLocaleString()} / ${ctxLimit.toLocaleString()} tokens · 18 blocks offloaded`);
      return true;
    }
    if (normalized === '/textlimit') {
      if (argument === 'off') setTextLimitOn(false);
      else if (argument === 'on') setTextLimitOn(true);
      else if (argument === 'toggle' || !argument) setTextLimitOn((enabled) => !enabled);
      else if (Number.isFinite(Number(argument))) setTextLimit(Number(argument));
      setToast(`Text limiter ${argument === 'off' ? 'paused' : 'updated'}`);
      return true;
    }
    if (normalized === '/clearcontext') {
      setCtxUsed(6200);
      setToast('Context window cleared · offload archive preserved');
      return true;
    }
    if (normalized === '/model') {
      setPaletteOpen(true);
      return true;
    }
    return false;
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = input.trim();
    if (!value) return;
    setInput('');
    if (value.startsWith('/')) {
      runCommand(value);
      return;
    }

    const userMessage: Message = { id: Date.now(), role: 'user', content: value, time: timeNow() };
    setMessages((current) => [...current, userMessage]);
    setAgentStatus('busy');
    setTasks((current) => current.map((task) => (task.status === 'active' ? { ...task, status: 'done' } : task.label === 'Run verification' ? { ...task, status: 'active' } : task)));
    window.setTimeout(() => {
      const response: Message = {
        id: Date.now() + 1,
        role: 'agent',
        content: mode === 'plan'
          ? 'I’ll keep this read-only and return a structured plan with affected surfaces, risks, and the smallest safe implementation path.'
          : 'I’m on it. I’ll keep the active work visible here, then report the exact files and checks when this run is complete.',
        time: timeNow(),
        tool: { name: mode === 'plan' ? 'read' : 'todo', detail: mode === 'plan' ? 'Reading workspace context' : 'Updating task queue', output: mode === 'plan' ? 'Read-only access · 4 files queued' : '1 task activated · 2 tasks complete', status: 'running' },
      };
      setMessages((current) => [...current, response]);
      setAgentStatus('online');
      setCtxUsed((current) => Math.min(ctxLimit, current + 420));
    }, 550);
  };

  const handlePaletteAction = (action: string) => {
    setPaletteOpen(false);
    if (action === 'plan' || action === 'build') {
      setMode(action);
      setToast(`${action === 'plan' ? 'Plan' : 'Build'} Mode active`);
    } else if (action === 'model') {
      setSettingsOpen(true);
    } else if (action === 'ctxstatus') {
      setToast(`${ctxUsed.toLocaleString()} / ${ctxLimit.toLocaleString()} tokens in use`);
    } else if (action === 'limiter') {
      setTextLimitOn((enabled) => !enabled);
    }
  };

  const handleSessionSelect = (id: string) => {
    setSessions((current) => current.map((session) => ({ ...session, active: session.id === id })));
    setToast('Session resumed');
  };

  const handleNewSession = () => {
    const next: Session = { id: `s${Date.now()}`, title: 'New agent session', time: 'Now', active: true };
    setSessions((current) => [next, ...current.map((session) => ({ ...session, active: false }))]);
    setMessages([]);
    setToast('Fresh session ready');
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowUp' && !input) setInput('/ctxstatus');
  };

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
          <div className="workspace-pill"><FolderOpen size={13} /> <span>zanshin-harness</span> <ChevronDown size={13} /></div>
          <div className={`mode-switch ${mode}`}>
            <button className={mode === 'plan' ? 'active' : ''} onClick={() => setMode('plan')} type="button"><ShieldCheck size={13} /> Plan</button>
            <button className={mode === 'build' ? 'active' : ''} onClick={() => setMode('build')} type="button"><Code2 size={13} /> Build</button>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="icon-button desktop-only" onClick={() => setSessionOpen((open) => !open)} aria-label="Toggle sessions" type="button"><History size={16} /></button>
          <button className="icon-button" onClick={() => setPaletteOpen(true)} aria-label="Open command palette" type="button"><Command size={16} /></button>
          <button className="icon-button" onClick={() => setSettingsOpen((open) => !open)} aria-label="Open settings" type="button"><Settings2 size={16} /></button>
          <div className="avatar">ZA</div>
        </div>
      </header>

      <div className="workspace-grid">
        {sessionOpen && <aside className="session-sidebar glass-panel">
          <div className="sidebar-heading"><span>Sessions</span><button className="tiny-button" onClick={handleNewSession} aria-label="New session" type="button"><Plus size={14} /></button></div>
          <div className="session-search"><Search size={13} /><span>Search sessions</span><span className="keyboard-hint">⌘K</span></div>
          <div className="session-list">
            {sessions.map((session) => <button key={session.id} className={`session-item ${session.active ? 'active' : ''}`} onClick={() => handleSessionSelect(session.id)} type="button">
              <MessageSquare size={14} />
              <span className="session-copy"><strong>{session.title}</strong><small>{session.time}</small></span>
              {session.active && <span className="session-live" />}
            </button>)}
          </div>
          <div className="sidebar-foot"><div className="open-source-note"><Sparkles size={13} /><span>Built for local-first agents</span></div><span className="version-label">v0.1.0</span></div>
        </aside>}

        <section className="left-rail">
          <section className="glass-panel status-panel">
            <div className="panel-kicker"><span>01 / AGENT STATUS</span><Heart size={13} fill="currentColor" /></div>
            <div className="agent-state"><div className="state-icon"><Bot size={21} /></div><div><div className="state-title"><span className="status-dot status-dot-green" /> {agentStatus === 'online' ? 'ONLINE' : 'BUSY'}</div><div className="state-meta">Ready to orchestrate</div></div><MoreHorizontal size={17} className="muted-icon" /></div>
            <div className="model-row"><div className="provider-icon">A</div><div><strong>{selectedModel.name}</strong><span>{selectedModel.provider} · {selectedModel.context} context</span></div><ChevronRight size={14} /></div>
            <div className="queue-header"><span>Task Queue</span><span className="queue-count">{tasks.filter((task) => task.status === 'done').length}/{tasks.length}</span></div>
            <div className="task-list">{tasks.map((task) => <div className={`task-row ${task.status}`} key={task.label}><StatusDot status={task.status} /><span>{task.label}</span>{task.status === 'done' && <Check size={13} className="task-check" />}</div>)}</div>
            <div className="queue-progress"><span style={{ width: `${(tasks.filter((task) => task.status === 'done').length / tasks.length) * 100}%` }} /></div>
          </section>
          <section className="glass-panel workspace-card"><div className="panel-kicker"><span>WORKSPACE</span><Activity size={13} /></div><div className="workspace-path"><Terminal size={14} /><span>~/projects/<strong>zanshin</strong></span></div><div className="workspace-stats"><div><strong>12</strong><span>files</span></div><div><strong>4</strong><span>active tasks</span></div><div><strong>0</strong><span>errors</span></div></div><button className="secondary-button full-width" type="button"><FolderOpen size={14} /> Change workspace</button></section>
          <div className="rail-tip"><span className="tip-line" /><div><strong>Operator note</strong><p>Keep the loop small. Make the next action obvious.</p></div></div>
        </section>

        <section className="main-column">
          <div className="transcript-header"><div><div className="eyebrow"><span className="live-pulse" /> LIVE TRANSCRIPT</div><h1>{mode === 'plan' ? 'Plan the next move' : 'Build with intent.'}</h1><p>{mode === 'plan' ? 'Read-only investigation is active.' : 'A quiet space for focused agent work.'}</p></div><div className="transcript-actions"><button className="small-action" onClick={() => setMessages([])} type="button"><Square size={12} /> Clear</button><button className="small-action" type="button"><MoreHorizontal size={15} /></button></div></div>
          <div className="transcript-scroll">
            {messages.length === 0 && <div className="empty-transcript"><div className="empty-cat"><CatMark /></div><strong>Nothing in the transcript yet</strong><span>Send a task below to begin a focused run.</span></div>}
            {messages.map((message) => <article className={`message ${message.role}`} key={message.id}><div className="message-avatar">{message.role === 'user' ? 'ZA' : <CatMark />}</div><div className="message-body"><div className="message-meta"><strong>{message.role === 'user' ? 'You' : 'Zanshin'}</strong><span>{message.time}</span>{message.role === 'agent' && <span className="message-badge">agent</span>}</div><div className="message-content">{message.content}</div>{message.reasoning && <button className="reasoning-toggle" onClick={() => setReasoningOpen((open) => !open)} type="button"><ChevronDown size={13} className={reasoningOpen ? 'rotate' : ''} /> {reasoningOpen ? 'Hide reasoning' : 'Show reasoning'}</button>}{message.reasoning && reasoningOpen && <div className="reasoning-block"><Sparkles size={13} /><span>{message.reasoning}</span></div>}{message.tool && <div className={`tool-card ${toolOpen ? 'open' : ''}`}><button className="tool-header" onClick={() => setToolOpen((open) => !open)} type="button"><div className="tool-title"><Terminal size={13} /><strong>{message.tool.name}</strong><span>{message.tool.detail}</span></div><div className="tool-status"><span className={message.tool.status === 'running' ? 'status-dot status-dot-pink' : 'status-dot status-dot-green'} />{message.tool.status === 'running' ? 'running' : 'complete'}<ChevronDown size={13} className={toolOpen ? 'rotate' : ''} /></div></button>{toolOpen && <div className="tool-output"><CheckCircle2 size={14} />{message.tool.output}</div>}</div>}</div></article>)}
            {agentStatus === 'busy' && <div className="typing-row"><div className="message-avatar"><CatMark /></div><div className="typing-card"><span /><span /><span /> <em>agent is thinking</em></div></div>}
          </div>
          <div className="composer-wrap"><form className="composer" onSubmit={handleSubmit}><div className="composer-top"><span className="composer-mode"><span className="status-dot status-dot-pink" /> {mode === 'plan' ? 'Plan Mode' : 'Build Mode'}</span><span className="composer-hint">Type / for commands</span></div><div className="composer-input-row"><input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleInputKeyDown} placeholder="Ask Zanshin to inspect, plan, or build..." aria-label="Message Zanshin" /><button className="send-button" type="submit" aria-label="Send message"><ArrowUp size={18} /></button></div><div className="composer-foot"><div className="composer-tools"><button type="button" aria-label="Attach file"><Plus size={15} /></button><button type="button" aria-label="Open workspace"><FileCode2 size={14} /></button><span>⌘ ↵ to send</span></div><div className="composer-limit"><span className={textLimitOn ? 'limit-on' : ''}>{textLimitOn ? `≤${textLimit}w` : 'No text cap'}</span><span>·</span><span>{selectedModel.name}</span></div></div></form></div>
        </section>

        <aside className="right-rail">
          <section className="glass-panel design-panel"><div className="panel-kicker"><span>02 / SYSTEM DESIGN</span><Heart size={13} fill="currentColor" /></div><div className="design-title"><h2>Ship the loop.</h2><span>v0.1</span></div><div className="flow-list">{flowSteps.map((step, index) => <div className={`flow-step ${index === 1 ? 'current' : index === 0 ? 'complete' : ''}`} key={step}><div className="flow-node">{index === 0 ? <Check size={12} /> : <span>0{index + 1}</span>}</div><div className="flow-copy"><strong>{step}</strong><span>{index === 1 ? 'in progress' : index === 0 ? 'complete' : 'queued'}</span></div>{index < flowSteps.length - 1 && <div className="flow-connector" />}</div>)}</div></section>
          <section className="glass-panel context-panel"><div className="panel-kicker"><span>03 / CONTEXT WINDOW</span><Gauge size={13} /></div><div className="context-reading"><div><strong>{(ctxUsed / 1000).toFixed(1)}k</strong><span>effective tokens</span></div><div className="context-percent">{ctxPercent}%</div></div><div className="context-bar"><span style={{ width: `${Math.min(ctxPercent, 100)}%` }} /><i style={{ left: '55%' }} /></div><div className="context-labels"><span>0</span><span>low-water 55%</span><span>{Math.round(ctxLimit / 1000)}k limit</span></div><div className="context-detail"><div><span>Offloaded</span><strong>18 blocks</strong></div><div><span>Tokens saved</span><strong>42.8k</strong></div><div><span>Est. saved</span><strong className="green-text">$0.13</strong></div></div><button className="secondary-button full-width" onClick={() => setToast('Context archive opened')} type="button"><History size={14} /> Browse offloaded blocks</button></section>
          <section className="glass-panel guardrail-panel"><div className="guardrail-icon"><ShieldCheck size={16} /></div><div><strong>Safe by default</strong><span>{mode === 'plan' ? 'Read-only tools only' : 'Edits ask for approval'}</span></div><ChevronRight size={15} className="muted-icon" /></section>
        </aside>
      </div>

      <footer className="statusbar"><div className="statusbar-group"><span className="statusbar-live"><span className="status-dot status-dot-green" /> local runtime</span><span className="statusbar-divider" /><span>{selectedModel.name}</span><span className="statusbar-divider" /><span>{mode === 'plan' ? 'plan mode' : 'build mode'}</span></div><div className="statusbar-group"><span><strong>{ctxUsed.toLocaleString()}</strong> / {ctxLimit.toLocaleString()} ctx</span><span className="statusbar-divider" /><span className={textLimitOn ? 'footer-limit' : ''}>{textLimitOn ? `≤${textLimit}w` : 'text unlimited'}</span><span className="statusbar-divider" /><span className="cost-label">session <strong>$0.047</strong></span></div></footer>

      {settingsOpen && <div className="settings-popover glass-panel"><div className="popover-heading"><div><span className="eyebrow">PREFERENCES</span><h3>Run controls</h3></div><button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings" type="button"><X size={15} /></button></div><div className="setting-section"><div className="setting-label"><span>Model</span><span className="setting-value">{selectedModel.provider}</span></div><select value={selectedModel.name} onChange={(event) => { const next = filteredModels.find((model) => model.name === event.target.value); if (next) setSelectedModel(next); }} aria-label="Choose model">{filteredModels.map((model) => <option key={model.name}>{model.name}</option>)}</select><div className="model-price"><span>{selectedModel.context} context</span><span>{selectedModel.price} / 1M tokens</span></div></div><div className="setting-section"><div className="setting-label"><span>Context limit</span><span className="setting-value">{Math.round(ctxLimit / 1000)}k</span></div><input type="range" min="10000" max="100000" step="1000" value={ctxLimit} onChange={(event) => setCtxLimit(Number(event.target.value))} aria-label="Context limit" /><div className="range-labels"><span>10k</span><span>100k</span></div></div><div className="setting-section"><div className="setting-label"><span>Text limiter</span><button className={`toggle ${textLimitOn ? 'on' : ''}`} onClick={() => setTextLimitOn((enabled) => !enabled)} aria-label="Toggle text limiter" type="button"><span /></button></div><input type="range" min="1" max="500" value={textLimit} onChange={(event) => setTextLimit(Number(event.target.value))} aria-label="Text limit" /><div className="range-labels"><span>1 word</span><span>{textLimit} words</span></div></div><div className="popover-shortcuts"><Keyboard size={14} /><span><strong>⌘K</strong> command palette</span><span><strong>Tab</strong> switch mode</span></div></div>}

      {paletteOpen && <div className="palette-backdrop" onClick={() => setPaletteOpen(false)}><div className="command-palette glass-panel" onClick={(event) => event.stopPropagation()}><div className="palette-search"><Search size={16} /><input autoFocus placeholder="Search commands..." /><kbd>esc</kbd></div><div className="palette-section-label">QUICK ACTIONS</div>{paletteItems.map((item) => <button className="palette-item" key={item.label} onClick={() => handlePaletteAction(item.action)} type="button"><span className="palette-icon"><Workflow size={15} /></span><span>{item.label}</span><kbd>{item.shortcut}</kbd></button>)}<div className="palette-footer"><span>Navigate with ↑ ↓</span><span>Enter to select</span></div></div></div>}

      {toast && <div className="toast"><CheckCircle2 size={15} /> {toast}</div>}
      <button className="mobile-menu" onClick={() => setSessionOpen((open) => !open)} aria-label="Toggle session sidebar" type="button"><Menu size={18} /></button>
    </main>
  );
}

function CatMark() {
  return <span className="cat-mark" aria-hidden="true"><span className="cat-ear left" /><span className="cat-ear right" /><span className="cat-face"><span className="cat-eye left" /><span className="cat-eye right" /><span className="cat-mouth" /></span></span>;
}

export default App;

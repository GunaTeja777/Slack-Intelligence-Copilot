import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { Dashboard } from './components/Dashboard';
import { AuditLogs } from './components/AuditLogs';
import { SettingsModal } from './components/SettingsModal';
import { Terminal, Shield, BarChart3, Database, Search } from 'lucide-react';

interface ToolExecutionStep {
  tool: string;
  arguments: any;
  result?: any;
  status: 'running' | 'completed' | 'failed' | 'pending_confirmation';
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  thoughts?: string[];
  steps?: ToolExecutionStep[];
  pendingConfirmation?: {
    tool: string;
    arguments: any;
    preview: {
      channel_id: string;
      text: string;
      thread_ts?: string;
    };
  };
}

export default function App() {
  // App connection and list states
  const [connected, setConnected] = useState(false);
  const [tools, setTools] = useState<any[]>([]);
  const [mcpLogs, setMcpLogs] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({
    server_command: 'python',
    server_args: ['backend/slack_mcp_server.py'],
    provider: 'gemini',
    has_api_key: false,
    slack_token_configured: false
  });

  const [syncing, setSyncing] = useState(false);
  const [channels, setChannels] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  // Chat and LLM states
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  // Dashboard and Analytics states
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<'dashboard' | 'tools' | 'audit'>('dashboard');

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Search overlay state
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchActive, setSearchActive] = useState(false);
  const [lastSearchQuery, setLastSearchQuery] = useState('');
  const [searchSemantic, setSearchSemantic] = useState(false);

  // Modals state
  const [showSettings, setShowSettings] = useState(false);

  const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000/api/v1';

  // Initial load
  useEffect(() => {
    fetchSystemStatus();
    fetchCacheData();
    fetchDashboardStats();
    fetchAuditLogs();
    
    // Poll system status and logs every 5 seconds for the debugger panel
    const interval = setInterval(() => {
      fetchSystemStatus(true);
      fetchAuditLogs();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchSystemStatus = async (silent = false) => {
    try {
      const res = await fetch(`${API_BASE}/status`);
      if (res.ok) {
        const data = await res.json();
        setConnected(data.connected);
        setTools(data.tools || []);
        setMcpLogs(data.logs || []);
        setConfig(data.config || {});
      }
    } catch (err) {
      if (!silent) console.error('Error fetching system status:', err);
    }
  };

  const fetchCacheData = async () => {
    try {
      const [chRes, uRes] = await Promise.all([
        fetch(`${API_BASE}/channels`),
        fetch(`${API_BASE}/users`)
      ]);
      if (chRes.ok) {
        const data = await chRes.json();
        setChannels(data.channels || []);
      }
      if (uRes.ok) {
        const data = await uRes.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Error fetching cache data:', err);
    }
  };

  const fetchDashboardStats = async () => {
    setDashboardLoading(true);
    try {
      const res = await fetch(`${API_BASE}/dashboard`);
      if (res.ok) {
        const data = await res.json();
        setDashboardStats(data);
      }
    } catch (err) {
      console.error('Error fetching dashboard statistics:', err);
    } finally {
      setDashboardLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/audit-logs`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/sync`, { method: 'POST' });
      if (res.ok) {
        // Poll status until sync finishes or wait a brief period.
        // Let's delay 5 seconds and fetch cache data.
        setTimeout(async () => {
          await fetchCacheData();
          await fetchDashboardStats();
          setSyncing(false);
        }, 5000);
      } else {
        setSyncing(false);
      }
    } catch (err) {
      console.error('Sync error:', err);
      setSyncing(false);
    }
  };

  const handleSearch = async (query: string, semantic: boolean) => {
    setSearchActive(true);
    setLastSearchQuery(query);
    setSearchSemantic(semantic);
    try {
      const body: any = { query, semantic, limit: 15 };
      if (selectedChannelId) {
        body.channel_id = selectedChannelId;
      }
      
      const res = await fetch(`${API_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch (err) {
      console.error('Search error:', err);
    }
  };

  const handleSendMessage = async (text: string) => {
    // Append user message
    const userMsg: Message = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setLoading(true);

    // Prepare context history for the API
    const historyPayload = messages.map(m => ({
      role: m.role,
      content: m.content
    }));

    // Create assistant message slot
    const assistantMsgIndex = updatedMessages.length;
    setMessages(prev => [
      ...prev,
      { role: 'assistant', content: '', thoughts: [], steps: [] }
    ]);

    try {
      // Initiate SSE request
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: text,
          history: historyPayload,
          provider: config.provider
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Server returned an error');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        
        // Keep the last partial line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (!dataStr.trim()) continue;
            
            try {
              const chunk = JSON.parse(dataStr);
              
              setMessages(prev => {
                const copy = [...prev];
                const msg = { ...copy[assistantMsgIndex] };
                
                if (chunk.type === 'thought') {
                  msg.thoughts = [...(msg.thoughts || []), chunk.thought];
                } else if (chunk.type === 'tool_start') {
                  msg.steps = [
                    ...(msg.steps || []),
                    { tool: chunk.tool, arguments: chunk.arguments, status: 'running' }
                  ];
                } else if (chunk.type === 'tool_end') {
                  // Update the running step
                  msg.steps = (msg.steps || []).map(step => 
                    step.tool === chunk.tool && step.status === 'running'
                      ? { ...step, result: chunk.result, status: 'completed' }
                      : step
                  );
                } else if (chunk.type === 'confirmation_required') {
                  msg.pendingConfirmation = {
                    tool: chunk.tool,
                    arguments: chunk.arguments,
                    preview: chunk.preview
                  };
                  msg.steps = (msg.steps || []).map(step => 
                    step.tool === chunk.tool && step.status === 'running'
                      ? { ...step, status: 'pending_confirmation' }
                      : step
                  );
                } else if (chunk.type === 'answer') {
                  msg.content = chunk.answer;
                } else if (chunk.type === 'error') {
                  msg.content = `Error: ${chunk.message}`;
                }
                
                copy[assistantMsgIndex] = msg;
                return copy;
              });
            } catch (jsonErr) {
              console.error('Failed to parse chunk:', line, jsonErr);
            }
          }
        }
      }
    } catch (err: any) {
      setMessages(prev => {
        const copy = [...prev];
        copy[assistantMsgIndex] = {
          role: 'assistant',
          content: `Failed to retrieve answer: ${err.message}`
        };
        return copy;
      });
    } finally {
      setLoading(false);
      fetchDashboardStats(); // Refresh dashboard in case stats changed
    }
  };

  const handleConfirmAction = async (tool: string, args: any) => {
    try {
      const res = await fetch(`${API_BASE}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool, arguments: args })
      });
      
      if (res.ok) {
        const data = await res.json();
        
        // Find the message with pending confirmation and mark it complete
        setMessages(prev => {
          return prev.map(msg => {
            if (msg.pendingConfirmation && msg.pendingConfirmation.tool === tool) {
              const updatedSteps = (msg.steps || []).map(step => 
                step.tool === tool ? { ...step, result: data, status: 'completed' as const } : step
              );
              return {
                ...msg,
                pendingConfirmation: undefined,
                steps: updatedSteps,
                content: msg.content + `\n\n✅ **Action Confirmed and Executed!**\nSlack API Response:\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``
              };
            }
            return msg;
          });
        });
        
        fetchAuditLogs();
        fetchDashboardStats();
      } else {
        const errText = await res.text();
        alert(`Failed to execute write action: ${errText}`);
      }
    } catch (err) {
      console.error('Error confirming write action:', err);
    }
  };

  const handleCancelAction = () => {
    setMessages(prev => {
      return prev.map(msg => {
        if (msg.pendingConfirmation) {
          const updatedSteps = (msg.steps || []).map(step => 
            step.status === 'pending_confirmation' ? { ...step, status: 'failed' as const } : step
          );
          return {
            ...msg,
            pendingConfirmation: undefined,
            steps: updatedSteps,
            content: msg.content + '\n\n❌ **Action Cancelled by User.** No message was sent.'
          };
        }
        return msg;
      });
    });
  };

  const handleSaveSettings = async (settingsPayload: any) => {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settingsPayload)
    });
    
    if (res.ok) {
      await fetchSystemStatus();
    } else {
      const text = await res.text();
      throw new Error(text);
    }
  };

  const handleSelectChannel = (channelId: string) => {
    setSelectedChannelId(channelId);
    const targetChannel = channels.find(c => c.id === channelId);
    if (targetChannel) {
      // Open a conversation wrapper focused on this channel
      setMessages([
        {
          role: 'assistant',
          content: `Context updated: Active channel focus is now set to **#${targetChannel.name}**.\n\nYou can ask me to summarize the channel, analyze recent decisions, search for topics within it, or draft posts directly.`
        }
      ]);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slack-dark text-slate-100 font-sans">
      
      {/* 1. Left Sidebar */}
      <Sidebar
        connected={connected}
        toolsCount={tools.length}
        syncing={syncing}
        channels={channels}
        users={users}
        selectedChannelId={selectedChannelId}
        onSelectChannel={handleSelectChannel}
        onSync={handleSync}
        onOpenSettings={() => setShowSettings(true)}
        onOpenAuditLogs={() => setRightPanelTab('audit')}
        onSearch={handleSearch}
      />

      {/* 2. Center Chat/Search Area */}
      <div className="flex-1 flex flex-col h-full p-4 gap-4 overflow-hidden">
        {/* Header toolbar */}
        <div className="flex justify-between items-center bg-zinc-950/45 border border-zinc-900/60 px-6 py-4 rounded-2xl shadow-lg backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full relative flex">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet-500"></span>
            </span>
            <div>
              <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-widest font-display">Active Workspace Context</span>
              <h2 className="text-sm font-bold text-white flex items-center gap-1 font-ui">
                {selectedChannelId 
                  ? `#${channels.find(c => c.id === selectedChannelId)?.name}` 
                  : 'Global Workspace Assistant'}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs font-ui">
            <span className="text-zinc-500 font-semibold">LLM:</span>
            <span className="bg-zinc-950 border border-zinc-900 px-3 py-1 rounded-xl text-zinc-350 font-mono capitalize shadow-inner text-[10px] font-bold tracking-wider">
              {config.provider === 'local' ? 'Ollama' : config.provider}
            </span>
          </div>
        </div>

        {/* Dynamic View: Search Results or Chat Area */}
        {searchActive ? (
          <div className="flex-1 bg-zinc-950/45 border border-zinc-900 rounded-2xl p-6 flex flex-col h-full animate-in fade-in duration-200 shadow-2xl backdrop-blur-xl">
            <div className="flex justify-between items-center pb-4 border-b border-zinc-900 mb-4 shrink-0 font-ui">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-violet-400 animate-pulse" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-display">
                  Search Results for "{lastSearchQuery}" {searchSemantic && '(Semantic Mode)'}
                </h3>
              </div>
              <button 
                onClick={() => setSearchActive(false)}
                className="text-zinc-500 hover:text-white transition-all p-1.5 bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 rounded-xl text-[10px] font-bold"
              >
                Close Search
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3.5 pr-1.5 scrollbar-thin">
              {searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-zinc-500 font-ui">
                  <Database className="w-12 h-12 opacity-15 mb-4 text-zinc-400" />
                  <p className="text-xs font-semibold text-zinc-400">No matches found in indexed knowledge layer.</p>
                  <p className="text-[10px] opacity-70 mt-1">Try running a sync cache operation or check keywords.</p>
                </div>
              ) : (
                searchResults.map((res, idx) => (
                  <div 
                    key={idx} 
                    className="p-4 bg-zinc-950/80 rounded-xl border border-zinc-900 hover:border-zinc-800 hover:scale-[1.002] duration-200 transition-all flex flex-col gap-2.5 shadow-sm"
                  >
                    <div className="flex justify-between items-start text-[9px] font-ui">
                      <span className="text-violet-300 bg-violet-500/10 border border-violet-500/15 px-2.5 py-0.5 rounded-md font-mono font-bold uppercase">
                        #{res.channel_name}
                      </span>
                      <div className="flex items-center gap-2.5">
                        <span className="text-zinc-400 font-bold">{res.user_name}</span>
                        <span className="text-zinc-650 font-mono font-semibold">Match Score: {res.score.toFixed(3)}</span>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed font-ui font-medium">{res.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <ChatArea
            messages={messages}
            loading={loading}
            onSendMessage={handleSendMessage}
            onConfirmAction={handleConfirmAction}
            onCancelAction={handleCancelAction}
          />
        )}
      </div>

      {/* 3. Right Analytics and Debugger split panel */}
      <div className="w-[460px] h-full p-4 border-l border-zinc-900/80 flex flex-col gap-4 bg-slack-sidebar/45 backdrop-blur-xl shrink-0">
        
        {/* Tab Selection */}
        <div className="flex bg-zinc-950/85 border border-zinc-900 p-1 rounded-xl gap-1 shrink-0 font-ui">
          <button
            onClick={() => setRightPanelTab('dashboard')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-bold transition-all duration-200 ${
              rightPanelTab === 'dashboard'
                ? 'bg-violet-500/10 text-violet-300 border border-violet-500/20'
                : 'text-zinc-550 hover:text-zinc-300 hover:bg-zinc-900/20'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Dashboard
          </button>
          <button
            onClick={() => setRightPanelTab('tools')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-bold transition-all duration-200 ${
              rightPanelTab === 'tools'
                ? 'bg-violet-500/10 text-violet-300 border border-violet-500/20'
                : 'text-zinc-550 hover:text-zinc-300 hover:bg-zinc-900/20'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            MCP Tools & Logs
          </button>
          <button
            onClick={() => setRightPanelTab('audit')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-bold transition-all duration-200 ${
              rightPanelTab === 'audit'
                ? 'bg-violet-500/10 text-violet-300 border border-violet-500/20'
                : 'text-zinc-550 hover:text-zinc-300 hover:bg-zinc-900/20'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Audit Trail
          </button>
        </div>

        {/* Panel Content Scroll Container */}
        <div className="flex-1 overflow-hidden">
          
          {rightPanelTab === 'dashboard' && (
            <Dashboard
              stats={dashboardStats}
              loading={dashboardLoading}
            />
          )}

          {rightPanelTab === 'tools' && (
            <div className="flex flex-col h-full bg-zinc-950/45 border border-zinc-900/60 rounded-2xl overflow-hidden shadow-2xl">
              <div className="px-5 py-3.5 border-b border-zinc-900 bg-zinc-950/60 flex justify-between items-center font-display">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Available MCP Tools</span>
                <span className="text-[9px] text-zinc-550 font-mono font-bold">Discovered: {tools.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 max-h-[300px] border-b border-zinc-900/60 scrollbar-thin">
                {tools.length === 0 ? (
                  <div className="text-xs text-zinc-550 text-center py-10 font-ui italic">No tools registered. Verify server connection.</div>
                ) : (
                  tools.map((t, idx) => (
                    <div key={idx} className="p-3.5 bg-zinc-950/80 rounded-xl border border-zinc-900/80 hover:border-zinc-850 transition-colors space-y-1">
                      <span className="text-xs font-bold font-mono text-zinc-300">{t.name}</span>
                      <p className="text-[10px] text-zinc-500 leading-relaxed font-ui">{t.description}</p>
                    </div>
                  ))
                )}
              </div>
              
              <div className="px-5 py-3 bg-zinc-950/60 border-b border-zinc-900 flex justify-between items-center font-display">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Stdio RPC Stream Console</span>
                <button 
                  onClick={() => setMcpLogs([])} 
                  className="text-[9px] text-zinc-500 hover:text-white font-bold"
                >
                  Clear stream
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 font-mono text-[9px] bg-black/60 text-emerald-400 space-y-2 max-h-[320px] scrollbar-thin">
                {mcpLogs.length === 0 ? (
                  <div className="text-zinc-700 text-center py-16 font-mono text-[10px]">Listening for Stdio JSON-RPC frames...</div>
                ) : (
                  mcpLogs.map((log, idx) => (
                    <div key={idx} className="border-b border-zinc-900/40 pb-1.5 font-mono">
                      <span className="text-zinc-550 font-mono">[{new Date(log.timestamp * 1000).toLocaleTimeString()}]</span>{' '}
                      <span className={log.level === 'ERROR' ? 'text-rose-400 font-bold' : log.level === 'WARNING' ? 'text-amber-400 font-bold' : 'text-emerald-400 font-semibold'}>
                        {log.level}:
                      </span>{' '}
                      <span className="text-zinc-350">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {rightPanelTab === 'audit' && (
            <AuditLogs
              logs={auditLogs}
            />
          )}

        </div>

      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        config={config}
        onSave={handleSaveSettings}
      />

    </div>
  );
}

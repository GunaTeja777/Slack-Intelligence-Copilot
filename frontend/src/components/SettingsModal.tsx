import React, { useState } from 'react';
import { Settings, Shield, Sliders, Server, Key, X, Check, AlertCircle } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: {
    server_command: string;
    server_args: string[];
    provider: string;
    has_api_key: boolean;
    slack_token_configured: boolean;
  };
  onSave: (settings: {
    provider: string;
    api_key?: string;
    slack_token?: string;
    server_command?: string;
    server_args?: string;
  }) => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, config, onSave }) => {
  const [provider, setProvider] = useState(config.provider || 'gemini');
  const [apiKey, setApiKey] = useState('');
  const [slackToken, setSlackToken] = useState('');
  const [serverCommand, setServerCommand] = useState(config.server_command || 'python');
  const [serverArgs, setServerArgs] = useState(config.server_args?.join(' ') || 'slack_mcp_server.py');
  const [activeTab, setActiveTab] = useState<'llm' | 'slack' | 'security'>('llm');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      await onSave({
        provider,
        api_key: apiKey || undefined,
        slack_token: slackToken || undefined,
        server_command: serverCommand,
        server_args: serverArgs
      });
      setSuccess(true);
      setApiKey('');
      setSlackToken('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-250">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[560px] backdrop-blur-2xl animate-in zoom-in-95 duration-200 transition-colors">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4.5 border-b border-zinc-200 dark:border-zinc-900 bg-zinc-50 dark:bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-violet-500/10 rounded-lg text-violet-550 dark:text-violet-400">
              <Settings className="w-5 h-5 animate-spin-slow" />
            </div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white font-display">System Configuration Panel</h2>
          </div>
          <button 
            onClick={onClose} 
            className="text-zinc-400 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-white transition-all duration-200 p-1.5 rounded-xl hover:bg-zinc-200/50 dark:hover:bg-zinc-900 border border-transparent hover:border-zinc-250 dark:hover:border-zinc-800"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Inner Content Split */}
        <div className="flex-1 flex overflow-hidden">
          {/* Side tabs */}
          <div className="w-48 border-r border-zinc-200 dark:border-zinc-900 p-4 flex flex-col gap-1 bg-zinc-50 dark:bg-zinc-950/30 transition-colors">
            <button
              onClick={() => setActiveTab('llm')}
              className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all font-ui ${
                activeTab === 'llm' 
                  ? 'bg-violet-500/10 text-violet-650 dark:text-violet-300 border-l-2 border-violet-500 shadow-sm' 
                  : 'text-zinc-500 dark:text-zinc-450 hover:text-zinc-850 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-900/40'
              }`}
            >
              <Key className="w-4 h-4" />
              AI Providers
            </button>
            <button
              onClick={() => setActiveTab('slack')}
              className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all font-ui ${
                activeTab === 'slack' 
                  ? 'bg-violet-500/10 text-violet-650 dark:text-violet-300 border-l-2 border-violet-500 shadow-sm' 
                  : 'text-zinc-500 dark:text-zinc-450 hover:text-zinc-850 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-900/40'
              }`}
            >
              <Server className="w-4 h-4" />
              Slack & MCP
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all font-ui ${
                activeTab === 'security' 
                  ? 'bg-violet-500/10 text-violet-650 dark:text-violet-300 border-l-2 border-violet-500 shadow-sm' 
                  : 'text-zinc-500 dark:text-zinc-450 hover:text-zinc-850 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-900/40'
              }`}
            >
              <Shield className="w-4 h-4" />
              Security Gate
            </button>
          </div>

          {/* Tab content panel */}
          <form onSubmit={handleSubmit} className="flex-1 p-6 overflow-y-auto flex flex-col justify-between">
            <div className="space-y-6">
              
              {/* Tab: LLM Settings */}
              {activeTab === 'llm' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 font-display uppercase tracking-wider mb-1">Model Provider</h3>
                    <p className="text-[11px] text-zinc-500 mb-3.5 font-ui">Choose which AI reasoning service will power the Slack agent.</p>
                    <div className="grid grid-cols-3 gap-2 font-ui">
                      {['gemini', 'openai', 'local'].map((prov) => (
                        <button
                          key={prov}
                          type="button"
                          onClick={() => setProvider(prov)}
                          className={`px-3 py-3 rounded-xl border text-xs font-bold transition-all capitalize hover:scale-[1.02] duration-200 ${
                            provider === prov
                              ? 'border-violet-500 bg-violet-500/10 text-violet-650 dark:text-white shadow-md'
                              : 'border-zinc-200 bg-zinc-50 text-zinc-550 hover:text-zinc-850 dark:border-zinc-900 dark:bg-zinc-950/60 dark:text-zinc-450 dark:hover:bg-zinc-900'
                          }`}
                        >
                          {prov === 'local' ? 'Ollama (Local)' : prov}
                        </button>
                      ))}
                    </div>
                  </div>

                  {provider !== 'local' && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="flex justify-between items-center font-ui">
                        <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                          {provider === 'gemini' ? 'Gemini API Key' : 'OpenAI API Key'}
                        </label>
                        {config.has_api_key && (
                          <span className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold font-mono">
                            <Check className="w-3 h-3" /> Configured
                          </span>
                        )}
                      </div>
                      <input
                        type="password"
                        placeholder="Leave empty to keep existing api key"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-950 border border-zinc-250 dark:border-zinc-900 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-700 focus:outline-none focus:border-violet-500 focus:dark:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 font-ui transition-colors"
                      />
                      <p className="text-[10px] text-zinc-450 dark:text-zinc-550 leading-relaxed font-ui">
                        API keys are saved in local SQLite settings and are only transmitted to the authorized LLM server.
                      </p>
                    </div>
                  )}

                  {provider === 'local' && (
                    <div className="bg-zinc-50 dark:bg-[#0b0d13] p-4 rounded-xl border border-zinc-200 dark:border-zinc-900 text-xs text-zinc-600 dark:text-zinc-450 space-y-2 animate-in fade-in duration-300 font-ui leading-relaxed">
                      <p className="font-bold text-zinc-800 dark:text-zinc-300 font-display">Local LLM Orchestration</p>
                      <p>Ensures zero external network data calls. Requires Ollama server running locally:</p>
                      <ul className="list-disc pl-4 space-y-1 font-mono text-[10px] text-zinc-650 dark:text-zinc-400">
                        <li>Default endpoint: <code>http://localhost:11434</code></li>
                        <li>Target model: <code>llama3</code></li>
                      </ul>
                      <p className="text-amber-600 dark:text-amber-450/90 font-medium">Verify you have pulled and executed the model: <code>ollama run llama3</code>.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Slack Settings */}
              {activeTab === 'slack' && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center font-ui">
                      <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Slack Bot User OAuth Token</label>
                      {config.slack_token_configured && (
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold font-mono">
                          <Check className="w-3 h-3" /> Activated
                        </span>
                      )}
                    </div>
                    <input
                      type="password"
                      placeholder="xoxb-..."
                      value={slackToken}
                      onChange={(e) => setSlackToken(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-950 border border-zinc-250 dark:border-zinc-900 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-700 focus:outline-none focus:border-violet-500 focus:dark:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 font-ui transition-colors"
                    />
                    <p className="text-[10px] text-zinc-450 dark:text-zinc-555 leading-relaxed font-ui">
                      The bot OAuth token must be configured with scopes for listing channels and history (e.g. <code>channels:history</code>, <code>chat:write</code>).
                    </p>
                  </div>

                  <hr className="border-zinc-200 dark:border-zinc-900" />

                  <div className="space-y-3.5">
                    <h3 className="text-xs font-bold text-zinc-750 dark:text-zinc-300 font-display uppercase tracking-wider">MCP Daemon Settings</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 block mb-1 uppercase tracking-wide font-display">Executable Command</label>
                        <input
                          type="text"
                          value={serverCommand}
                          onChange={(e) => setServerCommand(e.target.value)}
                          className="w-full bg-white dark:bg-zinc-950 border border-zinc-250 dark:border-zinc-900 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-violet-500/50 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 block mb-1 uppercase tracking-wide font-display">Launch Target</label>
                        <input
                          type="text"
                          value={serverArgs}
                          onChange={(e) => setServerArgs(e.target.value)}
                          className="w-full bg-white dark:bg-zinc-950 border border-zinc-250 dark:border-zinc-900 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-violet-500/50 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Security */}
              {activeTab === 'security' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-bold text-zinc-750 dark:text-zinc-300 font-display uppercase tracking-wider mb-1">Audit Safeguards</h3>
                    <p className="text-[11px] text-zinc-500 mb-3.5 font-ui">Protective gateways validating active executions.</p>
                    <div className="bg-zinc-50 dark:bg-zinc-950/60 p-4 border border-zinc-200 dark:border-zinc-900 rounded-xl space-y-4 font-ui leading-relaxed transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 p-1.5 bg-violet-500/10 rounded-lg text-violet-555 dark:text-violet-400 shrink-0">
                          <Shield className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-zinc-800 dark:text-zinc-300">Confirmation Gateways Enabled</p>
                          <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                            No agent reasoning loops can post outbound messages directly. All write invocations route through the UI sandbox, waiting for human approval.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 p-1.5 bg-violet-500/10 rounded-lg text-violet-555 dark:text-violet-400 shrink-0">
                          <Sliders className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-zinc-800 dark:text-zinc-300">Secure Vault Storage</p>
                          <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                            Bot tokens and API keys are stored solely in the local SQLite table. They are never written to source logs or sent to intermediate platforms.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Save Area */}
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-900 mt-6 flex justify-between items-center font-ui">
              <div className="flex-1 pr-4">
                {success && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-450 font-bold animate-pulse">
                    <Check className="w-4 h-4" /> Settings updated successfully!
                  </div>
                )}
                {error && (
                  <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-bold">
                    <AlertCircle className="w-4 h-4" /> {error}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4.5 py-2 text-xs text-zinc-500 hover:text-zinc-850 dark:text-zinc-450 dark:hover:text-white transition-colors bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 border border-zinc-250 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs text-white dark:text-zinc-950 bg-violet-650 hover:bg-violet-600 dark:bg-violet-400 dark:hover:bg-violet-500 active:scale-95 transition-all font-bold rounded-xl shadow-md disabled:opacity-50 cursor-pointer hover:scale-[1.02]"
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
};

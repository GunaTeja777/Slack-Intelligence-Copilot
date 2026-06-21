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
  const [serverArgs, setServerArgs] = useState(config.server_args?.join(' ') || 'backend/slack_mcp_server.py');
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
      setApiKey(''); // Clear raw key input after saving
      setSlackToken(''); // Clear raw token input after saving
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl flex flex-col h-[550px] animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-800 bg-zinc-950/50">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-slack-purple" />
            <h2 className="text-lg font-semibold text-white">System Settings</h2>
          </div>
          <button 
            onClick={onClose} 
            className="text-zinc-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-zinc-850"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Inner Content Split */}
        <div className="flex-1 flex overflow-hidden">
          {/* Side tabs */}
          <div className="w-48 border-r border-zinc-850 p-4 flex flex-col gap-1 bg-zinc-950/20">
            <button
              onClick={() => setActiveTab('llm')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'llm' 
                  ? 'bg-slack-purple/10 text-slack-purple border-l-2 border-slack-purple font-semibold' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50'
              }`}
            >
              <Key className="w-4 h-4" />
              AI Providers
            </button>
            <button
              onClick={() => setActiveTab('slack')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'slack' 
                  ? 'bg-slack-purple/10 text-slack-purple border-l-2 border-slack-purple font-semibold' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50'
              }`}
            >
              <Server className="w-4 h-4" />
              Slack & MCP
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'security' 
                  ? 'bg-slack-purple/10 text-slack-purple border-l-2 border-slack-purple font-semibold' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50'
              }`}
            >
              <Shield className="w-4 h-4" />
              Security
            </button>
          </div>

          {/* Tab content panel */}
          <form onSubmit={handleSubmit} className="flex-1 p-6 overflow-y-auto flex flex-col justify-between">
            <div className="space-y-6">
              
              {/* Tab: LLM Settings */}
              {activeTab === 'llm' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-300 mb-1">Model Provider</h3>
                    <p className="text-xs text-zinc-500 mb-3">Choose which LLM power the Slack agent queries.</p>
                    <div className="grid grid-cols-3 gap-2">
                      {['gemini', 'openai', 'local'].map((prov) => (
                        <button
                          key={prov}
                          type="button"
                          onClick={() => setProvider(prov)}
                          className={`px-4 py-3 rounded-lg border text-sm font-medium transition-all capitalize ${
                            provider === prov
                              ? 'border-slack-purple bg-slack-purple/5 text-white shadow-sm shadow-slack-purple/10'
                              : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                          }`}
                        >
                          {prov === 'local' ? 'Ollama (Local)' : prov}
                        </button>
                      ))}
                    </div>
                  </div>

                  {provider !== 'local' && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-zinc-300">
                          {provider === 'gemini' ? 'Gemini API Key' : 'OpenAI API Key'}
                        </label>
                        {config.has_api_key && (
                          <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                            <Check className="w-3 h-3" /> Configured
                          </span>
                        )}
                      </div>
                      <input
                        type="password"
                        placeholder="Leave blank to keep current key"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-slack-purple"
                      />
                      <p className="text-[10px] text-zinc-500 leading-normal">
                        Your key is saved locally in sqlite cache settings and never transmitted to external services except the respective LLM servers.
                      </p>
                    </div>
                  )}

                  {provider === 'local' && (
                    <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-850 text-xs text-zinc-400 space-y-2 animate-in fade-in duration-200">
                      <p className="font-semibold text-zinc-300">Local LLM Configuration</p>
                      <p>Requires Ollama running on your local machine.</p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>Endpoint URL: <code className="bg-zinc-900 px-1 py-0.5 rounded text-zinc-300">http://localhost:11434</code></li>
                        <li>Model Target: <code className="bg-zinc-900 px-1 py-0.5 rounded text-zinc-300">llama3</code> (configurable in backend/config.py)</li>
                      </ul>
                      <p className="text-amber-400/80 font-medium mt-1">Make sure you have run: <code>ollama run llama3</code> to download the model.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Slack Settings */}
              {activeTab === 'slack' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-zinc-300">Slack Bot User OAuth Token</label>
                      {config.slack_token_configured && (
                        <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                          <Check className="w-3 h-3" /> Token Loaded
                        </span>
                      )}
                    </div>
                    <input
                      type="password"
                      placeholder="xoxb-..."
                      value={slackToken}
                      onChange={(e) => setSlackToken(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-slack-purple"
                    />
                    <p className="text-[10px] text-zinc-500 leading-normal">
                      The bot OAuth token must have permission to read/write messages and list channels (e.g. <code>channels:read</code>, <code>channels:history</code>, <code>chat:write</code>).
                    </p>
                  </div>

                  <hr className="border-zinc-850" />

                  <div>
                    <h3 className="text-sm font-semibold text-zinc-300 mb-1">MCP Connection Settings</h3>
                    <p className="text-xs text-zinc-500 mb-3">Settings to connect our MCP client to the Slack tool server.</p>
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-semibold text-zinc-400 block mb-1">Executable Command</label>
                        <input
                          type="text"
                          value={serverCommand}
                          onChange={(e) => setServerCommand(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-slack-purple"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-zinc-400 block mb-1">Launch Arguments</label>
                        <input
                          type="text"
                          value={serverArgs}
                          onChange={(e) => setServerArgs(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-slack-purple"
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
                    <h3 className="text-sm font-semibold text-zinc-300 mb-1">Write Action Protections</h3>
                    <p className="text-xs text-zinc-500 mb-3">Audit logs and permission safeguards configurations.</p>
                    <div className="bg-zinc-950 p-4 border border-zinc-850 rounded-lg space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 p-1 bg-slack-purple/10 rounded-md text-slack-purple">
                          <Shield className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-zinc-300">Confirmation Gateways Enabled</p>
                          <p className="text-[11px] text-zinc-500 mt-0.5 leading-normal">
                            All write operations (sending channel posts, posting replies) MUST trigger a UI-level confirmation box displaying a full preview of target destination and text content. No model can directly write to Slack.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 p-1 bg-slack-purple/10 rounded-md text-slack-purple">
                          <Sliders className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-zinc-300">Secure Vault Storage</p>
                          <p className="text-[11px] text-zinc-500 mt-0.5 leading-normal">
                            Bot tokens and API keys are stored solely in the local SQLite file settings table. They are never written to source logs or sent to intermediate platforms.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Save Area */}
            <div className="pt-6 border-t border-zinc-850 mt-6 flex justify-between items-center">
              <div className="flex-1 pr-4">
                {success && (
                  <div className="flex items-center gap-1.5 text-xs text-green-400 font-semibold animate-bounce">
                    <Check className="w-4 h-4" /> Settings updated successfully!
                  </div>
                )}
                {error && (
                  <div className="flex items-center gap-1.5 text-xs text-red-400 font-semibold">
                    <AlertCircle className="w-4 h-4" /> {error}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors bg-zinc-900 border border-zinc-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm text-white bg-slack-purple hover:bg-slack-purple/95 transition-colors font-semibold rounded-lg shadow-md shadow-slack-purple/15 flex items-center gap-2 disabled:opacity-50"
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

import React, { useState } from 'react';
import { Hash, Search, RefreshCw, Key, Shield, Database } from 'lucide-react';

interface Channel {
  id: string;
  name: string;
  topic?: string;
  purpose?: string;
  num_members?: number;
}

interface User {
  id: string;
  name: string;
  real_name?: string;
  display_name?: string;
  avatar?: string;
  email?: string;
}

interface SidebarProps {
  connected: boolean;
  toolsCount: number;
  syncing: boolean;
  channels: Channel[];
  users: User[];
  selectedChannelId: string | null;
  onSelectChannel: (channelId: string) => void;
  onSync: () => void;
  onOpenSettings: () => void;
  onOpenAuditLogs: () => void;
  onSearch: (query: string, semantic: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  connected,
  toolsCount,
  syncing,
  channels,
  users,
  selectedChannelId,
  onSelectChannel,
  onSync,
  onOpenSettings,
  onOpenAuditLogs,
  onSearch
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [useSemantic, setUseSemantic] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    onSearch(searchQuery.trim(), useSemantic);
  };

  return (
    <div className="w-80 bg-zinc-950 border border-zinc-850 flex flex-col h-full shrink-0 select-none">
      
      {/* Title / Logo */}
      <div className="p-5 border-b border-zinc-850 bg-zinc-950 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-slack-purple flex items-center justify-center text-white font-bold text-base shadow shadow-slack-purple/20">
            S
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-none">Slack Intelligence</h1>
            <span className="text-[10px] text-slack-purple font-semibold tracking-wider uppercase">Copilot v1.0</span>
          </div>
        </div>
        <button 
          onClick={onOpenSettings}
          className="text-zinc-500 hover:text-white transition-colors hover:bg-zinc-900 p-1.5 rounded-lg border border-zinc-850"
          title="Open settings"
        >
          <Key className="w-4 h-4" />
        </button>
      </div>

      {/* Connected Tools Status */}
      <div className="px-4 py-3 bg-zinc-900/40 border-b border-zinc-850 flex justify-between items-center text-xs">
        <div className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-500 shadow-sm shadow-green-500/20' : 'bg-red-500 shadow-sm shadow-red-500/20'}`}></span>
          <span className="font-semibold text-zinc-300">MCP server: {connected ? 'Connected' : 'Disconnected'}</span>
        </div>
        {connected ? (
          <span className="bg-slack-purple/10 text-slack-purple border border-slack-purple/15 text-[10px] px-2 py-0.5 rounded-full font-bold">
            {toolsCount} Tools
          </span>
        ) : (
          <span className="bg-red-500/10 text-red-400 border border-red-500/15 text-[10px] px-2 py-0.5 rounded-full font-bold">
            Offline
          </span>
        )}
      </div>

      {/* Local Knowledge Layer - Sync Widget */}
      <div className="p-4 border-b border-zinc-850 space-y-3 bg-zinc-900/10">
        <div className="flex justify-between items-center text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
          <span className="flex items-center gap-1">
            <Database className="w-3.5 h-3.5 text-zinc-600" />
            Knowledge Cache Layer
          </span>
          <button
            onClick={onSync}
            disabled={syncing || !connected}
            className="flex items-center gap-1 text-[10px] text-slack-purple hover:underline disabled:opacity-30 disabled:no-underline font-semibold"
          >
            <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>

        {/* Semantic Search widget */}
        <form onSubmit={handleSearchSubmit} className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-zinc-650" />
            <input
              type="text"
              placeholder="Search knowledge layer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-850 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-slack-purple placeholder-zinc-600"
            />
          </div>
          <div className="flex items-center justify-between px-1">
            <label className="flex items-center gap-1.5 text-[10px] text-zinc-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={useSemantic}
                onChange={(e) => setUseSemantic(e.target.checked)}
                className="rounded border-zinc-800 bg-zinc-900 text-slack-purple focus:ring-slack-purple"
              />
              Use LLM Vector Search
            </label>
            <button
              type="submit"
              className="text-[10px] font-bold text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Main Lists (Channels & Users) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        
        {/* Public Channels */}
        <div className="space-y-1.5">
          <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pl-2 flex justify-between items-center">
            <span>Channels ({channels.length})</span>
          </h3>
          <div className="space-y-0.5">
            {channels.length === 0 ? (
              <div className="text-[11px] text-zinc-600 pl-2 py-1">No channels loaded.</div>
            ) : (
              channels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => onSelectChannel(ch.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all ${
                    selectedChannelId === ch.id
                      ? 'bg-slack-purple/10 text-white font-semibold shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                  }`}
                >
                  <Hash className="w-3.5 h-3.5 text-zinc-650" />
                  <span className="truncate">{ch.name}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Active Members */}
        <div className="space-y-1.5">
          <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pl-2">
            Members ({users.length})
          </h3>
          <div className="space-y-0.5">
            {users.length === 0 ? (
              <div className="text-[11px] text-zinc-600 pl-2 py-1">No members loaded.</div>
            ) : (
              users.slice(0, 15).map((user) => (
                <div 
                  key={user.id} 
                  className="flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  <div className="w-5 h-5 rounded-md overflow-hidden bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[9px] font-bold text-zinc-500">{user.name[0]}</span>
                    )}
                  </div>
                  <span className="truncate">{user.real_name || user.display_name || user.name}</span>
                </div>
              ))
            )}
            {users.length > 15 && (
              <div className="text-[9px] text-zinc-500 pl-2.5 italic">+{users.length - 15} more members</div>
            )}
          </div>
        </div>

      </div>

      {/* Sidebar Footer Controls */}
      <div className="p-4 border-t border-zinc-850 bg-zinc-950/60 space-y-2">
        <button
          onClick={onOpenAuditLogs}
          className="w-full flex items-center justify-between px-3 py-2 bg-zinc-900/30 hover:bg-zinc-900 transition-colors border border-zinc-850 rounded-lg text-xs text-zinc-400 hover:text-white"
        >
          <span className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-slack-purple" />
            Security Audit Trail
          </span>
          <span className="bg-zinc-950 border border-zinc-850 text-[9px] px-1.5 py-0.2 rounded font-mono">Vault</span>
        </button>
      </div>

    </div>
  );
};

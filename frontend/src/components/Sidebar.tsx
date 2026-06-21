import React, { useState } from 'react';
import { Hash, Search, RefreshCw, Key, Shield, Database, X } from 'lucide-react';

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
  onClose?: () => void; // Optional handler to close mobile drawer
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
  onSearch,
  onClose
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [useSemantic, setUseSemantic] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    onSearch(searchQuery.trim(), useSemantic);
  };

  return (
    <div className="w-full lg:w-80 bg-zinc-100/95 dark:bg-zinc-950/85 backdrop-blur-xl border-r border-zinc-200 dark:border-zinc-900/80 flex flex-col h-full shrink-0 select-none transition-colors duration-300">
      
      {/* Title / Logo */}
      <div className="p-5 border-b border-zinc-200 dark:border-zinc-900/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 via-fuchsia-600 to-pink-500 flex items-center justify-center text-white font-extrabold text-lg shadow-lg shadow-violet-600/30">
            S
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-zinc-900 dark:text-white tracking-tight font-display">Slack Intelligence</h1>
            <span className="text-[10px] text-violet-500 dark:text-violet-400 font-bold tracking-wider uppercase font-ui">Copilot v1.0</span>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5">
          <button 
            onClick={onOpenSettings}
            className="text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white transition-all duration-300 hover:bg-zinc-200 dark:hover:bg-zinc-805 p-2 rounded-lg border border-zinc-300 dark:border-zinc-800/80 hover:border-violet-500/40 hover-glow-purple"
            title="Open settings"
          >
            <Key className="w-4 h-4" />
          </button>
          
          {onClose && (
            <button 
              onClick={onClose}
              className="lg:hidden text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800/85 transition-all"
              title="Close sidebar"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          )}
        </div>
      </div>

      {/* Connected Tools Status */}
      <div className="px-5 py-3 bg-zinc-200/40 dark:bg-zinc-950/40 border-b border-zinc-200 dark:border-zinc-900/50 flex justify-between items-center text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full relative flex">
            {connected ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </>
            ) : (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </>
            )}
          </span>
          <span className="font-semibold text-zinc-500 dark:text-zinc-400 font-ui text-[11px]">
            Server: {connected ? <span className="text-emerald-600 dark:text-emerald-400 font-bold">Connected</span> : <span className="text-rose-600 dark:text-rose-400 font-bold">Offline</span>}
          </span>
        </div>
        {connected ? (
          <span className="bg-violet-500/10 text-violet-600 dark:text-violet-305 border border-violet-500/20 text-[9px] px-2.5 py-0.5 rounded-full font-bold font-mono">
            {toolsCount} Tools Active
          </span>
        ) : (
          <span className="bg-rose-500/10 text-rose-600 dark:text-rose-300 border border-rose-500/20 text-[9px] px-2.5 py-0.5 rounded-full font-bold font-mono">
            Offline
          </span>
        )}
      </div>

      {/* Local Knowledge Layer - Sync Widget */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-900/50 space-y-3 bg-zinc-200/20 dark:bg-zinc-950/20">
        <div className="flex justify-between items-center text-[10px] uppercase font-bold text-zinc-500 tracking-wider font-display">
          <span className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
            Knowledge Cache Layer
          </span>
          <button
            onClick={onSync}
            disabled={syncing || !connected}
            className="flex items-center gap-1 text-[10px] text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 disabled:opacity-30 font-bold transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>

        {/* Semantic Search widget */}
        <form onSubmit={handleSearchSubmit} className="space-y-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-400 dark:text-zinc-600" />
            <input
              type="text"
              placeholder="Search knowledge logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-zinc-950/80 border border-zinc-300 dark:border-zinc-800/80 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-violet-500 focus:dark:border-violet-500/60 focus:ring-1 focus:ring-violet-500/20 placeholder-zinc-400 dark:placeholder-zinc-500 transition-all font-ui"
            />
          </div>
          <div className="flex items-center justify-between px-1">
            <label className="flex items-center gap-2 text-[10px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-400 transition-colors cursor-pointer select-none font-ui">
              <input
                type="checkbox"
                checked={useSemantic}
                onChange={(e) => setUseSemantic(e.target.checked)}
                className="w-3 h-3 rounded border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-violet-500 focus:ring-violet-500/20 focus:ring-offset-0 focus:outline-none"
              />
              Semantic Vector Search
            </label>
            <button
              type="submit"
              className="text-[10px] font-bold text-zinc-600 dark:text-zinc-305 hover:text-zinc-900 dark:hover:text-white bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 px-2.5 py-0.5 rounded-md hover:border-violet-500/30 transition-all"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Main Lists (Channels & Users) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Public Channels */}
        <div className="space-y-2">
          <h3 className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider pl-2 flex justify-between items-center font-display">
            <span>Channels ({channels.length})</span>
          </h3>
          <div className="space-y-1">
            {channels.length === 0 ? (
              <div className="text-[11px] text-zinc-500 dark:text-zinc-600 pl-2 py-1 italic font-ui">No channels synchronized.</div>
            ) : (
              channels.map((ch) => {
                const isActive = selectedChannelId === ch.id;
                return (
                  <button
                    key={ch.id}
                    onClick={() => {
                      onSelectChannel(ch.id);
                      if (onClose) onClose(); // Auto-close drawer on selection
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all duration-200 font-ui ${
                      isActive
                        ? 'bg-violet-500/10 text-violet-600 dark:text-violet-200 font-bold border-l-2 border-violet-500 pl-2.5 shadow-sm shadow-violet-500/5'
                        : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-900/40 hover:translate-x-1'
                    }`}
                  >
                    <Hash className={`w-3.5 h-3.5 ${isActive ? 'text-violet-500 dark:text-violet-400' : 'text-zinc-400 dark:text-zinc-600'}`} />
                    <span className="truncate">{ch.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Active Members */}
        <div className="space-y-2">
          <h3 className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider pl-2 font-display">
            Workspace Members ({users.length})
          </h3>
          <div className="space-y-1">
            {users.length === 0 ? (
              <div className="text-[11px] text-zinc-500 dark:text-zinc-600 pl-2 py-1 italic font-ui">No members synced.</div>
            ) : (
              users.slice(0, 15).map((user) => (
                <div 
                  key={user.id} 
                  className="flex items-center gap-2.5 px-3 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 font-ui hover:bg-zinc-200/20 dark:hover:bg-zinc-900/20 rounded-md transition-all"
                >
                  <div className="w-5 h-5 rounded-md overflow-hidden bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800/80 flex items-center justify-center shrink-0 shadow-sm relative">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400">{user.name[0].toUpperCase()}</span>
                    )}
                    <span className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-emerald-500 rounded-full border border-white dark:border-zinc-900"></span>
                  </div>
                  <span className="truncate text-zinc-600 dark:text-zinc-400">{user.real_name || user.display_name || user.name}</span>
                </div>
              ))
            )}
            {users.length > 15 && (
              <div className="text-[9px] text-zinc-400 dark:text-zinc-600 pl-3.5 italic font-ui">+{users.length - 15} more members</div>
            )}
          </div>
        </div>

      </div>

      {/* Sidebar Footer Controls */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-900/60 bg-zinc-200/20 dark:bg-zinc-950/40 space-y-2">
        <button
          onClick={onOpenAuditLogs}
          className="w-full flex items-center justify-between px-3.5 py-2.5 bg-white dark:bg-zinc-900/30 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 border border-zinc-300 dark:border-zinc-800 hover:border-violet-500/20 dark:hover:border-violet-500/20 hover-glow-purple transition-all duration-300 rounded-xl text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-ui font-medium"
        >
          <span className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-violet-500 dark:text-violet-400 animate-pulse" />
            Security Audit Trail
          </span>
          <span className="bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-[9px] px-2 py-0.5 rounded-md font-mono text-zinc-500 dark:text-zinc-500 font-bold">Vault</span>
        </button>
      </div>

    </div>
  );
};

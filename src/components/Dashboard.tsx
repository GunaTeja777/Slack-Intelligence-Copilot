import React from 'react';
import { BarChart3, Users, MessageSquare, TrendingUp, ShieldAlert, Award, Hash, Heart } from 'lucide-react';

interface ChannelStat {
  id: string;
  name: string;
  message_count: number;
  members: number;
}

interface UserStat {
  id: string;
  name: string;
  avatar: string;
  message_count: number;
}

interface VolumeStat {
  date: string;
  count: number;
}

interface TopicStat {
  topic: string;
  frequency: number;
}

interface ActionItem {
  ts: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  text: string;
  task: string;
  status: string;
}

interface DashboardStats {
  active_channels: ChannelStat[];
  active_users: UserStat[];
  message_volume: VolumeStat[];
  trending_topics: TopicStat[];
  sentiment_score: number; // 0-100
  open_action_items: ActionItem[];
}

interface DashboardProps {
  stats: DashboardStats | null;
  loading: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({ stats, loading }) => {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 py-12 bg-zinc-900 border border-zinc-850 rounded-xl">
        <div className="w-8 h-8 border-2 border-slack-purple border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm">Generating workspace intelligence...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 py-12 bg-zinc-900 border border-zinc-850 rounded-xl text-center p-6">
        <BarChart3 className="w-12 h-12 text-zinc-700 mb-3" />
        <p className="text-sm font-semibold text-zinc-300">No Intelligence Data Loaded</p>
        <p className="text-xs text-zinc-500 mt-1 max-w-xs leading-normal">
          Click the "Sync workspace" button in the sidebar to populate the cache and run analytics.
        </p>
      </div>
    );
  }

  // Calculate high-level metrics
  const totalMessages = stats.active_channels.reduce((sum, ch) => sum + ch.message_count, 0);
  const totalChannels = stats.active_channels.length;
  const totalUsers = stats.active_users.length;
  
  // Sentiment color coding
  const sentiment = stats.sentiment_score;
  const sentimentColor = sentiment > 65 ? 'text-green-400 bg-green-500/10 border-green-500/15' 
                       : sentiment < 45 ? 'text-red-400 bg-red-500/10 border-red-500/15'
                       : 'text-amber-400 bg-amber-500/10 border-amber-500/15';

  return (
    <div className="space-y-6 overflow-y-auto max-h-[85vh] pr-2">
      
      {/* 4 Cards Row - 2x2 grid fits the fixed sidebar perfectly */}
      <div className="grid grid-cols-2 gap-3">
        {/* Card 1: Messages */}
        <div className="bg-zinc-900 border border-zinc-850 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-slack-purple/10 rounded-lg text-slack-purple">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Total Cached</p>
            <h4 className="text-lg font-bold text-white mt-0.5">{totalMessages} messages</h4>
          </div>
        </div>

        {/* Card 2: Channels */}
        <div className="bg-zinc-900 border border-zinc-850 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400">
            <Hash className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Active Channels</p>
            <h4 className="text-lg font-bold text-white mt-0.5">{totalChannels} channels</h4>
          </div>
        </div>

        {/* Card 3: Users */}
        <div className="bg-zinc-900 border border-zinc-850 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Active Members</p>
            <h4 className="text-lg font-bold text-white mt-0.5">{totalUsers} members</h4>
          </div>
        </div>

        {/* Card 4: Sentiment */}
        <div className={`border p-4 rounded-xl flex items-center gap-4 bg-zinc-900 border-zinc-850`}>
          <div className={`p-3 rounded-lg ${sentimentColor.split(' ')[1]} ${sentimentColor.split(' ')[0]}`}>
            <Heart className="w-5 h-5 fill-current" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Workspace Sentiment</p>
            <h4 className="text-lg font-bold text-white mt-0.5">{sentiment}% Positive</h4>
          </div>
        </div>
      </div>

      {/* Charts Row - Stacked layout works best in the sidebar */}
      <div className="grid grid-cols-1 gap-4">
        
        {/* Message Volume Custom Chart */}
        <div className="bg-zinc-900 border border-zinc-850 p-5 rounded-xl flex flex-col h-[280px]">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-slack-purple" />
              Activity Volume Trends
            </h4>
            <span className="text-[10px] text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-850">Last 30 Days</span>
          </div>
          
          <div className="flex-1 flex items-end gap-2.5 pb-2 pt-4">
            {stats.message_volume.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-zinc-600">
                No chronological data available.
              </div>
            ) : (
              stats.message_volume.map((vol, idx) => {
                const maxCount = Math.max(...stats.message_volume.map(v => v.count), 1);
                const heightPercent = Math.max((vol.count / maxCount) * 100, 8);
                
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-1 bg-zinc-950 text-[10px] px-1.5 py-0.5 rounded border border-zinc-800 text-white font-mono opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                      {vol.count} msgs
                    </div>
                    {/* Bar */}
                    <div 
                      style={{ height: `${heightPercent}%` }} 
                      className="w-full bg-gradient-to-t from-slack-purple/40 to-slack-purple rounded-t hover:brightness-110 transition-all duration-300 shadow-md shadow-slack-purple/10"
                    ></div>
                    {/* Date label */}
                    <span className="text-[9px] text-zinc-600 mt-1.5 select-none font-mono">
                      {vol.date.substring(8, 10)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Trending Keywords / Topics */}
        <div className="bg-zinc-900 border border-zinc-850 p-5 rounded-xl flex flex-col h-[280px]">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 mb-4">
            <TrendingUp className="w-4 h-4 text-slack-purple" />
            Trending Topic Clusters
          </h4>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {stats.trending_topics.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-zinc-600">
                No conversations cached to cluster topics.
              </div>
            ) : (
              stats.trending_topics.map((item, idx) => {
                const maxFreq = Math.max(...stats.trending_topics.map(t => t.frequency), 1);
                const widthPercent = (item.frequency / maxFreq) * 100;
                
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-zinc-300 flex items-center gap-1">
                        <span className="text-[10px] text-slack-purple bg-slack-purple/10 border border-slack-purple/10 px-1 py-0.2 rounded font-mono">#{idx+1}</span>
                        {item.topic}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">{item.frequency} hits</span>
                    </div>
                    <div className="w-full bg-zinc-950 h-2 rounded overflow-hidden border border-zinc-850">
                      <div 
                        style={{ width: `${widthPercent}%` }}
                        className="bg-gradient-to-r from-slack-purple to-pink-500 h-full rounded"
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Grid: Active Users & Channels & Action Items - Stacked layout works best in the sidebar */}
      <div className="grid grid-cols-1 gap-4">
        
        {/* Active Channels */}
        <div className="bg-zinc-900 border border-zinc-850 p-5 rounded-xl">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4 flex items-center gap-1.5">
            <Hash className="w-4 h-4 text-slack-purple" />
            Channel Breakdown
          </h4>
          <div className="space-y-3">
            {stats.active_channels.map((ch) => (
              <div key={ch.id} className="flex justify-between items-center p-2.5 bg-zinc-950/40 border border-zinc-850/60 rounded-lg">
                <div>
                  <h5 className="text-xs font-semibold text-white flex items-center gap-1">
                    #{ch.name}
                  </h5>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{ch.members} members joined</p>
                </div>
                <span className="text-xs bg-slack-purple/10 border border-slack-purple/10 text-slack-purple font-mono px-2 py-0.5 rounded-full font-bold">
                  {ch.message_count} messages
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Active Users */}
        <div className="bg-zinc-900 border border-zinc-850 p-5 rounded-xl">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-slack-purple" />
            Engagement Leaderboard
          </h4>
          <div className="space-y-3">
            {stats.active_users.slice(0, 5).map((user) => (
              <div key={user.id} className="flex items-center justify-between p-2.5 bg-zinc-950/40 border border-zinc-850/60 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md overflow-hidden bg-zinc-850 border border-zinc-800 flex items-center justify-center">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      <Award className="w-4 h-4 text-slack-purple" />
                    )}
                  </div>
                  <div>
                    <h5 className="text-xs font-semibold text-white">{user.name}</h5>
                    <p className="text-[9px] text-zinc-500 font-mono">ID: {user.id}</p>
                  </div>
                </div>
                <span className="text-[11px] text-zinc-400 font-mono font-bold bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">
                  {user.message_count} posts
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Items List */}
        <div className="bg-zinc-900 border border-zinc-850 p-5 rounded-xl flex flex-col">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-slack-purple" />
            Open Action Items
          </h4>
          <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[220px] pr-1">
            {stats.open_action_items.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-zinc-600 text-center py-6">
                No open action items detected in cache.
              </div>
            ) : (
              stats.open_action_items.map((item, idx) => (
                <div key={idx} className="p-3 bg-zinc-950 rounded-lg border border-zinc-850 flex flex-col gap-1.5">
                  <div className="flex justify-between items-start">
                    <span className="text-[9px] text-slack-purple bg-slack-purple/10 border border-slack-purple/10 px-1.5 py-0.2 rounded font-bold uppercase">
                      #{item.channel_name}
                    </span>
                    <span className="text-[9px] text-zinc-500 font-mono">
                      {item.user_name}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 font-medium italic border-l-2 border-zinc-800 pl-2 leading-relaxed">
                    "{item.task}"
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

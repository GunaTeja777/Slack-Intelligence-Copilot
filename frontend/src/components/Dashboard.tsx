import React from 'react';
import { BarChart3, Users, MessageSquare, TrendingUp, ShieldAlert, Award, Hash, Heart, Crown } from 'lucide-react';

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
  sentiment_score: number;
  open_action_items: ActionItem[];
}

interface DashboardProps {
  stats: DashboardStats | null;
  loading: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({ stats, loading }) => {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 py-16 bg-zinc-950/40 border border-zinc-900/60 rounded-2xl">
        <div className="w-9 h-9 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-xs font-ui font-semibold text-zinc-400">Compiling workspace intelligence metrics...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 py-16 bg-zinc-950/40 border border-zinc-900/60 rounded-2xl text-center p-8">
        <BarChart3 className="w-12 h-12 text-zinc-800 mb-4 animate-pulse" />
        <p className="text-sm font-bold text-zinc-300 font-display">No Intelligence Data Loaded</p>
        <p className="text-xs text-zinc-550 mt-2 max-w-xs leading-relaxed font-ui">
          Click the <strong className="text-violet-400">Sync Now</strong> action in the sidebar to populate the cache and run analytics.
        </p>
      </div>
    );
  }

  const totalMessages = stats.active_channels.reduce((sum, ch) => sum + ch.message_count, 0);
  const totalChannels = stats.active_channels.length;
  const totalUsers = stats.active_users.length;
  
  const sentiment = stats.sentiment_score;
  const sentimentColor = sentiment > 65 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/15' 
                       : sentiment < 45 ? 'text-rose-400 bg-rose-500/10 border-rose-500/15'
                       : 'text-amber-400 bg-amber-500/10 border-amber-500/15';

  return (
    <div className="space-y-6 overflow-y-auto max-h-[82vh] pr-1.5 scrollbar-thin">
      
      {/* 4 Cards Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Card 1: Messages */}
        <div className="glass-card p-4.5 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-violet-500/10 rounded-xl text-violet-400 shadow-lg shadow-violet-500/5">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider font-display">Total Cached</p>
            <h4 className="text-base font-extrabold text-white mt-0.5 font-ui">{totalMessages} <span className="text-xs text-zinc-400 font-normal">posts</span></h4>
          </div>
        </div>

        {/* Card 2: Channels */}
        <div className="glass-card p-4.5 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 shadow-lg shadow-blue-500/5">
            <Hash className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider font-display">Active Channels</p>
            <h4 className="text-base font-extrabold text-white mt-0.5 font-ui">{totalChannels} <span className="text-xs text-zinc-400 font-normal">rooms</span></h4>
          </div>
        </div>

        {/* Card 3: Users */}
        <div className="glass-card p-4.5 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 shadow-lg shadow-emerald-500/5">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider font-display">Workspace Users</p>
            <h4 className="text-base font-extrabold text-white mt-0.5 font-ui">{totalUsers} <span className="text-xs text-zinc-400 font-normal">members</span></h4>
          </div>
        </div>

        {/* Card 4: Sentiment */}
        <div className="glass-card p-4.5 rounded-2xl flex items-center gap-4">
          <div className={`p-3 rounded-xl ${sentimentColor.split(' ')[1]} ${sentimentColor.split(' ')[0]} shadow-lg`}>
            <Heart className="w-5 h-5 fill-current" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider font-display">Team Sentiment</p>
            <h4 className="text-base font-extrabold text-white mt-0.5 font-ui">{sentiment}% <span className="text-xs text-zinc-400 font-normal">Positive</span></h4>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4">
        
        {/* Message Volume Trends */}
        <div className="bg-zinc-900/40 border border-zinc-900/60 p-5 rounded-2xl flex flex-col h-[280px] shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2 font-display">
              <BarChart3 className="w-4 h-4 text-violet-400" />
              Activity Volume Trends
            </h4>
            <span className="text-[9px] text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded-md border border-zinc-900 font-ui font-bold">Last 30 Days</span>
          </div>
          
          <div className="flex-1 flex items-end gap-2 pb-2 pt-4">
            {stats.message_volume.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-zinc-650 font-ui italic">
                No chronological logs available to track.
              </div>
            ) : (
              stats.message_volume.map((vol, idx) => {
                const maxCount = Math.max(...stats.message_volume.map(v => v.count), 1);
                const heightPercent = Math.max((vol.count / maxCount) * 100, 8);
                
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-1 bg-zinc-950 text-[10px] px-2 py-1 rounded-md border border-zinc-850 text-white font-mono opacity-0 group-hover:opacity-100 transition-all duration-250 pointer-events-none z-10 whitespace-nowrap shadow-xl">
                      {vol.count} msgs
                    </div>
                    {/* Bar */}
                    <div 
                      style={{ height: `${heightPercent}%` }} 
                      className="w-full bg-gradient-to-t from-violet-600/30 to-violet-500 rounded-t-md hover:from-violet-500 hover:to-fuchsia-500 transition-all duration-300 shadow shadow-violet-600/10 group-hover:scale-x-110"
                    ></div>
                    {/* Date label */}
                    <span className="text-[9px] text-zinc-600 mt-2 select-none font-mono">
                      {vol.date.substring(8, 10)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Trending Keywords / Topics */}
        <div className="bg-zinc-900/40 border border-zinc-900/60 p-5 rounded-2xl flex flex-col h-[280px] shadow-lg">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2 mb-4 font-display">
            <TrendingUp className="w-4 h-4 text-violet-400" />
            Trending Topic Clusters
          </h4>
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 scrollbar-thin">
            {stats.trending_topics.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-zinc-650 font-ui italic">
                No active conversations cached to extract clusters.
              </div>
            ) : (
              stats.trending_topics.map((item, idx) => {
                const maxFreq = Math.max(...stats.trending_topics.map(t => t.frequency), 1);
                const widthPercent = (item.frequency / maxFreq) * 100;
                
                return (
                  <div key={idx} className="space-y-1.5 font-ui">
                    <div className="flex justify-between text-xs items-center">
                      <span className="font-semibold text-zinc-300 flex items-center gap-2">
                        <span className="text-[9px] text-violet-400 bg-violet-500/10 border border-violet-500/10 px-2 py-0.5 rounded-md font-mono">#{idx+1}</span>
                        {item.topic}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono font-bold">{item.frequency} context matches</span>
                    </div>
                    <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-900">
                      <div 
                        style={{ width: `${widthPercent}%` }}
                        className="bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 h-full rounded-full"
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Breakdown Lists */}
      <div className="grid grid-cols-1 gap-4">
        
        {/* Active Channels breakdown */}
        <div className="bg-zinc-900/40 border border-zinc-900/60 p-5 rounded-2xl shadow-lg">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4 flex items-center gap-2 font-display">
            <Hash className="w-4 h-4 text-violet-400" />
            Channel Breakdown
          </h4>
          <div className="space-y-2.5">
            {stats.active_channels.map((ch) => (
              <div key={ch.id} className="flex justify-between items-center p-3 bg-zinc-950/30 border border-zinc-900/60 rounded-xl hover:border-zinc-800 transition-colors">
                <div>
                  <h5 className="text-xs font-bold text-white flex items-center gap-1 font-ui">
                    #{ch.name}
                  </h5>
                  <p className="text-[10px] text-zinc-550 mt-0.5 font-ui">{ch.members} members listening</p>
                </div>
                <span className="text-[10px] bg-violet-500/15 border border-violet-500/20 text-violet-300 font-mono px-3 py-0.5 rounded-full font-bold">
                  {ch.message_count} posts
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Engagement Leaderboard */}
        <div className="bg-zinc-900/40 border border-zinc-900/60 p-5 rounded-2xl shadow-lg">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4 flex items-center gap-2 font-display">
            <Crown className="w-4 h-4 text-violet-400 animate-pulse" />
            Engagement Leaderboard
          </h4>
          <div className="space-y-2.5">
            {stats.active_users.slice(0, 5).map((user, index) => {
              const ranks = [
                { color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', label: 'Gold' },
                { color: 'text-zinc-300 bg-zinc-500/10 border-zinc-500/20', label: 'Silver' },
                { color: 'text-amber-600 bg-amber-700/10 border-amber-700/20', label: 'Bronze' }
              ];
              const isRanked = index < 3;
              
              return (
                <div key={user.id} className="flex items-center justify-between p-3 bg-zinc-950/30 border border-zinc-900/60 rounded-xl hover:border-zinc-800 transition-all">
                  <div className="flex items-center gap-3">
                    {/* Rank Badge */}
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center font-mono text-[10px] font-bold border ${
                      isRanked ? ranks[index].color : 'text-zinc-500 bg-zinc-900 border-zinc-850'
                    }`}>
                      {index + 1}
                    </span>
                    
                    <div className="w-7 h-7 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-850 flex items-center justify-center relative shadow-sm">
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        <Award className="w-4 h-4 text-violet-400" />
                      )}
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-white font-ui">{user.name}</h5>
                      <p className="text-[9px] text-zinc-650 font-mono">ID: {user.id}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono font-bold bg-zinc-900 border border-zinc-850/80 px-2.5 py-0.5 rounded-lg">
                    {user.message_count} posts
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Items List */}
        <div className="bg-zinc-900/40 border border-zinc-900/60 p-5 rounded-2xl flex flex-col shadow-lg">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4 flex items-center gap-2 font-display">
            <ShieldAlert className="w-4 h-4 text-violet-400" />
            Open Action Items
          </h4>
          <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[220px] pr-1.5 scrollbar-thin">
            {stats.open_action_items.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-zinc-650 font-ui italic text-center py-8">
                No open action items detected in current indexed cache.
              </div>
            ) : (
              stats.open_action_items.map((item, idx) => (
                <div key={idx} className="p-3.5 bg-zinc-950/40 rounded-xl border border-zinc-900/60 flex flex-col gap-2 hover:border-zinc-850 transition-colors">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] text-violet-300 bg-violet-500/10 border border-violet-500/10 px-2 py-0.5 rounded font-bold uppercase font-mono">
                      #{item.channel_name}
                    </span>
                    <span className="text-[9px] text-zinc-550 font-ui font-semibold">
                      Assigned by: {item.user_name}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 font-ui font-medium italic border-l-2 border-violet-500 pl-3 leading-relaxed py-0.5">
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

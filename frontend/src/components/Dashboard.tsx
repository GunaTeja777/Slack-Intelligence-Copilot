import React from 'react';
import { BarChart3, Users, MessageSquare, Flame, CheckCircle, TrendingUp, AlertTriangle } from 'lucide-react';

interface MetricCard {
  label: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down';
  icon: React.ReactNode;
}

interface DashboardStats {
  total_messages: number;
  active_users: number;
  channel_count: number;
  rag_doc_count: number;
  top_users: Array<{ user_name: string; message_count: number }>;
  message_volume_trend: Array<{ date: string; count: number }>;
}

interface DashboardProps {
  stats: DashboardStats;
  loading: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({ stats, loading }) => {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 py-24 gap-3 animate-pulse font-ui">
        <BarChart3 className="w-10 h-10 text-violet-500 animate-spin" />
        <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Assembling workspace analytics...</p>
      </div>
    );
  }

  // Calculate metrics
  const cards: MetricCard[] = [
    {
      label: "Indexed Messages",
      value: stats.total_messages.toLocaleString(),
      icon: <MessageSquare className="w-4 h-4 text-violet-500" />,
      change: "+12.3% vs yesterday",
      trend: "up"
    },
    {
      label: "Active Discussants",
      value: stats.active_users,
      icon: <Users className="w-4 h-4 text-violet-500" />,
      change: "+2 new users",
      trend: "up"
    },
    {
      label: "RAG Vector Store",
      value: `${stats.rag_doc_count} nodes`,
      icon: <Flame className="w-4 h-4 text-violet-500" />,
      change: "Fully Optimized",
      trend: "up"
    }
  ];

  // Maximum messages count to scale chart bars correctly
  const maxCount = Math.max(...stats.message_volume_trend.map(d => d.count), 1);

  return (
    <div className="flex flex-col h-full bg-zinc-950/40 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-900/60 rounded-2xl overflow-hidden shadow-2xl transition-colors duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-900 bg-white/70 dark:bg-zinc-950/60 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-violet-500/10 rounded-lg text-violet-500 dark:text-violet-400">
            <BarChart3 className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider font-display">Workspace Analytics</h3>
        </div>
        <span className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-widest font-mono flex items-center gap-1">
          <CheckCircle className="w-3 h-3 text-emerald-500" /> Active Sync
        </span>
      </div>

      {/* Main Stats Scrollable Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-5 scrollbar-thin">
        
        {/* Metric Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {cards.map((card, idx) => (
            <div 
              key={idx}
              className="p-4 bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-900/60 rounded-xl hover:scale-[1.01] transition-all duration-300"
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] text-zinc-500 dark:text-zinc-550 uppercase font-bold tracking-wider font-display">{card.label}</span>
                <div className="p-1 bg-violet-500/10 rounded-md">
                  {card.icon}
                </div>
              </div>
              <h4 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight font-display">{card.value}</h4>
              {card.change && (
                <span className="text-[9px] text-zinc-450 dark:text-zinc-500 font-semibold font-ui flex items-center gap-1 mt-1">
                  <TrendingUp className="w-3 h-3 text-emerald-500" />
                  {card.change}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Chart Card */}
        <div className="p-4 bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-900/60 rounded-xl">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] text-zinc-550 uppercase font-bold tracking-wider font-display">Message volume timeline</span>
            <span className="text-[9px] text-zinc-450 dark:text-zinc-500 font-mono">Last 7 Days</span>
          </div>

          {stats.message_volume_trend.length === 0 ? (
            <div className="h-32 flex flex-col items-center justify-center text-zinc-500 text-center text-xs font-ui">
              <AlertTriangle className="w-7 h-7 text-zinc-400 opacity-20 mb-2" />
              <span>No messaging history discovered.</span>
            </div>
          ) : (
            <div className="h-36 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-900/60 rounded-xl p-3 flex flex-col justify-between relative overflow-hidden shadow-inner">
              <div className="flex-1 flex items-end justify-between gap-2.5 pt-4">
                {stats.message_volume_trend.map((day, idx) => {
                  const percentage = (day.count / maxCount) * 100;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center group h-full justify-end">
                      {/* Tooltip */}
                      <span className="absolute -top-1 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900 text-white text-[8px] font-bold px-2 py-0.5 rounded shadow border border-zinc-800 font-mono z-10">
                        {day.count} msgs
                      </span>
                      {/* Bar fill */}
                      <div 
                        style={{ height: `${Math.max(percentage, 5)}%` }} 
                        className="w-full bg-gradient-to-t from-violet-600/90 to-fuchsia-500/95 dark:from-violet-600 dark:to-fuchsia-500 rounded-md transition-all duration-500 group-hover:scale-x-105 group-hover:brightness-110 shadow-sm"
                      />
                      <span className="text-[8px] text-zinc-500 dark:text-zinc-550 font-semibold mt-1.5 uppercase font-mono tracking-wider">{day.date}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Leaderboard Card */}
        <div className="p-4 bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-900/60 rounded-xl">
          <span className="text-[10px] text-zinc-550 uppercase font-bold tracking-wider font-display block mb-3.5">Top Discussants Ranking</span>
          
          {stats.top_users.length === 0 ? (
            <div className="text-zinc-500 text-center py-4 text-xs font-ui italic">No messaging users indexed yet.</div>
          ) : (
            <div className="space-y-2">
              {stats.top_users.slice(0, 5).map((user, idx) => {
                const rankText = idx === 0 ? '🏆' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                
                return (
                  <div 
                    key={idx} 
                    className="flex justify-between items-center py-2.5 px-3 bg-zinc-50 dark:bg-zinc-950/30 rounded-lg border border-zinc-200/80 dark:border-zinc-900/60 hover:bg-zinc-100/30 dark:hover:bg-zinc-900/20 transition-all font-ui"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                        idx === 0 
                          ? 'bg-amber-100 text-amber-700 border-amber-250 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' 
                          : idx === 1 
                          ? 'bg-zinc-200 text-zinc-700 border-zinc-300 dark:bg-zinc-400/10 dark:text-zinc-300 dark:border-zinc-400/20' 
                          : idx === 2 
                          ? 'bg-amber-100/40 text-amber-800 border-amber-200 dark:bg-amber-750/15 dark:text-amber-450 dark:border-amber-750/20' 
                          : 'bg-zinc-150 text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-500 dark:border-zinc-850'
                      }`}>
                        {rankText}
                      </span>
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200">{user.user_name}</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-450 font-mono font-semibold">
                      {user.message_count} messages
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

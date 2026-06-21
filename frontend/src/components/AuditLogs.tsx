import React from 'react';
import { Shield, Clock, HardDrive, CheckCircle } from 'lucide-react';

interface AuditLogEntry {
  id: number;
  timestamp: string;
  action: string;
  details: string;
}

interface AuditLogsProps {
  logs: AuditLogEntry[];
  onClear?: () => void;
}

export const AuditLogs: React.FC<AuditLogsProps> = ({ logs }) => {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-900/60 rounded-2xl overflow-hidden shadow-2xl transition-colors duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-900 bg-zinc-50 dark:bg-zinc-950/60">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-violet-500/10 rounded-lg text-violet-500 dark:text-violet-400">
            <Shield className="w-4 h-4 text-violet-550 dark:text-violet-400 animate-pulse" />
          </div>
          <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider font-display">Security Audit Log</h3>
        </div>
        <span className="text-[9px] bg-violet-500/10 text-violet-600 dark:text-violet-300 border border-violet-500/15 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-widest font-mono">
          Immutable Trail
        </span>
      </div>

      {/* Logs Scroll Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 max-h-[400px] scrollbar-thin">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-500 text-center font-ui">
            <Shield className="w-10 h-10 opacity-15 mb-3 text-zinc-400 dark:text-zinc-650" />
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-450">No write executions recorded.</p>
            <p className="text-[10px] opacity-70 mt-1 max-w-[200px] leading-normal">
              Actions like posting Slack messages will appear here once approved.
            </p>
          </div>
        ) : (
          logs.map((log) => {
            const isConfirmed = log.action === 'WRITE_CONFIRMED';
            const isExecuted = log.action === 'WRITE_EXECUTED';
            
            return (
              <div 
                key={log.id} 
                className="p-3.5 bg-zinc-50/50 dark:bg-zinc-950/50 rounded-xl border border-zinc-200/80 dark:border-zinc-900/80 hover:border-zinc-300 dark:hover:border-zinc-850 transition-colors flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300"
              >
                <div className="flex justify-between items-center font-ui">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border font-mono ${
                    isConfirmed 
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25 dark:border-amber-500/20' 
                      : isExecuted 
                      ? 'bg-emerald-500/10 text-emerald-650 dark:text-emerald-400 border-emerald-500/25 dark:border-emerald-500/20' 
                      : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'
                  }`}>
                    {log.action}
                  </span>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5 font-medium">
                    <Clock className="w-3 h-3 text-zinc-400 dark:text-zinc-650" />
                    {log.timestamp}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-700 dark:text-zinc-350 font-mono leading-relaxed bg-zinc-100 dark:bg-[#0b0c10] p-3 rounded-lg border border-zinc-200 dark:border-zinc-900/60 overflow-x-auto whitespace-pre-wrap">
                  {log.details}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 border-t border-zinc-200 dark:border-zinc-900 flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-550 font-ui transition-colors">
        <span className="flex items-center gap-1.5">
          <HardDrive className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-600" />
          Active SQLite Engine
        </span>
        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-450 font-semibold">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-650 dark:text-emerald-500" /> Validated Vault
        </span>
      </div>
    </div>
  );
};

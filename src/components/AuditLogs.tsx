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
    <div className="flex flex-col h-full bg-zinc-900 border border-zinc-850 rounded-xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-850 bg-zinc-950/40">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-slack-purple" />
          <h3 className="text-sm font-semibold text-white">Secure Security Audit Log</h3>
        </div>
        <span className="text-[10px] bg-slack-purple/20 text-slack-purple border border-slack-purple/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
          Read-Only Trail
        </span>
      </div>

      {/* Logs Scroll Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-2.5 max-h-[400px]">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-500 text-center">
            <Shield className="w-8 h-8 opacity-20 mb-2" />
            <p className="text-xs">No write executions recorded yet.</p>
            <p className="text-[10px] opacity-70 mt-1">Actions like posting messages will appear here once approved.</p>
          </div>
        ) : (
          logs.map((log) => {
            const isConfirmed = log.action === 'WRITE_CONFIRMED';
            const isExecuted = log.action === 'WRITE_EXECUTED';
            
            return (
              <div 
                key={log.id} 
                className="p-3 bg-zinc-950 rounded-lg border border-zinc-850 flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-200"
              >
                <div className="flex justify-between items-center">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    isConfirmed 
                      ? 'bg-amber-400/10 text-amber-400 border border-amber-400/15' 
                      : isExecuted 
                      ? 'bg-green-500/10 text-green-400 border border-green-500/15' 
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                  }`}>
                    {log.action}
                  </span>
                  <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {log.timestamp}
                  </span>
                </div>
                <div className="text-xs text-zinc-300 font-mono leading-relaxed bg-zinc-900/60 p-2 rounded border border-zinc-900 overflow-x-auto whitespace-pre-wrap">
                  {log.details}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-3 bg-zinc-950/20 border-t border-zinc-850 flex items-center justify-between text-[10px] text-zinc-500">
        <span className="flex items-center gap-1">
          <HardDrive className="w-3.5 h-3.5 text-zinc-600" />
          Stored in sqlite
        </span>
        <span className="flex items-center gap-1 text-green-500/80 font-medium">
          <CheckCircle className="w-3 h-3" /> Immutable crypt-safe trail
        </span>
      </div>
    </div>
  );
};

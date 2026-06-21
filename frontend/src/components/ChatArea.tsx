import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Copy, Check, CheckCircle2, ChevronDown, ChevronUp, RefreshCw, ShieldAlert } from 'lucide-react';

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

interface ChatAreaProps {
  messages: Message[];
  loading: boolean;
  onSendMessage: (text: string) => void;
  onConfirmAction: (tool: string, args: any) => Promise<void>;
  onCancelAction: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({ 
  messages, 
  loading, 
  onSendMessage, 
  onConfirmAction, 
  onCancelAction 
}) => {
  const [input, setInput] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Custom edit text state for confirmation previews
  const [editingText, setEditingText] = useState<string>('');
  const [confirmingIdx, setConfirmingIdx] = useState<number | null>(null);

  const scrollBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollBottom();
  }, [messages, loading]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const toggleStep = (messageIdx: number, stepIdx: number) => {
    const key = `${messageIdx}-${stepIdx}`;
    setExpandedSteps(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleConfirmSubmit = async (tool: string, originalArgs: any, idx: number) => {
    const finalArgs = { ...originalArgs };
    if (editingText) {
      finalArgs.text = editingText;
    }
    
    setConfirmingIdx(idx);
    try {
      await onConfirmAction(tool, finalArgs);
      setEditingText('');
    } finally {
      setConfirmingIdx(null);
    }
  };

  // Pre-configured query suggestions
  const suggestions = [
    { label: "Summarize channel discussions", text: "Summarize the discussions in #general" },
    { label: "Find action items", text: "Find action items and who is responsible for them" },
    { label: "Detect blockers & risks", text: "Detect decisions and blockers in recent channel history" },
    { label: "Analyze sentiment", text: "Analyze the team sentiment in #general" },
    { label: "Post a deployment update", text: "Send a message to #general saying: 'Post deployment update: Version 1.2.0 is live! All tests passed.'" }
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-900/80 rounded-2xl overflow-hidden shadow-xl dark:shadow-2xl relative transition-colors duration-300">
      
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 sm:p-8 max-w-xl mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center mb-6 text-white shadow-lg shadow-violet-500/10 animate-bounce">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2 font-display">Welcome to Slack Intelligence Copilot</h3>
            <p className="text-xs text-zinc-500 leading-relaxed mb-8 max-w-sm font-ui">
              I can analyze channel history, search logs, cluster topics, track decisions, and draft posts—acting as a secure intelligence layer for your team.
            </p>
            <div className="flex flex-col gap-2.5 w-full">
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-bold font-display">Suggested Prompts</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {suggestions.map((sug, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInput(sug.text)}
                    className="p-3.5 text-left bg-zinc-100 hover:bg-zinc-200/60 dark:bg-zinc-900/30 dark:hover:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-900/60 rounded-xl text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:border-violet-500/30 dark:hover:border-violet-500/30 hover-glow-purple transition-all duration-300 font-ui text-ellipsis overflow-hidden whitespace-nowrap"
                  >
                    {sug.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg, msgIdx) => {
            const isUser = msg.role === 'user';
            
            return (
              <div 
                key={msgIdx} 
                className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-3 duration-300`}
              >
                {/* User Message / Assistant Card */}
                <div className={`flex gap-3 max-w-[90%] sm:max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shrink-0 border transition-all ${
                    isUser 
                      ? 'bg-zinc-200 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold' 
                      : 'bg-gradient-to-tr from-violet-600/10 to-fuchsia-600/10 border-violet-500/20 text-violet-600 dark:text-violet-400 font-bold'
                  }`}>
                    {isUser ? 'U' : <Sparkles className="w-4.5 h-4.5" />}
                  </div>

                  {/* Bubble */}
                  <div className="flex flex-col gap-2">
                    <div className={`p-4 rounded-2xl ${
                      isUser 
                        ? 'bg-violet-600 dark:bg-violet-900/15 text-white dark:text-slate-100 border border-transparent dark:border-violet-500/25 shadow-sm rounded-tr-none shadow-violet-600/5' 
                        : 'bg-zinc-100 dark:bg-zinc-900/55 text-zinc-800 dark:text-slate-200 border border-zinc-200/80 dark:border-zinc-800/80 shadow-md rounded-tl-none backdrop-blur-sm'
                    }`}>
                      
                      {/* Message Content */}
                      <div className="text-sm leading-relaxed whitespace-pre-wrap font-ui font-medium">
                        {msg.content}
                      </div>

                      {/* Display Thoughts (Collapsible/Status) */}
                      {!isUser && msg.thoughts && msg.thoughts.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-zinc-300 dark:border-zinc-950 space-y-2 bg-zinc-200/40 dark:bg-[#0a0c10] p-3.5 rounded-xl border border-zinc-300 dark:border-zinc-900/60 shadow-inner">
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2 font-display">
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 dark:bg-violet-400 animate-pulse"></span>
                            Reasoning thoughts ({msg.thoughts.length})
                          </p>
                          <div className="text-[11px] text-zinc-600 dark:text-zinc-400 font-mono space-y-1.5 pl-2.5 border-l-2 border-violet-500/30 dark:border-violet-500/20 leading-relaxed max-h-[140px] overflow-y-auto">
                            {msg.thoughts.map((th, thIdx) => (
                              <div key={thIdx} className="opacity-95">{th}</div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Display Tool Executions */}
                      {!isUser && msg.steps && msg.steps.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-display">
                            MCP Tool Call pipeline
                          </p>
                          <div className="space-y-2">
                            {msg.steps.map((step, stepIdx) => {
                              const stepKey = `${msgIdx}-${stepIdx}`;
                              const isExpanded = expandedSteps[stepKey];
                              const isPending = step.status === 'pending_confirmation';
                              const isCompleted = step.status === 'completed';
                              
                              return (
                                <div key={stepIdx} className="bg-white dark:bg-zinc-950/40 rounded-xl border border-zinc-200 dark:border-zinc-900/60 overflow-hidden text-xs transition-all hover:border-zinc-300 dark:hover:border-zinc-800">
                                  <button
                                    onClick={() => toggleStep(msgIdx, stepIdx)}
                                    className="w-full flex justify-between items-center px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950/70 hover:bg-zinc-100 dark:hover:bg-zinc-900/40 transition-colors"
                                  >
                                    <span className="font-mono text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                                      <span className="w-2 h-2 rounded-full relative flex">
                                        {isPending ? (
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                        ) : null}
                                        <span className={`relative inline-flex rounded-full h-2 w-2 ${
                                          isPending ? 'bg-amber-500' : isCompleted ? 'bg-emerald-500' : 'bg-rose-500'
                                        }`}></span>
                                      </span>
                                      {step.tool}
                                    </span>
                                    <div className="flex items-center gap-2 font-ui">
                                      <span className={`text-[10px] uppercase font-bold tracking-wider font-mono ${
                                        isPending ? 'text-amber-600 dark:text-amber-400' : isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                      }`}>{step.status}</span>
                                      {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-400 dark:text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />}
                                    </div>
                                  </button>
                                  {isExpanded && (
                                    <div className="p-4 border-t border-zinc-200 dark:border-zinc-900 bg-zinc-50 dark:bg-zinc-950 font-mono text-[10px] space-y-3.5">
                                      <div>
                                        <span className="text-zinc-500 dark:text-zinc-500 font-bold block mb-1 uppercase tracking-wider text-[9px]">Arguments:</span>
                                        <pre className="bg-white dark:bg-[#0b0c10] p-3 rounded-lg text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-900 overflow-x-auto">{JSON.stringify(step.arguments, null, 2)}</pre>
                                      </div>
                                      {step.result && (
                                        <div>
                                          <span className="text-zinc-500 dark:text-zinc-550 font-bold block mb-1 uppercase tracking-wider text-[9px]">Result Payload:</span>
                                          <pre className="bg-white dark:bg-[#0b0c10] p-3 rounded-lg text-zinc-650 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-905 overflow-x-auto max-h-[160px] overflow-y-auto">{JSON.stringify(step.result, null, 2)}</pre>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}                      {/* Display Pending Confirmation Banner */}
                      {!isUser && msg.pendingConfirmation && (
                        <div className="mt-4 p-4 bg-amber-500/5 border border-amber-500/25 dark:border-amber-500/20 rounded-2xl space-y-4 animate-in zoom-in-95 duration-300">
                          <div className="flex items-start gap-3">
                            <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400 shrink-0">
                              <ShieldAlert className="w-5 h-5 animate-pulse" />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest font-display">Confirm Outbound Message Posting</h4>
                              <p className="text-[10px] text-zinc-500 mt-1 font-ui leading-normal">
                                Security Gateway Verification Required. Verify target details and refine message text.
                              </p>
                            </div>
                          </div>
 
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3 text-[10px]">
                              <div>
                                <span className="text-zinc-500 dark:text-zinc-500 block uppercase font-bold font-display tracking-wider">Target Channel</span>
                                <span className="font-mono text-zinc-700 dark:text-zinc-350 bg-white dark:bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-900 block mt-1">{msg.pendingConfirmation.preview.channel_id}</span>
                              </div>
                              {msg.pendingConfirmation.preview.thread_ts && (
                                <div>
                                  <span className="text-zinc-500 dark:text-zinc-500 block uppercase font-bold font-display tracking-wider">Thread TS</span>
                                  <span className="font-mono text-zinc-700 dark:text-zinc-350 bg-white dark:bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-900 block mt-1">{msg.pendingConfirmation.preview.thread_ts}</span>
                                </div>
                              )}
                            </div>
 
                            <div>
                              <span className="text-zinc-500 dark:text-zinc-500 block uppercase font-bold text-[10px] font-display tracking-wider mb-1">Message Body</span>
                              <textarea
                                value={editingText === '' ? msg.pendingConfirmation.preview.text : editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                rows={4}
                                className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl p-3 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 font-ui leading-relaxed"
                              />
                            </div>
                          </div>

                          <div className="flex gap-2.5 justify-end">
                            <button
                              onClick={onCancelAction}
                              className="px-3.5 py-2 text-[11px] text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white bg-zinc-100 hover:bg-zinc-200/60 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-colors font-medium font-ui"
                            >
                              Reject & Cancel
                            </button>
                            <button
                              onClick={() => handleConfirmSubmit(
                                msg.pendingConfirmation!.tool, 
                                msg.pendingConfirmation!.arguments,
                                msgIdx
                              )}
                              disabled={confirmingIdx === msgIdx}
                              className="px-4.5 py-2 text-[11px] text-white dark:text-zinc-950 bg-amber-500 hover:bg-amber-600 dark:bg-amber-400 dark:hover:bg-amber-500 disabled:opacity-50 transition-all rounded-xl font-bold flex items-center gap-1.5 shadow-lg shadow-amber-500/10 font-ui hover:scale-[1.02] duration-200 cursor-pointer"
                            >
                              {confirmingIdx === msgIdx ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  Posting...
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-4 h-4" />
                                  Approve & Post to Slack
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Copy/Export Panel */}
                    {!isUser && !msg.pendingConfirmation && (
                      <div className="flex items-center gap-2 pl-2">
                        <button
                          onClick={() => handleCopy(msg.content, msgIdx)}
                          className="text-zinc-450 hover:text-zinc-700 dark:text-zinc-550 dark:hover:text-white transition-colors p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 flex items-center gap-1 text-[10px] font-ui"
                        >
                          {copiedIndex === msgIdx ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Loading Spinner for Streaming Answer */}
        {loading && (
          <div className="flex gap-4 justify-start animate-pulse">
            <div className="w-8 h-8 rounded-lg bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-500 dark:text-violet-400">
              <Sparkles className="w-4.5 h-4.5 animate-spin" />
            </div>
            <div className="bg-zinc-100 dark:bg-zinc-900/60 p-4.5 rounded-2xl border border-zinc-200 dark:border-zinc-800/60 max-w-[80%]">
              <div className="flex gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-500/50 animate-bounce"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-violet-500/50 animate-bounce delay-100"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-violet-500/50 animate-bounce delay-200"></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <form onSubmit={handleSend} className="p-4 border-t border-zinc-200 dark:border-zinc-900/60 bg-zinc-50 dark:bg-zinc-950/20">
        <div className="flex gap-3 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 focus-within:border-violet-500 focus-within:dark:border-violet-500/40 rounded-xl px-4 py-3 transition-all duration-300 focus-within:shadow-md focus-within:dark:shadow-violet-500/5">
          <input
            type="text"
            placeholder="Ask Slack Intelligence Copilot... (e.g. Summarize recent decisions in #general)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none disabled:opacity-50 font-ui"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2 text-white bg-violet-600 hover:bg-violet-500 dark:bg-violet-600 dark:hover:bg-violet-500 hover:scale-105 active:scale-95 transition-all duration-200 rounded-lg disabled:opacity-20 shadow-md shadow-violet-600/10 dark:shadow-violet-500/25 flex items-center justify-center cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>

    </div>
  );
};

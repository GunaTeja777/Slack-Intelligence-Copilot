import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Copy, Check, CheckCircle2, ChevronDown, ChevronUp, RefreshCw, MessageSquare } from 'lucide-react';

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
    // Override the text parameter if the user edited it
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
    { label: "Summarize channel #all-essane-ai", text: "Summarize the discussions in #all-essane-ai" },
    { label: "Find open action items", text: "Find action items and who is responsible for them" },
    { label: "Detect blockers & risks", text: "Detect decisions and blockers in recent channel history" },
    { label: "Analyze sentiment in #social", text: "Analyze the team sentiment in #social" },
    { label: "Post a deployment update to #social", text: "Send a message to #social saying: 'Post deployment update: Version 1.2.0 is live! All tests passed.'" }
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-900 border border-zinc-850 rounded-xl overflow-hidden shadow-lg relative">
      
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-slack-purple/10 flex items-center justify-center mb-4 text-slack-purple animate-pulse">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Welcome to Slack Intelligence Copilot</h3>
            <p className="text-xs text-zinc-500 leading-relaxed mb-6">
              I can analyze channel history, search Slack logs, semantic-cluster trending topics, track decisions, and draft posts—acting as a secure intelligence wrapper for your team.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full">
              {suggestions.map((sug, idx) => (
                <button
                  key={idx}
                  onClick={() => setInput(sug.text)}
                  className="p-3 text-left bg-zinc-950 border border-zinc-850 rounded-lg text-xs text-zinc-400 hover:text-white hover:border-slack-purple/35 transition-all text-ellipsis overflow-hidden whitespace-nowrap"
                >
                  {sug.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, msgIdx) => {
            const isUser = msg.role === 'user';
            
            return (
              <div 
                key={msgIdx} 
                className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-200`}
              >
                {/* User Message / Assistant Card */}
                <div className={`flex gap-3 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shrink-0 border ${
                    isUser 
                      ? 'bg-zinc-850 border-zinc-850 text-zinc-400' 
                      : 'bg-slack-purple/20 border-slack-purple/20 text-slack-purple font-bold'
                  }`}>
                    {isUser ? 'U' : <Sparkles className="w-4 h-4" />}
                  </div>

                  {/* Bubble */}
                  <div className="flex flex-col gap-2">
                    <div className={`p-4 rounded-xl ${
                      isUser 
                        ? 'bg-slack-purple/10 text-slate-100 border border-slack-purple/20 shadow-sm' 
                        : 'bg-zinc-950 text-slate-200 border border-zinc-850/80 shadow-md'
                    }`}>
                      
                      {/* Message Content */}
                      <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans">
                        {msg.content}
                      </div>

                      {/* Display Thoughts (Collapsible/Status) */}
                      {!isUser && msg.thoughts && msg.thoughts.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-zinc-900 space-y-1 bg-zinc-900/40 p-2.5 rounded-lg border border-zinc-900">
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                            <RefreshCw className="w-3 h-3 animate-spin" /> Reasoning steps ({msg.thoughts.length})
                          </p>
                          <div className="text-[11px] text-zinc-400 font-mono space-y-1.5 mt-1.5 pl-1 border-l border-slack-purple/30">
                            {msg.thoughts.map((th, thIdx) => (
                              <div key={thIdx}>{th}</div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Display Tool Executions */}
                      {!isUser && msg.steps && msg.steps.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                            MCP Tool Calls Executed
                          </p>
                          <div className="space-y-1.5">
                            {msg.steps.map((step, stepIdx) => {
                              const stepKey = `${msgIdx}-${stepIdx}`;
                              const isExpanded = expandedSteps[stepKey];
                              const isPending = step.status === 'pending_confirmation';
                              const isCompleted = step.status === 'completed';
                              
                              return (
                                <div key={stepIdx} className="bg-zinc-900/50 rounded-lg border border-zinc-850 overflow-hidden text-xs">
                                  <button
                                    onClick={() => toggleStep(msgIdx, stepIdx)}
                                    className="w-full flex justify-between items-center px-3 py-2 bg-zinc-900 hover:bg-zinc-850/50 transition-colors"
                                  >
                                    <span className="font-mono text-zinc-300 flex items-center gap-1.5">
                                      <span className={`w-2 h-2 rounded-full ${
                                        isPending ? 'bg-amber-400 animate-ping' : isCompleted ? 'bg-green-500' : 'bg-red-500'
                                      }`}></span>
                                      {step.tool}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] text-zinc-500 uppercase font-mono">{step.status}</span>
                                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </div>
                                  </button>
                                  {isExpanded && (
                                    <div className="p-3 border-t border-zinc-850 bg-zinc-950 font-mono text-[10px] space-y-2">
                                      <div>
                                        <span className="text-zinc-500 font-semibold block">Arguments:</span>
                                        <pre className="bg-zinc-900 p-2 rounded text-zinc-400 overflow-x-auto">{JSON.stringify(step.arguments, null, 2)}</pre>
                                      </div>
                                      {step.result && (
                                        <div>
                                          <span className="text-zinc-500 font-semibold block">Result:</span>
                                          <pre className="bg-zinc-900 p-2 rounded text-zinc-400 overflow-x-auto max-h-[150px] overflow-y-auto">{JSON.stringify(step.result, null, 2)}</pre>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Display Pending Confirmation Banner */}
                      {!isUser && msg.pendingConfirmation && (
                        <div className="mt-4 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-4 animate-in zoom-in-95 duration-200">
                          <div className="flex items-start gap-2.5">
                            <MessageSquare className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Confirm Outbound Message Posting</h4>
                              <p className="text-[10px] text-zinc-500 mt-0.5">
                                Security Check: An AI wants to post to a Slack channel. Verify target details and refine message text.
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2.5">
                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                              <div>
                                <span className="text-zinc-500 block uppercase font-bold">Target Channel ID</span>
                                <span className="font-mono text-zinc-300 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-850 block mt-0.5">{msg.pendingConfirmation.preview.channel_id}</span>
                              </div>
                              {msg.pendingConfirmation.preview.thread_ts && (
                                <div>
                                  <span className="text-zinc-500 block uppercase font-bold">Thread Reference</span>
                                  <span className="font-mono text-zinc-300 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-850 block mt-0.5">{msg.pendingConfirmation.preview.thread_ts}</span>
                                </div>
                              )}
                            </div>

                            <div>
                              <span className="text-zinc-500 block uppercase font-bold text-[10px] mb-1">Message Body</span>
                              <textarea
                                value={editingText === '' ? msg.pendingConfirmation.preview.text : editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                rows={3}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                              />
                            </div>
                          </div>

                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={onCancelAction}
                              className="px-3 py-1.5 text-[11px] text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded-lg transition-colors font-medium"
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
                              className="px-4 py-1.5 text-[11px] text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 transition-colors rounded-lg font-bold flex items-center gap-1.5 shadow shadow-amber-500/10"
                            >
                              {confirmingIdx === msgIdx ? (
                                <>
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  Posting...
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
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
                          className="text-zinc-500 hover:text-white transition-colors p-1 rounded hover:bg-zinc-800 flex items-center gap-1 text-[10px]"
                        >
                          {copiedIndex === msgIdx ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-green-500" />
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
            <div className="w-8 h-8 rounded-lg bg-slack-purple/20 border border-slack-purple/20 flex items-center justify-center text-slack-purple">
              <Sparkles className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850/80 max-w-[80%]">
              <div className="flex gap-2">
                <span className="w-2 h-2 rounded-full bg-zinc-600 animate-bounce"></span>
                <span className="w-2 h-2 rounded-full bg-zinc-600 animate-bounce delay-100"></span>
                <span className="w-2 h-2 rounded-full bg-zinc-600 animate-bounce delay-200"></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <form onSubmit={handleSend} className="p-4 border-t border-zinc-850 bg-zinc-950/40">
        <div className="flex gap-3 bg-zinc-950 border border-zinc-850 focus-within:border-slack-purple/50 rounded-xl px-3.5 py-2.5 transition-all">
          <input
            type="text"
            placeholder="Ask Slack Intelligence Copilot (e.g. Summarize channel #general)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-1.5 text-white bg-slack-purple hover:bg-slack-purple/90 transition-colors rounded-lg disabled:opacity-20"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>

    </div>
  );
};

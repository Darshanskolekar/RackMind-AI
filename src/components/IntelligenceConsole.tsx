import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Terminal, 
  Send, 
  Bot, 
  User, 
  X, 
  Sparkles, 
  BookOpen, 
  Server,
  Shield,
  History,
  Plus,
  Clock,
  MessageSquare,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { useTelemetry } from '../context/TelemetryContext';
import { useAuth } from '../context/AuthContext';
import { 
  CopilotSession, 
  CopilotChatMessage,
  listenToCopilotSessions, 
  saveCopilotSession, 
  generateAutoTitle 
} from '../services/firestoreService';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

interface IntelligenceConsoleProps {
  isOpen: boolean;
  onClose: () => void;
}

// Markdown formatter helper for chat responses
function renderMarkdown(text: string) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 font-sans leading-relaxed text-xs">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className="font-bold text-sm text-cyan-300 mt-2 mb-1 flex items-center gap-1.5 font-mono">
              <span>{trimmed.replace('### ', '')}</span>
            </h4>
          );
        }
        if (trimmed.startsWith('- ')) {
          const content = trimmed.substring(2);
          return (
            <div key={idx} className="flex items-start gap-1.5 ml-2 text-slate-200">
              <span className="text-cyan-400 mt-1 text-[8px]">&bull;</span>
              <span>{renderFormattedInline(content)}</span>
            </div>
          );
        }
        if (trimmed.startsWith('* ') && !trimmed.startsWith('**')) {
          const content = trimmed.substring(2);
          return (
            <div key={idx} className="flex items-start gap-1.5 ml-2 text-slate-200">
              <span className="text-cyan-400 mt-1 text-[8px]">&bull;</span>
              <span>{renderFormattedInline(content)}</span>
            </div>
          );
        }
        if (trimmed.length === 0) {
          return <div key={idx} className="h-1" />;
        }
        return (
          <p key={idx} className="text-slate-200">
            {renderFormattedInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

function renderFormattedInline(str: string): React.ReactNode {
  const parts = str.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
      return (
        <em key={i} className="italic text-cyan-200">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}

function getInitialGreeting(isProd: boolean, activeRackId: string): ChatMessage {
  return {
    id: 'init-1',
    sender: 'assistant',
    text: isProd 
      ? `### Capacity Planning & Facility SRE Agent Online (LIVE PRODUCTION)
- **Environment**: 🟢 **LIVE PRODUCTION (IMMUTABLE)**
- **Active Focus**: **${activeRackId.toUpperCase()}**
- **SRE Mandate**: Infrastructure capacity planning, breaker headroom audits, and ASHRAE W4 thermal efficiency.
- **Hardware Profile**: 
  - Dell PowerEdge XE9680 (8x NVIDIA H100) requires **6 continuous vertical rack units (6U)** and ~5.8 kW peak.
  - NVIDIA Vera Rubin NVL72 Liquid-Cooled Pod rated for **230 kW** (100% Direct Liquid Cooling).

Ask me about adding new hardware, branch circuit breaker limits, or datacenter PUE efficiency.`
      : `### Thermal & Remediation TwinOps Specialist Online (SIMULATION SANDBOX)
- **Environment**: 🟠 **SIMULATED SHADOW TWIN (ISOLATED)**
- **Active Focus**: **${activeRackId.toUpperCase()}**
- **Chaos Mandate**: Anomaly diagnosis, stress-testing slider physics analysis, and autonomous remediation.
- **RAG Manuals**: Vertiv Liebert CRV (Sec 4.2), Dell XE9680 Technical Guide (Page 58), NVIDIA NVL72 Spec (Page 28), Cisco Nexus 9000 (Page 42).

Ready to analyze injected chaos faults, create P1 incident tickets, or propose [Execute Power Cap Mitigation] directives.`,
    timestamp: new Date().toLocaleTimeString(),
  };
}

export const IntelligenceConsole: React.FC<IntelligenceConsoleProps> = ({
  isOpen,
  onClose,
}) => {
  const { environment, activeRackId, sendCopilotStreamQuery } = useTelemetry();
  const { currentUser } = useAuth();

  const isProd = environment === 'production';
  const personaIdentifier = currentUser ? (currentUser.roleTitle || currentUser.id) : 'Lead Infrastructure SRE';

  // Active session tracking
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => `sess-${Date.now()}`);
  const [currentSessionTitle, setCurrentSessionTitle] = useState<string>('New Triage Thread');
  const [showHistorySidebar, setShowHistorySidebar] = useState<boolean>(false);
  const [historicalSessions, setHistoricalSessions] = useState<CopilotSession[]>([]);
  
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    getInitialGreeting(isProd, activeRackId)
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-expand textarea based on content up to max-height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  // Handle Enter (submit) vs Shift + Enter (newline)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Shift + Enter automatically falls through to default behavior, inserting a newline
  };

  // Real-time Firestore synchronization for previous sessions filtered strictly by active user persona
  useEffect(() => {
    if (!personaIdentifier) return;
    const unsubscribe = listenToCopilotSessions(personaIdentifier, (sessions) => {
      setHistoricalSessions(sessions);
    });
    return () => unsubscribe();
  }, [personaIdentifier]);

  // Quick query suggestions
  const quickQueries = isProd ? [
    'Can we install another Dell PowerEdge XE9680 in Rack A01 without tripping PDU limits?',
    'What is our current thermal headroom and facility PUE efficiency?',
    'Audit 3-phase power balance across Rack A01 and Rack B01',
    'What continuous vertical rack space (U) is available in Rack A01?',
  ] : [
    'Create an incident ticket for srv-rack-a01-u34 overheating excursion',
    'Diagnose active thermal excursions in the Sandbox Shadow Twin',
    'What happens when GPU load is stressed to 99% on Dell XE9680?',
    'Explain coolant pressure drop remediation using Vertiv Manual Sec 4.2',
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Create a fresh triage session thread
  const handleNewSession = useCallback(() => {
    const newId = `sess-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setCurrentSessionId(newId);
    setCurrentSessionTitle('New Triage Thread');
    setMessages([getInitialGreeting(isProd, activeRackId)]);
    setShowHistorySidebar(false);
  }, [isProd, activeRackId]);

  // Resume a previous session from Firestore
  const handleLoadSession = useCallback((session: CopilotSession) => {
    setCurrentSessionId(session.session_id);
    setCurrentSessionTitle(session.title || 'Previous Triage Session');

    // Populate active chat window with messages array from Firestore
    if (session.messages && session.messages.length > 0) {
      const loadedMsgs: ChatMessage[] = session.messages.map((m, idx) => ({
        id: `hist-${idx}-${Date.now()}`,
        sender: m.role === 'user' ? 'user' : 'assistant',
        text: m.content,
        timestamp: m.timestamp || new Date().toLocaleTimeString(),
      }));
      setMessages(loadedMsgs);
    } else {
      setMessages([getInitialGreeting(isProd, activeRackId)]);
    }

    setShowHistorySidebar(false);
  }, [isProd, activeRackId]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString(),
    };

    const botMsgId = `msg-resp-${Date.now()}`;
    const botInitialMsg: ChatMessage = {
      id: botMsgId,
      sender: 'assistant',
      text: '',
      timestamp: new Date().toLocaleTimeString(),
    };

    const isFirstUserMessage = messages.filter((m) => m.sender === 'user').length === 0;

    const updatedMsgList = [...messages, userMsg, botInitialMsg];
    setMessages(updatedMsgList);
    setInputValue('');
    setLoading(true);

    // Context format for multi-turn Gemini conversation continuation
    const chatHistoryPayload = messages
      .filter((m) => m.id !== 'init-1')
      .map((m) => ({
        role: m.sender === 'user' ? ('user' as const) : ('model' as const),
        content: m.text,
      }));

    try {
      let finalAccumulatedText = '';
      const userInfo = {
        name: currentUser?.name || 'Darshan Skolekar',
        role: currentUser?.roleTitle || 'Lead Infrastructure SRE',
        attribution: currentUser ? `${currentUser.name} (${currentUser.roleTitle})` : 'Darshan (Lead SRE)',
      };

      await sendCopilotStreamQuery(
        text, 
        (accumulated) => {
          finalAccumulatedText = accumulated;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === botMsgId ? { ...msg, text: accumulated } : msg
            )
          );
        },
        chatHistoryPayload,
        userInfo
      );

      // Asynchronously trigger lightweight background title generation on first message
      let sessionTitleToSave = currentSessionTitle;
      if (isFirstUserMessage) {
        generateAutoTitle(text)
          .then((generatedTitle) => {
            if (generatedTitle) {
              setCurrentSessionTitle(generatedTitle);
              saveCopilotSession({
                session_id: currentSessionId,
                user_persona: personaIdentifier,
                title: generatedTitle,
                updated_at: new Date().toISOString(),
                messages: [
                  ...messages.filter((m) => m.id !== 'init-1'),
                  userMsg,
                  { ...botInitialMsg, text: finalAccumulatedText },
                ].map((m) => ({
                  role: m.sender === 'user' ? 'user' : 'model',
                  content: m.text,
                  timestamp: m.timestamp,
                })),
              });
            }
          })
          .catch(() => {});
      } else {
        // Persist session to Firestore
        saveCopilotSession({
          session_id: currentSessionId,
          user_persona: personaIdentifier,
          title: sessionTitleToSave,
          updated_at: new Date().toISOString(),
          messages: [
            ...messages.filter((m) => m.id !== 'init-1'),
            userMsg,
            { ...botInitialMsg, text: finalAccumulatedText },
          ].map((m) => ({
            role: m.sender === 'user' ? 'user' : 'model',
            content: m.text,
            timestamp: m.timestamp,
          })),
        });
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMsgId
            ? { ...msg, text: `*Error generating response: ${err.message}*` }
            : msg
        )
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[560px] bg-slate-900/98 backdrop-blur-xl border-l border-slate-800 shadow-2xl flex flex-col transition-all">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/80">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                <span>{isProd ? 'Facility SRE Agent' : 'TwinOps Specialist'}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 font-mono">
                  {activeRackId.toUpperCase()}
                </span>
              </h3>
              <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase tracking-wider ${
                isProd 
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' 
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}>
                {isProd ? '● PRODUCTION' : '● SANDBOX'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 truncate max-w-[280px]">
              <span className="text-cyan-300 font-semibold truncate">
                {currentSessionTitle}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          {/* History Sidebar Toggle */}
          <button
            onClick={() => setShowHistorySidebar((prev) => !prev)}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer border ${
              showHistorySidebar
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Toggle Previous Triage Sessions"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sessions</span>
            <span className="text-[10px] px-1 rounded-full bg-slate-900 text-cyan-400 font-bold ml-0.5">
              {historicalSessions.length}
            </span>
          </button>

          {/* New Session Button */}
          <button
            onClick={handleNewSession}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-mono bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors cursor-pointer shadow-sm"
            title="Start fresh triage session"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New</span>
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Container with Collapsible Sidebar / Chat Window */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Previous Triage Sessions Drawer / Sidebar */}
        {showHistorySidebar && (
          <div className="w-64 border-r border-slate-800 bg-slate-950/95 flex flex-col z-20 animate-fadeIn shrink-0">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-200 font-mono">
                <History className="w-3.5 h-3.5 text-cyan-400" />
                <span>Previous Sessions</span>
              </div>
              <button
                onClick={handleNewSession}
                className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/40 cursor-pointer flex items-center gap-1 font-semibold"
              >
                <Plus className="w-3 h-3" />
                <span>New</span>
              </button>
            </div>

            {/* Persona filter label */}
            <div className="px-3 py-1.5 bg-slate-900/60 border-b border-slate-800/80 text-[10px] text-slate-400 font-mono flex items-center justify-between">
              <span>Persona:</span>
              <span className="text-cyan-300 font-semibold truncate max-w-[140px]">
                {currentUser?.name.split(' ')[0]} ({currentUser?.badgeLabel})
              </span>
            </div>

            {/* Session List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 font-mono text-xs">
              {historicalSessions.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-[11px]">
                  No previous sessions saved for this persona yet. Send a message to start!
                </div>
              ) : (
                historicalSessions.map((sess) => {
                  const isCurrent = sess.session_id === currentSessionId;
                  const dateStr = new Date(sess.updated_at).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <button
                      key={sess.session_id}
                      onClick={() => handleLoadSession(sess)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-cyan-500/15 border-cyan-500/40 text-white shadow-sm'
                          : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800/80 text-slate-300'
                      }`}
                    >
                      <div className="font-semibold text-[11px] line-clamp-1 text-slate-100 flex items-center justify-between gap-1">
                        <span className="truncate">{sess.title || 'Untitled Session'}</span>
                        {isCurrent && (
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0"></span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-slate-500 mt-1">
                        <span>{dateStr}</span>
                        <span>{sess.messages?.length || 0} msgs</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Chat Window */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Quick Prompts */}
          <div className="px-3 py-2 bg-slate-950/40 border-b border-slate-800/80 overflow-x-auto whitespace-nowrap space-x-1.5 flex text-[11px] shrink-0">
            {quickQueries.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(q)}
                disabled={loading}
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                <span className="truncate max-w-[200px]">{q}</span>
              </button>
            ))}
          </div>

          {/* Message List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start space-x-2.5 ${
                  msg.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.sender === 'assistant' && (
                  <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[88%] rounded-xl p-3 border leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white border-blue-500/50 font-sans'
                      : 'bg-slate-950/85 text-slate-200 border-slate-800 shadow-md'
                  }`}
                >
                  {msg.sender === 'assistant' ? (
                    msg.text ? (
                      <div>
                        {renderMarkdown(msg.text)}
                        {loading && msg.id === messages[messages.length - 1]?.id && (
                          <span className="inline-block w-1.5 h-3 bg-cyan-400 animate-pulse ml-1 align-baseline" />
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 py-1 text-cyan-400">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                        <span className="text-slate-300 font-mono text-xs">
                          {isProd 
                            ? 'Auditing immutable facility power & thermal envelope...' 
                            : 'Analyzing shadow twin telemetry & vendor citations...'}
                        </span>
                      </div>
                    )
                  ) : (
                    msg.text
                  )}
                  <div
                    className={`text-[9px] font-mono mt-2 ${
                      msg.sender === 'user' ? 'text-blue-200 text-right' : 'text-slate-500'
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>

                {msg.sender === 'user' && (
                  <div className="w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center text-slate-300 shrink-0 mt-0.5 border border-slate-700">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/90">
            <div className="flex items-end space-x-2">
              <div className="relative flex-1">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about PUE headroom, or say 'Raise a ticket for this issue'..."
                  disabled={loading}
                  className="w-full resize-none max-h-[120px] bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono leading-relaxed block"
                />
              </div>
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!inputValue.trim() || loading}
                className="p-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white transition-colors cursor-pointer shrink-0"
                title="Send Message (Enter)"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-1.5 px-1 flex items-center justify-between">
              <span>Press <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-400">Enter</kbd> to send, <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-400">Shift + Enter</kbd> for newline</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

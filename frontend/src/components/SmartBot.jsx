import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, Send, Loader2, Minimize2, Sparkles, Mic, MicOff, Settings, Cpu, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { soundFX } from '../utils/soundFX';

/**
 * Lightweight helper to render formatted markdown-like text
 * (handles headings, bold highlights, bullet points, linebreaks)
 */
const FormattedMessage = ({ content }) => {
  if (!content) return null;

  const lines = content.split('\n');
  return (
    <div className="space-y-1.5 text-xs sm:text-sm leading-relaxed">
      {lines.map((line, i) => {
        const trimmed = line.trim();

        // Empty line
        if (!trimmed) {
          return <div key={i} className="h-1" />;
        }

        // Heading 3: ### Heading
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={i} className="font-black text-sm text-indigo-700 dark:text-indigo-400 mt-2 mb-1">
              {trimmed.replace('### ', '')}
            </h4>
          );
        }

        // Heading 2 or 1
        if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
          return (
            <h3 key={i} className="font-black text-base text-gray-900 dark:text-white mt-2 mb-1">
              {trimmed.replace(/^#+\s/, '')}
            </h3>
          );
        }

        // Bullet point
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
          const text = trimmed.slice(2);
          return (
            <div key={i} className="flex items-start gap-1.5 ml-1">
              <span className="text-indigo-500 font-bold">•</span>
              <div>{renderInline(text)}</div>
            </div>
          );
        }

        // Normal paragraph
        return <p key={i}>{renderInline(trimmed)}</p>;
      })}
    </div>
  );
};

// Inline parser for **bold** text
function renderInline(text) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-black text-gray-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

const SmartBot = ({ onOpenSettings }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [engineInfo, setEngineInfo] = useState({ provider: 'smartengine', hasKey: false });

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // Fetch active AI engine mode
  const fetchEngineInfo = async () => {
    try {
      const res = await api.get('/auth/profile');
      if (res.data) {
        setEngineInfo({
          provider: res.data.aiProvider || 'gemini',
          hasKey: !!res.data.hasAiApiKey
        });
      }
    } catch (err) {
      // Ignore
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchEngineInfo();
    }
  }, [isOpen]);

  useEffect(() => {
    // Setup SpeechRecognition if supported by browser
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      
      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev + (prev ? ' ' : '') + transcript);
        setIsListening(false);
      };
      
      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    soundFX.playPop();
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        console.error(e);
      }
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isMinimized]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        { 
          role: 'assistant', 
          content: "### 👋 Hello! I'm your SmartAssistant.\nI monitor your financial pacing, caloric intake, intermittent fasting, and daily consistency.\n\nAsk me anything or tap one of the quick shortcuts below!"
        }
      ]);
    }
  }, [isOpen, messages.length]);

  const sendQuery = async (queryText) => {
    const textToSend = queryText || input;
    if (!textToSend.trim()) return;

    soundFX.playPop();
    const userMessage = { role: 'user', content: textToSend };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/ai/chat', { message: userMessage.content });
      soundFX.playPop();
      setMessages(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: res.data.reply,
          source: res.data.source,
          provider: res.data.provider,
          model: res.data.model
        }
      ]);
      // Update engine info badge if model was returned
      if (res.data.source === 'llm') {
        setEngineInfo({ provider: res.data.provider, hasKey: true });
      }
    } catch (err) {
      const errReply = err.response?.data?.reply || 'Oops! I am having trouble connecting to my engine right now. 🔌';
      setMessages(prev => [...prev, { role: 'assistant', content: errReply }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    sendQuery();
  };

  const quickPrompts = [
    { label: '📋 Daily Summary', query: 'Give me today summary' },
    { label: '💸 Budget Pace', query: 'How is my budget pacing and safe daily spend?' },
    { label: '🥗 Macro Targets', query: 'Show my calorie and macro breakdown' },
    { label: '💧 Water Check', query: 'Water intake status' },
    { label: '⏱️ Fasting Status', query: 'Fasting progress check' }
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end tour-step-3-bot">
      <AnimatePresence>
        {isOpen && !isMinimized && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl border border-white/50 dark:border-gray-700/50 shadow-2xl rounded-[2rem] w-80 sm:w-[420px] overflow-hidden flex flex-col mb-4 origin-bottom-right"
            style={{ height: '560px', maxHeight: '82vh' }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 p-4 sm:p-5 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3 text-white">
                <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-md shadow-inner">
                   <Sparkles size={18} className="text-yellow-300 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black tracking-tight text-base">SmartAssistant AI</h3>
                    {engineInfo.hasKey ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-emerald-400/20 text-emerald-200 border border-emerald-300/30 px-2 py-0.5 rounded-full">
                        <Zap size={10} /> {engineInfo.provider === 'openai' ? 'GPT-4o' : 'Gemini'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-white/20 text-indigo-100 border border-white/20 px-2 py-0.5 rounded-full">
                        <Cpu size={10} /> SmartEngine
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-indigo-100/90 font-medium">Telemetry & Context-Aware Life OS</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {onOpenSettings && (
                  <button 
                    onClick={() => { soundFX.playPop(); onOpenSettings(); }} 
                    title="Configure AI API Key"
                    className="text-white/80 hover:text-white p-1.5 hover:bg-white/10 rounded-xl transition-all"
                  >
                    <Settings size={17} />
                  </button>
                )}
                <button 
                  onClick={() => { soundFX.playPop(); setIsMinimized(true); }} 
                  className="text-white/80 hover:text-white p-1.5 hover:bg-white/10 rounded-xl transition-all"
                >
                  <Minimize2 size={17} />
                </button>
                <button 
                  onClick={() => { soundFX.playPop(); setIsOpen(false); }} 
                  className="text-white/80 hover:text-white p-1.5 hover:bg-white/10 rounded-xl transition-all hover:rotate-90"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* Quick Action Chips Bar */}
            <div className="px-3 py-2 bg-indigo-50/60 dark:bg-gray-800/60 border-b border-indigo-100/50 dark:border-gray-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              {quickPrompts.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => sendQuery(p.query)}
                  disabled={loading}
                  className="px-2.5 py-1 text-[11px] font-bold whitespace-nowrap bg-white dark:bg-gray-700/80 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 text-gray-700 dark:text-gray-200 rounded-xl border border-gray-200 dark:border-gray-600 transition-all shadow-2xs hover:shadow-sm"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-gray-50/50 dark:bg-gray-900/40">
              {messages.map((msg, idx) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={idx} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[90%] rounded-2xl px-4 py-3 shadow-xs ${
                    msg.role === 'user' 
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-br-xs font-semibold' 
                      : 'bg-white dark:bg-gray-800 border border-gray-200/60 dark:border-gray-700/60 text-gray-800 dark:text-gray-100 rounded-bl-xs'
                  }`}>
                    {msg.role === 'user' ? (
                      <p className="text-xs sm:text-sm">{msg.content}</p>
                    ) : (
                      <FormattedMessage content={msg.content} />
                    )}
                  </div>
                </motion.div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-gray-800 border border-gray-200/60 dark:border-gray-700/60 rounded-2xl rounded-bl-xs px-4 py-3 shadow-xs flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Analyzing telemetry...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSend} className="p-3 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 shrink-0">
              <div className="relative flex items-center">
                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about budget, macros, fasting..."
                  className="w-full bg-gray-100/80 dark:bg-gray-800/80 border-0 rounded-2xl py-3.5 pl-4 pr-24 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-700 font-medium transition-all shadow-inner outline-none dark:text-white"
                />
                <div className="absolute right-2 flex items-center gap-1.5">
                  {recognitionRef.current && (
                    <button 
                      type="button" 
                      onClick={toggleListening}
                      title="Speech Input"
                      className={`p-2 rounded-xl transition-all shadow-xs ${isListening ? 'bg-red-500 text-white animate-pulse shadow-red-500/50' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                    >
                      {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                    </button>
                  )}
                  <button 
                    type="submit" 
                    disabled={!input.trim() || loading}
                    className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all shadow-md hover:shadow-indigo-500/25 active:scale-95"
                  >
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => { soundFX.playPop(); setIsOpen(true); setIsMinimized(false); }}
        className={`bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 sm:p-5 rounded-full shadow-2xl hover:shadow-indigo-500/50 transition-all border-4 border-white/20 dark:border-gray-800/50 group flex items-center justify-center ${isOpen && !isMinimized ? 'hidden' : 'block'}`}
      >
        <Bot size={28} className="group-hover:animate-bounce" />
        {isMinimized && (
           <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white dark:border-gray-900 animate-pulse">1</span>
        )}
      </motion.button>
    </div>
  );
};

export default SmartBot;

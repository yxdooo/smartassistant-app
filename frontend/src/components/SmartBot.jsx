import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, Send, Loader2, Minimize2, Sparkles, Mic, MicOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { soundFX } from '../utils/soundFX';

const SmartBot = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    // Setup SpeechRecognition
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
        { role: 'assistant', content: t('smartbot.title') + " is here! " + t('smartbot.placeholder') }
      ]);
    }
  }, [isOpen, messages.length, t]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    soundFX.playPop();
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/ai/chat', { message: userMessage.content });
      soundFX.playPop();
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Oops! I am having trouble connecting to my brain right now.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end tour-step-3-bot">
      <AnimatePresence>
        {isOpen && !isMinimized && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-2xl border border-white/50 dark:border-gray-700/50 shadow-2xl rounded-[2rem] w-80 sm:w-96 overflow-hidden flex flex-col mb-4 origin-bottom-right"
            style={{ height: '500px', maxHeight: '80vh' }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 sm:p-5 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3 text-white">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                   <Sparkles size={20} className="text-yellow-300 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-black tracking-tight">{t('smartbot.title')}</h3>
                  <p className="text-[10px] text-indigo-100 uppercase tracking-widest font-bold">{t('smartbot.subtitle')}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { soundFX.playPop(); setIsMinimized(true); }} className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded-lg transition-colors"><Minimize2 size={18} /></button>
                <button onClick={() => { soundFX.playPop(); setIsOpen(false); }} className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded-lg transition-colors"><X size={18} /></button>
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-gray-50/50 dark:bg-gray-800/30">
              {messages.map((msg, idx) => (
                <motion.div 
                  initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={idx} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm font-medium shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-br-none' 
                      : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 text-gray-800 dark:text-gray-200 rounded-bl-none'
                  }`}>
                    {msg.content}
                  </div>
                </motion.div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
                    <Loader2 size={16} className="animate-spin text-indigo-600" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSend} className="p-3 bg-white dark:bg-gray-900 border-t border-gray-100/50 dark:border-gray-800/50 shrink-0">
              <div className="relative flex items-center">
                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t('smartbot.placeholder')}
                  className="w-full bg-gray-100/80 dark:bg-gray-800/80 border-0 rounded-2xl py-3.5 pl-4 pr-24 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-700 font-medium transition-all shadow-inner outline-none dark:text-white"
                />
                <div className="absolute right-2 flex items-center gap-1">
                  {recognitionRef.current && (
                    <button 
                      type="button" 
                      onClick={toggleListening}
                      className={`p-2 rounded-xl transition-all shadow-sm ${isListening ? 'bg-red-500 text-white animate-pulse shadow-red-500/50' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                    >
                      {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                    </button>
                  )}
                  <button 
                    type="submit" 
                    disabled={!input.trim() || loading}
                    className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors shadow-md hover:shadow-lg"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => { soundFX.playPop(); setIsOpen(true); setIsMinimized(false); }}
        className={`bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 sm:p-5 rounded-full shadow-2xl hover:shadow-indigo-500/50 transition-all border-4 border-white/20 dark:border-gray-800/50 group flex items-center justify-center ${isOpen && !isMinimized ? 'hidden' : 'block'}`}
      >
        <Bot size={28} className="group-hover:animate-bounce" />
        {isMinimized && (
           <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white dark:border-gray-900 animate-pulse">1</span>
        )}
      </motion.button>
    </div>
  );
};

export default SmartBot;

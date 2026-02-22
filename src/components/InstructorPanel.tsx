import React, { useState, useEffect, useRef } from 'react';
import { Send, Volume2, VolumeX, Play, Pause, ChevronRight, Sparkles, User, AlertCircle } from 'lucide-react';
import { ChatMessage, Lesson, LessonStep } from '../types';
import { getInstructorResponse, generateSpeech } from '../services/gemini';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';

interface InstructorPanelProps {
  lesson: Lesson;
  currentStep: LessonStep;
  onStepChange: (step: LessonStep) => void;
  onCodeUpdate: (code: string) => void;
  userCode: string;
  voiceEnabled: boolean;
}

export default function InstructorPanel({
  lesson,
  currentStep,
  onStepChange,
  onCodeUpdate,
  userCode,
  voiceEnabled
}: InstructorPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<number | null>(null);
  const [revealedChars, setRevealedChars] = useState<Record<number, number>>({});
  const [voiceType, setVoiceType] = useState<'ai' | 'local'>('local');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('');
  const [showVoiceToast, setShowVoiceToast] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const steps: LessonStep[] = ['explanation', 'example', 'guided', 'independent', 'feedback'];

  // Load voices for local TTS
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      const enUS = voices.filter(v => v.lang.startsWith('en'));
      setAvailableVoices(enUS);
      
      // Set default selected voice
      const preferred = enUS.find(v => v.name.toLowerCase().includes('google') && v.lang === 'en-US') 
                     || enUS.find(v => v.lang === 'en-US')
                     || enUS[0];
      if (preferred && !selectedVoiceName) {
        setSelectedVoiceName(preferred.name);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  // Cleanup audio on unmount or lesson change
  useEffect(() => {
    return () => {
      if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch(e) {}
      }
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    };
  }, [lesson.id, currentStep]);

  const playLocalVoice = (text: string, messageId: number) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Get all available voices
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.name === selectedVoiceName) || voices.find(v => v.lang === 'en-US') || voices[0];
    
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
    
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    utterance.onstart = () => {
      setIsSpeaking(true);
      setSpeakingMessageId(messageId);
      setRevealedChars(prev => ({ ...prev, [messageId]: 0 }));
    };

    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        const nextSpace = text.indexOf(' ', event.charIndex + event.charLength);
        const revealTo = nextSpace === -1 ? text.length : nextSpace;
        setRevealedChars(prev => ({ ...prev, [messageId]: revealTo }));
      }
    };
    
    utterance.onend = () => {
      setIsSpeaking(false);
      setSpeakingMessageId(null);
      setRevealedChars(prev => ({ ...prev, [messageId]: text.length }));
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setSpeakingMessageId(null);
      setRevealedChars(prev => ({ ...prev, [messageId]: text.length }));
    };

    window.speechSynthesis.speak(utterance);
  };

  const playPCM = async (base64: string, messageId: number, text: string) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      const audioContext = audioContextRef.current;
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      // Stop previous audio
      if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch(e) {}
      }

      const binaryString = window.atob(base64);
      const len = binaryString.length;
      const bytes = new Int16Array(len / 2);
      for (let i = 0; i < len; i += 2) {
        bytes[i / 2] = (binaryString.charCodeAt(i + 1) << 8) | binaryString.charCodeAt(i);
      }
      
      const float32Data = new Float32Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) {
        float32Data[i] = bytes[i] / 32768;
      }

      const buffer = audioContext.createBuffer(1, float32Data.length, 24000);
      buffer.getChannelData(0).set(float32Data);
      
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      
      const duration = buffer.duration;
      const charsPerSecond = text.length / duration;
      let startTime = audioContext.currentTime;
      
      const revealInterval = setInterval(() => {
        const elapsed = audioContext.currentTime - startTime;
        const revealTo = Math.min(text.length, Math.floor(elapsed * charsPerSecond));
        setRevealedChars(prev => ({ ...prev, [messageId]: revealTo }));
        if (elapsed >= duration) clearInterval(revealInterval);
      }, 50);

      source.onended = () => {
        setIsSpeaking(false);
        setSpeakingMessageId(null);
        setRevealedChars(prev => ({ ...prev, [messageId]: text.length }));
        clearInterval(revealInterval);
      };
      
      sourceRef.current = source;
      source.start();
      setIsSpeaking(true);
      setSpeakingMessageId(messageId);
      setRevealedChars(prev => ({ ...prev, [messageId]: 0 }));
    } catch (err) {
      console.error("Audio Playback Error:", err);
      setIsSpeaking(false);
      setSpeakingMessageId(null);
      setRevealedChars(prev => ({ ...prev, [messageId]: text.length }));
    }
  };

  const stripCodeBlocks = (text: string) => {
    return text.replace(/```[\s\S]*?```/g, '').trim();
  };

  const handleSpeak = async (text: string, messageId: number) => {
    const cleanText = stripCodeBlocks(text);
    if (!cleanText) return;

    if (voiceType === 'local') {
      playLocalVoice(cleanText, messageId);
      return;
    }

    const base64 = await generateSpeech(cleanText);
    if (base64) {
      await playPCM(base64, messageId, cleanText);
    } else {
      console.warn("AI TTS failed, falling back to local voice.");
      setVoiceType('local');
      setShowVoiceToast(true);
      setTimeout(() => setShowVoiceToast(false), 5000);
      playLocalVoice(text, messageId);
    }
  };

  const toggleSpeaking = () => {
    if (isSpeaking) {
      if (voiceType === 'local') {
        window.speechSynthesis.cancel();
      } else if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch(e) {}
      }
      if (speakingMessageId) {
        setRevealedChars(prev => ({ ...prev, [speakingMessageId]: 1000000 }));
      }
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    }
  };

  useEffect(() => {
    // Reset messages when lesson or step changes
    setMessages([]);
    loadInitialResponse();
  }, [lesson.id, currentStep]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadInitialResponse = async () => {
    setIsLoading(true);
    try {
      const response = await getInstructorResponse(lesson, currentStep, []);
      if (response) {
        const { text, codeUpdate } = response;
        const timestamp = Date.now();
        const newMessage: ChatMessage = { 
          role: 'model', 
          text, 
          timestamp,
          hasCodeUpdate: !!codeUpdate 
        };
        setMessages([newMessage]);
        
        if (codeUpdate) {
          onCodeUpdate(codeUpdate);
        }

        if (voiceEnabled) {
          setRevealedChars(prev => ({ ...prev, [timestamp]: 0 }));
          handleSpeak(text, timestamp);
        }
      }
    } catch (error: any) {
      console.error(error);
      const isQuota = error?.message?.includes("quota") || error?.message?.includes("429");
      const errorMsg: ChatMessage = { 
        role: 'model', 
        text: isQuota 
          ? "I'm a bit overwhelmed with requests right now! Please wait a moment and try again." 
          : "I encountered an error while trying to respond. Please try refreshing the page.", 
        timestamp: Date.now() 
      };
      setMessages([errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', text: inputValue, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await getInstructorResponse(lesson, currentStep, messages.concat(userMsg), undefined, userCode);
      if (response) {
        const { text, codeUpdate } = response;
        const timestamp = Date.now();
        const modelMsg: ChatMessage = { 
          role: 'model', 
          text, 
          timestamp,
          hasCodeUpdate: !!codeUpdate
        };
        setMessages(prev => [...prev, modelMsg]);
        
        if (codeUpdate) {
          onCodeUpdate(codeUpdate);
        }

        if (voiceEnabled) {
          setRevealedChars(prev => ({ ...prev, [timestamp]: 0 }));
          handleSpeak(text, timestamp);
        }
      }
    } catch (error: any) {
      console.error(error);
      const isQuota = error?.message?.includes("quota") || error?.message?.includes("429");
      const errorMsg: ChatMessage = { 
        role: 'model', 
        text: isQuota 
          ? "I'm sorry, I've reached my limit for a moment. Can we try again in a few seconds?" 
          : "Something went wrong on my end. Could you try sending that again?", 
        timestamp: Date.now() 
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-r border-zinc-800">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30">
            <Sparkles className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="font-semibold text-zinc-100 text-sm">Instructor Loom</h3>
            <p className="text-xs text-zinc-500">Teaching: {lesson.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {voiceType === 'local' && availableVoices.length > 0 && (
            <select
              value={selectedVoiceName}
              onChange={(e) => setSelectedVoiceName(e.target.value)}
              className="bg-zinc-800 text-[9px] text-zinc-300 border-none rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500 max-w-[100px] truncate"
            >
              {availableVoices.map(v => (
                <option key={v.name} value={v.name}>{v.name}</option>
              ))}
            </select>
          )}
          <div className="flex bg-zinc-800 p-0.5 rounded-lg mr-1">
            <button
              onClick={() => setVoiceType('ai')}
              className={`px-2 py-1 text-[9px] uppercase font-bold tracking-wider rounded transition-all ${
                voiceType === 'ai' ? "bg-zinc-700 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
              }`}
              title="Loom AI Voice (Gemini)"
            >
              AI
            </button>
            <button
              onClick={() => setVoiceType('local')}
              className={`px-2 py-1 text-[9px] uppercase font-bold tracking-wider rounded transition-all ${
                voiceType === 'local' ? "bg-zinc-700 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
              }`}
              title="System Voice (Local Browser)"
            >
              Local
            </button>
          </div>
          <button 
            onClick={toggleSpeaking}
            className={`p-2 rounded-lg transition-colors ${isSpeaking ? 'bg-indigo-600 text-white' : 'hover:bg-zinc-800 text-zinc-400'}`}
          >
            {isSpeaking ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <div className="h-4 w-px bg-zinc-800 mx-1" />
          <div className="flex bg-zinc-800 p-1 rounded-lg">
            {steps.map((step, idx) => (
              <button
                key={step}
                onClick={() => onStepChange(step)}
                className={`px-2 py-1 text-[10px] uppercase font-bold tracking-wider rounded transition-all ${
                  currentStep === step 
                    ? "bg-indigo-600 text-white shadow-lg" 
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth relative"
      >
        <AnimatePresence>
          {showVoiceToast && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500/90 text-white px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg backdrop-blur-sm flex items-center gap-2"
            >
              <AlertCircle className="w-3 h-3" />
              AI Voice Quota Hit - Switched to Local Voice
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => {
            const isSpeakingThis = speakingMessageId === msg.timestamp;
            return (
              <motion.div
                key={msg.timestamp + idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'user' ? 'bg-zinc-800' : 'bg-indigo-600/20 border border-indigo-500/30'
                }`}>
                  {msg.role === 'user' ? <User className="w-4 h-4 text-zinc-400" /> : <Sparkles className="w-4 h-4 text-indigo-400" />}
                </div>
                <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed transition-all duration-500 ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                    : `bg-zinc-900 text-zinc-300 border rounded-tl-none ${isSpeakingThis ? 'border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.2)] ring-1 ring-indigo-500/50' : 'border-zinc-800'}`
                }`}>
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>
                      {msg.role === 'model' && revealedChars[msg.timestamp] !== undefined 
                        ? msg.text.slice(0, revealedChars[msg.timestamp]) 
                        : msg.text}
                    </ReactMarkdown>
                  </div>
                  {msg.hasCodeUpdate && (
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 w-fit">
                      <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                      Editor Updated
                    </div>
                  )}
                  {isSpeakingThis && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-2 flex items-center gap-2 text-[10px] font-bold text-indigo-400 uppercase tracking-widest"
                    >
                      <div className="flex gap-0.5">
                        <motion.div animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-0.5 bg-indigo-400" />
                        <motion.div animate={{ height: [8, 4, 8] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.1 }} className="w-0.5 bg-indigo-400" />
                        <motion.div animate={{ height: [4, 10, 4] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.2 }} className="w-0.5 bg-indigo-400" />
                      </div>
                      Speaking Now
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {isLoading && (
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30 animate-pulse">
              <Sparkles className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="bg-zinc-900 p-4 rounded-2xl rounded-tl-none border border-zinc-800">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-zinc-800 bg-zinc-900/30">
        <div className="relative">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask Loom a question or type your response..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 pr-12 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all resize-none h-20"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="absolute right-3 bottom-3 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors shadow-lg"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest">Powered by Loom AI</p>
          <button 
            onClick={() => {
              const nextIdx = steps.indexOf(currentStep) + 1;
              if (nextIdx < steps.length) onStepChange(steps[nextIdx]);
            }}
            className="flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Next Step <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

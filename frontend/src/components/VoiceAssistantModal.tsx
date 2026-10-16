import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  PhoneCall, 
  PhoneOff, 
  Volume2, 
  VolumeX, 
  RotateCw, 
  Sparkles, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  ArrowRight,
  Info,
  Server,
  Radio,
  Clock,
  ShieldCheck,
  RefreshCw,
  HelpCircle,
  Check
} from 'lucide-react';
import { 
  Language, 
  TradeType, 
  VoiceAssistantState, 
  VoiceDraftJob, 
  BolnaCallUIState, 
  BolnaCallErrorState 
} from '../types';
import { translations } from '../locales/translations';
import { parseVoiceInput, isSpeechRecognitionSupported } from '../services/voiceParser';
import { BolnaVoiceService } from '../services/bolnaVoiceService';
import { JobApiService } from '../services/jobApi';
import { getValidAccessToken } from '../services/supabaseClient';

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  onJobCreated: () => void;
}

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  isOpen,
  onClose,
  language,
  onJobCreated,
}) => {
  const t = translations[language];

  // Active tab: 'bolna' (official live SDK) or 'demo' (direct device voice & text)
  const [activeMode, setActiveMode] = useState<'bolna' | 'demo'>('demo');

  // ==========================================
  // 1. BOLNA LIVE WEBCALL SERVICE STATE
  // ==========================================
  const [callState, setCallState] = useState<BolnaCallUIState>('idle');
  const [callError, setCallError] = useState<BolnaCallErrorState | null>(null);
  const [volumeLevel, setVolumeLevel] = useState<number>(0);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [runId, setRunId] = useState<string | null>(null);
  const [lastEndReason, setLastEndReason] = useState<string>('');

  const bolnaServiceRef = useRef<BolnaVoiceService | null>(null);
  const timerIntervalRef = useRef<any>(null);

  // Initialize Bolna Voice Service
  useEffect(() => {
    if (isOpen) {
      bolnaServiceRef.current = new BolnaVoiceService(
        {
          onStateChange: (state) => {
            setCallState(state);
            if (bolnaServiceRef.current) {
              setRunId(bolnaServiceRef.current.getRunId());
            }
          },
          onVolumeChange: (level) => {
            setVolumeLevel(level);
          },
          onError: (error) => {
            setCallError(error);
          },
          onCallEnd: (reason) => {
            setLastEndReason(reason);
          },
        },
        undefined,
        {
          appName: 'KaamSaathi',
          language: language,
        }
      );
    }

    return () => {
      if (bolnaServiceRef.current) {
        bolnaServiceRef.current.destroy();
        bolnaServiceRef.current = null;
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isOpen, language]);

  // Duration Timer for active/muted call
  useEffect(() => {
    if (callState === 'active' || callState === 'muted') {
      timerIntervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (callState === 'idle') {
        setCallDuration(0);
      }
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [callState]);

  const handleStartBolnaCall = async () => {
    setCallError(null);
    setCallDuration(0);
    if (bolnaServiceRef.current) {
      await bolnaServiceRef.current.startCall();
    }
  };

  const handleEndBolnaCall = async () => {
    if (bolnaServiceRef.current) {
      await bolnaServiceRef.current.endCall();
    }
  };

  const handleToggleMute = () => {
    if (bolnaServiceRef.current) {
      bolnaServiceRef.current.toggleMute();
    }
  };

  const handleRetryBolnaCall = async () => {
    setCallError(null);
    if (bolnaServiceRef.current) {
      await bolnaServiceRef.current.retry();
    }
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // ==========================================
  // 2. DIRECT VOICE & TEXT STATE
  // ==========================================
  const [demoState, setDemoState] = useState<VoiceAssistantState>('idle');
  const [demoTranscript, setDemoTranscript] = useState('');
  const [demoTextInput, setDemoTextInput] = useState('');
  const [demoErrorMessage, setDemoErrorMessage] = useState('');

  // Structured Q&A response
  const [qaAnswer, setQaAnswer] = useState<{
    question: string;
    answer: string;
    source: 'backend' | 'local';
  } | null>(null);

  const [draft, setDraft] = useState<VoiceDraftJob>({
    customerName: '',
    customerPhone: '',
    trade: 'electrical',
    description: '',
    agreedAmount: 0,
    amountPaid: 0,
    remainingBalance: 0,
    notes: '',
  });

  const demoRecognitionRef = useRef<any>(null);

  // Stop calls/listeners when modal closes
  useEffect(() => {
    if (!isOpen) {
      if (bolnaServiceRef.current) {
        bolnaServiceRef.current.destroy();
      }
      stopDemoListening();
      setCallState('idle');
      setCallError(null);
      setDemoState('idle');
      setQaAnswer(null);
    }
  }, [isOpen]);

  const handleAmountChange = (field: 'agreedAmount' | 'amountPaid', val: number) => {
    setDraft((prev) => {
      const agreed = field === 'agreedAmount' ? val : prev.agreedAmount;
      const paid = field === 'amountPaid' ? val : prev.amountPaid;
      return {
        ...prev,
        [field]: val,
        remainingBalance: Math.max(0, agreed - paid),
      };
    });
  };

  const startDemoListening = () => {
    setDemoErrorMessage('');
    setDemoTranscript('');
    setDemoState('listening');

    if (isSpeechRecognitionSupported()) {
      try {
        const SpeechRecognition =
          (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = language === 'bn' ? 'bn-IN' : 'en-IN';

        recognition.onresult = (event: any) => {
          let current = '';
          for (let i = 0; i < event.results.length; i++) {
            current += event.results[i][0].transcript;
          }
          setDemoTranscript(current);
        };

        recognition.onerror = (event: any) => {
          if (!demoTranscript) {
            setDemoErrorMessage(language === 'bn' ? 'স্পিচ বুঝতে সমস্যা হয়েছে। আবার বলুন বা লিখে দিন।' : 'Could not hear speech clearly. Please try again or type below.');
            setDemoState('error');
          } else {
            handleProcessDemoTranscript(demoTranscript);
          }
        };

        recognition.onend = () => {
          if (demoState === 'listening' && demoTranscript) {
            handleProcessDemoTranscript(demoTranscript);
          }
        };

        demoRecognitionRef.current = recognition;
        recognition.start();
      } catch (err: any) {
        setDemoErrorMessage(language === 'bn' ? 'মাইক্রোফোন স্পিচ রিকগনিশন চালু করা যায়নি।' : 'Microphone speech recognition could not start.');
        setDemoState('error');
      }
    } else {
      setDemoErrorMessage(language === 'bn' ? 'এই ব্রাউজারে স্পিচ রিকগনিশন সমর্থিত নয়। নিচে লিখে ইনপুট দিন।' : 'Speech recognition is not supported in this browser. Please type below.');
      setDemoState('error');
    }
  };

  const stopDemoListening = () => {
    if (demoRecognitionRef.current) {
      try {
        demoRecognitionRef.current.stop();
      } catch (e) {}
    }
    if (demoTranscript.trim()) {
      handleProcessDemoTranscript(demoTranscript);
    } else {
      setDemoState('idle');
    }
  };

  const isQuestionOrInquiry = (raw: string): boolean => {
    const lower = raw.toLowerCase().trim();
    return (
      lower.includes('?') ||
      lower.startsWith('who') ||
      lower.startsWith('how much') ||
      lower.startsWith('what are') ||
      lower.startsWith('what is') ||
      lower.includes('owe') ||
      lower.includes('baki') ||
      lower.includes('udhaar') ||
      lower.includes('debt') ||
      lower.includes('balance') ||
      lower.includes('reminder') ||
      lower.includes('earn') ||
      lower.includes('collected') ||
      raw.includes('বাকি') ||
      raw.includes('টাকা') ||
      raw.includes('উপার্জন') ||
      raw.includes('অনুস্মারক')
    );
  };

  const handleLedgerInquiry = async (raw: string) => {
    setDemoState('processing');
    setDemoTranscript(raw);
    setQaAnswer(null);

    const token = (await getValidAccessToken()) || localStorage.getItem('supabase_auth_token') || localStorage.getItem('sb_access_token');
    if (!token) {
      setQaAnswer({
        question: raw,
        answer: 'Cloud session is inactive. Please ensure anonymous session is initialized to query your records.',
        source: 'backend',
      });
      setDemoState('idle');
      return;
    }

    try {
      const response = await JobApiService.executeBolnaTool(
        'answer_ledger_question',
        { question: raw },
        true,
        token
      );
      if (response && response.message) {
        setQaAnswer({
          question: raw,
          answer: response.message,
          source: 'backend',
        });
      } else {
        setQaAnswer({
          question: raw,
          answer: 'No answer returned from backend ledger query.',
          source: 'backend',
        });
      }
    } catch (err: any) {
      setQaAnswer({
        question: raw,
        answer: `Ledger query: ${err.message || 'Error communicating with backend.'}`,
        source: 'backend',
      });
    }
    setDemoState('idle');
  };

  const handleProcessDemoTranscript = (text: string) => {
    if (isQuestionOrInquiry(text)) {
      handleLedgerInquiry(text);
      return;
    }

    setDemoState('processing');
    setDemoTranscript(text);

    setTimeout(() => {
      const parsed = parseVoiceInput(text);
      setDraft(parsed);
      setDemoState('confirmation');
    }, 400);
  };

  const handleDemoTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoTextInput.trim()) return;
    const text = demoTextInput.trim();
    setDemoTextInput('');
    handleProcessDemoTranscript(text);
  };

  const handleSaveDemoToLedger = async () => {
    if (!draft.customerName.trim() || draft.agreedAmount <= 0) {
      setDemoErrorMessage('Please provide a valid customer name and agreed amount.');
      return;
    }

    const token = (await getValidAccessToken()) || localStorage.getItem('supabase_auth_token') || localStorage.getItem('sb_access_token') || '';
    if (!token) {
      setDemoErrorMessage('Authentication required: Anonymous cloud session could not be established.');
      return;
    }

    try {
      await JobApiService.createJob({
        customerName: draft.customerName,
        customerPhone: draft.customerPhone || '+91 98000 00000',
        trade: draft.trade,
        description: draft.description || `${draft.trade} repair service`,
        agreedAmount: draft.agreedAmount,
        amountPaid: draft.amountPaid,
        date: new Date().toISOString().split('T')[0],
        notes: draft.notes || 'Logged via Voice Assistant',
        confirmed: true,
      }, token);
      
      setDemoState('success');
      onJobCreated();
    } catch (err: any) {
      setDemoErrorMessage(`Failed to save: ${err.message}`);
      setDemoState('error');
    }
  };

  if (!isOpen) return null;

  const sessionEndpointUrl = bolnaServiceRef.current 
    ? bolnaServiceRef.current.getSessionUrl() 
    : '/api/bolna-session';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/60 backdrop-blur-xs animate-fade-in">
      <div 
        className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-modal-title"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-xs shrink-0">
              <Mic className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 id="voice-modal-title" className="text-sm sm:text-base font-bold text-stone-900 leading-tight truncate">
                {language === 'bn' ? 'ভয়েস সহকারী' : 'Voice Assistant'}
              </h2>
              <span className="text-[11px] text-stone-500 font-medium block truncate">
                {language === 'bn' ? 'কথা বলে কাজ যুক্ত করুন বা হিসাব জানুন' : 'Speak or type to log jobs and check balances'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mode Selector Tabs (Direct Voice vs Bolna Live WebRTC) */}
        <div className="px-4 sm:px-6 pt-2 pb-2 bg-stone-50/70 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center p-1 bg-stone-200/70 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => {
                setActiveMode('demo');
                handleEndBolnaCall();
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeMode === 'demo'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Mic className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>{language === 'bn' ? 'ডিভাইস ভয়েস ও টেক্সট' : 'Direct Voice & Text'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveMode('bolna');
                stopDemoListening();
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeMode === 'bolna'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>{language === 'bn' ? 'লাইভ কল (বলনা)' : 'Live Call (Bolna AI)'}</span>
            </button>
          </div>

          <span className="text-[11px] text-stone-500 hidden md:inline truncate">
            {activeMode === 'demo' ? 'Microphone / Keyboard' : 'WebRTC Voice Session'}
          </span>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5">

          {/* ======================================================== */}
          {/* TAB 1: DIRECT DEVICE VOICE & TEXT INPUT                  */}
          {/* ======================================================== */}
          {activeMode === 'demo' && (
            <div className="space-y-4">
              
              {/* IDLE / LISTENING / PROCESSING / ERROR */}
              {(demoState === 'idle' || demoState === 'listening' || demoState === 'processing' || demoState === 'error') && (
                <div className="flex flex-col items-center text-center space-y-4 py-2">
                  
                  {/* Big Microphone Action Button */}
                  <div className="relative flex items-center justify-center my-2">
                    {demoState === 'listening' && (
                      <div className="absolute w-28 h-28 rounded-full bg-emerald-500/20 animate-ping" />
                    )}
                    
                    <button
                      onClick={demoState === 'listening' ? stopDemoListening : startDemoListening}
                      className={`relative z-10 w-20 h-20 rounded-full flex flex-col items-center justify-center text-white shadow-md transition-all active:scale-95 ${
                        demoState === 'listening'
                          ? 'bg-rose-600 hover:bg-rose-700 ring-4 ring-rose-200'
                          : demoState === 'processing'
                          ? 'bg-emerald-700 animate-pulse'
                          : 'bg-emerald-700 hover:bg-emerald-800 ring-4 ring-emerald-100'
                      }`}
                      aria-label={demoState === 'listening' ? 'Stop listening' : 'Start speaking'}
                    >
                      {demoState === 'listening' ? (
                        <MicOff className="w-7 h-7" />
                      ) : demoState === 'processing' ? (
                        <RotateCw className="w-7 h-7 animate-spin" />
                      ) : (
                        <Mic className="w-7 h-7" />
                      )}
                    </button>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-stone-900">
                      {demoState === 'idle' && (language === 'bn' ? 'কথা বলতে মাইকে চাপুন' : 'Tap to speak job details')}
                      {demoState === 'listening' && (language === 'bn' ? 'শুনছি... কথা বলা শেষ হলে চাপুন' : 'Listening... tap when finished speaking')}
                      {demoState === 'processing' && (language === 'bn' ? 'বিবরণ সাজানো হচ্ছে...' : 'Understanding details...')}
                      {demoState === 'error' && (demoErrorMessage || t.voice.statusError)}
                    </h3>
                    <p className="text-xs text-stone-500 max-w-sm mt-1">
                      {demoState === 'idle' && (language === 'bn' 
                        ? 'উদাহরণ: "রমেশ বাবু বৈদ্যুতিক কাজ ১৫০০ টাকা অগ্রিম ৫০০" অথবা জিজ্ঞাসা করুন "কার কাছে কত টাকা বাকি আছে?"' 
                        : 'E.g. "Ramesh Babu electrical wiring 1500 advance 500" or ask "Who owes me udhaar?"')}
                    </p>
                  </div>

                  {/* Transcript box if spoken */}
                  {demoTranscript && (
                    <div className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-left text-xs text-stone-800 italic">
                      "{demoTranscript}"
                    </div>
                  )}

                  {/* Ledger Q&A Response Card */}
                  {qaAnswer && (
                    <div className="w-full p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-left space-y-2.5 shadow-xs">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 font-bold text-emerald-950">
                          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                          <span>Ledger Answer</span>
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          Verified DB Record
                        </span>
                      </div>
                      <div className="text-xs text-stone-600 italic">
                        Q: "{qaAnswer.question}"
                      </div>
                      <div className="text-xs font-semibold text-stone-900 bg-white p-3 rounded-xl border border-emerald-100 leading-relaxed">
                        {qaAnswer.answer}
                      </div>
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => setQaAnswer(null)}
                          className="px-3 py-1 text-xs font-semibold text-emerald-800 hover:text-emerald-950 hover:bg-emerald-100/60 rounded-lg transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Quick Question Chips for Technicians */}
                  <div className="w-full text-left pt-2 border-t border-stone-100">
                    <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-2">
                      {language === 'bn' ? 'হিসাব সংক্রান্ত প্রশ্ন জিজ্ঞাসা করুন' : 'Ask questions about your ledger'}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleLedgerInquiry("Who owes me udhaar money?")}
                        className="px-2.5 py-1.5 text-xs bg-stone-100 hover:bg-emerald-50 hover:text-emerald-900 hover:border-emerald-200 border border-stone-200 rounded-lg font-medium text-stone-700 transition-colors"
                      >
                        Who owes me money?
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLedgerInquiry("What are my upcoming reminders?")}
                        className="px-2.5 py-1.5 text-xs bg-stone-100 hover:bg-emerald-50 hover:text-emerald-900 hover:border-emerald-200 border border-stone-200 rounded-lg font-medium text-stone-700 transition-colors"
                      >
                        Upcoming reminders?
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLedgerInquiry("How much did I earn today?")}
                        className="px-2.5 py-1.5 text-xs bg-stone-100 hover:bg-emerald-50 hover:text-emerald-900 hover:border-emerald-200 border border-stone-200 rounded-lg font-medium text-stone-700 transition-colors"
                      >
                        Today's earnings?
                      </button>
                    </div>
                  </div>

                  {/* Text Input Fallback */}
                  <div className="w-full text-left pt-2 border-t border-stone-100">
                    <label className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1.5">
                      {t.voice.orTypeBelow}
                    </label>
                    <form onSubmit={handleDemoTextSubmit} className="flex gap-2">
                      <input
                        type="text"
                        value={demoTextInput}
                        onChange={(e) => setDemoTextInput(e.target.value)}
                        placeholder={t.voice.inputPlaceholder}
                        className="flex-1 px-3 py-2 text-xs bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 text-stone-900"
                      />
                      <button
                        type="submit"
                        disabled={!demoTextInput.trim()}
                        className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-xl flex items-center gap-1 transition-colors shrink-0"
                      >
                        <span>{language === 'bn' ? 'প্রসেস' : 'Process'}</span>
                        <Send className="w-3 h-3" />
                      </button>
                    </form>
                  </div>

                </div>
              )}

              {/* CONFIRMATION STATE: Review Card before DB Commit */}
              {demoState === 'confirmation' && (
                <div className="space-y-4">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Review extracted job details before saving to the database:</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        {t.jobs.customer} *
                      </label>
                      <input
                        type="text"
                        value={draft.customerName}
                        onChange={(e) => setDraft({ ...draft, customerName: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-600 text-stone-900"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        {t.jobs.phone}
                      </label>
                      <input
                        type="text"
                        value={draft.customerPhone}
                        onChange={(e) => setDraft({ ...draft, customerPhone: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-600 font-mono text-stone-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        {t.jobs.trade}
                      </label>
                      <select
                        value={draft.trade}
                        onChange={(e) => setDraft({ ...draft, trade: e.target.value as TradeType })}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-600 text-stone-900"
                      >
                        <option value="electrical">{t.trades.electrical}</option>
                        <option value="plumbing">{t.trades.plumbing}</option>
                        <option value="appliance">{t.trades.appliance}</option>
                        <option value="other">{t.trades.other}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        {t.jobs.description}
                      </label>
                      <input
                        type="text"
                        value={draft.description}
                        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-600 text-stone-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        {t.jobs.agreedAmount} *
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={draft.agreedAmount || ''}
                        onChange={(e) => handleAmountChange('agreedAmount', Number(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-xl font-mono tabular-nums focus:ring-2 focus:ring-emerald-600 text-stone-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        {t.jobs.amountPaid}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={draft.amountPaid || ''}
                        onChange={(e) => handleAmountChange('amountPaid', Number(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-xl font-mono tabular-nums focus:ring-2 focus:ring-emerald-600 text-stone-900"
                      />
                    </div>
                  </div>

                  {/* Calculated Balance */}
                  <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-stone-600 font-medium">Calculated Unpaid Udhaar:</span>
                    <span className={`font-mono font-bold text-sm tabular-nums ${
                      draft.remainingBalance > 0 ? 'text-amber-800' : 'text-emerald-800'
                    }`}>
                      ₹{draft.remainingBalance.toLocaleString('en-IN')}
                    </span>
                  </div>

                  {demoErrorMessage && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{demoErrorMessage}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-100">
                    <button
                      type="button"
                      onClick={() => setDemoState('idle')}
                      className="px-3.5 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl"
                    >
                      {language === 'bn' ? 'বাতিল' : 'Discard & Retry'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveDemoToLedger}
                      className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs flex items-center gap-1.5 active:scale-95 transition-all"
                    >
                      <span>{language === 'bn' ? 'খাতায় সংরক্ষণ করুন' : 'Confirm & Save Job'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* SUCCESS STATE */}
              {demoState === 'success' && (
                <div className="py-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 mx-auto flex items-center justify-center">
                    <Check className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-stone-900">
                      {language === 'bn' ? 'কাজ সফলভাবে সংরক্ষিত হয়েছে' : 'Job Saved to Ledger!'}
                    </h3>
                    <p className="text-xs text-stone-500 mt-1">
                      {draft.customerName} · ₹{draft.agreedAmount.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDraft({
                          customerName: '',
                          customerPhone: '',
                          trade: 'electrical',
                          description: '',
                          agreedAmount: 0,
                          amountPaid: 0,
                          remainingBalance: 0,
                          notes: '',
                        });
                        setDemoState('idle');
                      }}
                      className="px-3.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200"
                    >
                      Log Another Job
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 rounded-xl"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: OFFICIAL LIVE BOLNA WEBCALL SDK                   */}
          {/* ======================================================== */}
          {activeMode === 'bolna' && (
            <div className="space-y-4">
              
              {/* Architecture & Security Notice Banner */}
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl flex items-start gap-2.5 text-xs text-stone-700">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-[11px]">
                  <p className="font-semibold text-stone-900">
                    Official @bolna/web-call WebRTC Session
                  </p>
                  <p className="text-stone-500">
                    Browser connects directly over WebRTC. Ephemeral credentials are safely minted by your backend without exposing API keys.
                  </p>
                </div>
              </div>

              {/* CALL STATE: IDLE */}
              {callState === 'idle' && (
                <div className="flex flex-col items-center text-center space-y-4 py-4">
                  <div className="w-20 h-20 rounded-full bg-emerald-50 border-4 border-emerald-100 flex items-center justify-center text-emerald-700">
                    <Mic className="w-8 h-8" />
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-stone-900">
                      {t.voice.callStatusIdle}
                    </h3>
                    <p className="text-xs text-stone-500 max-w-sm mt-1">
                      Start a live conversation with the AI voice assistant. Speak naturally in Hindi, Bengali, or English.
                    </p>
                  </div>

                  <button
                    onClick={handleStartBolnaCall}
                    className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs active:scale-95 transition-all flex items-center gap-2"
                  >
                    <PhoneCall className="w-4 h-4" />
                    <span>{t.voice.startCall}</span>
                  </button>

                  <div className="pt-1 text-[11px] text-stone-400 font-mono">
                    Endpoint: POST {sessionEndpointUrl}
                  </div>
                </div>
              )}

              {/* CALL STATE: CONNECTING */}
              {callState === 'connecting' && (
                <div className="flex flex-col items-center text-center space-y-4 py-6">
                  <div className="relative flex items-center justify-center">
                    <div className="absolute w-28 h-28 rounded-full bg-emerald-500/20 animate-ping" />
                    <div className="w-20 h-20 rounded-full bg-emerald-700 text-white flex items-center justify-center shadow-md">
                      <RotateCw className="w-8 h-8 animate-spin" />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-stone-900">
                      {t.voice.callStatusConnecting}
                    </h3>
                    <p className="text-xs text-stone-500 mt-1">
                      Minting WebRTC credentials and opening audio stream...
                    </p>
                  </div>

                  <button
                    onClick={handleEndBolnaCall}
                    className="px-4 py-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 rounded-lg transition-colors"
                  >
                    {t.common.cancel}
                  </button>
                </div>
              )}

              {/* CALL STATE: ACTIVE or MUTED */}
              {(callState === 'active' || callState === 'muted') && (
                <div className="bg-stone-900 text-white rounded-2xl p-6 flex flex-col items-center text-center space-y-5 shadow-lg">
                  <div className="w-full flex items-center justify-between text-xs text-stone-400">
                    <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      {callState === 'muted' ? 'MUTED' : 'LIVE CONVERSATION'}
                    </span>
                    <span className="font-mono tabular-nums text-stone-300 font-semibold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-stone-400" />
                      {formatTimer(callDuration)}
                    </span>
                  </div>

                  {/* Volume Visualizer */}
                  <div className="relative flex items-center justify-center py-2">
                    <div 
                      className="absolute rounded-full bg-emerald-500/20 transition-all duration-100"
                      style={{
                        width: `${80 + volumeLevel * 60}px`,
                        height: `${80 + volumeLevel * 60}px`,
                      }}
                    />
                    <div 
                      className="w-20 h-20 rounded-full bg-emerald-700 flex items-center justify-center text-white shadow-md transition-transform duration-100"
                      style={{
                        transform: `scale(${1 + volumeLevel * 0.15})`
                      }}
                    >
                      <Mic className="w-8 h-8" />
                    </div>
                  </div>

                  {/* Call Controls */}
                  <div className="flex items-center gap-4 pt-2">
                    <button
                      onClick={handleToggleMute}
                      className={`p-3 rounded-xl transition-colors ${
                        callState === 'muted'
                          ? 'bg-amber-600 hover:bg-amber-700 text-white'
                          : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
                      }`}
                      title={callState === 'muted' ? t.voice.unmuteMic : t.voice.muteMic}
                    >
                      {callState === 'muted' ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>

                    <button
                      onClick={handleEndBolnaCall}
                      className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center gap-2 shadow-md transition-colors"
                    >
                      <PhoneOff className="w-4 h-4" />
                      <span>{t.voice.endCall}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* CALL STATE: ERROR */}
              {callState === 'error' && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-3 text-left">
                  <div className="flex items-center gap-2 text-rose-800 text-xs font-bold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Voice session unavailable</span>
                  </div>
                  <p className="text-xs text-rose-700 leading-relaxed">
                    {callError?.message || 'Failed to initialize voice session with Bolna API.'}
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={handleRetryBolnaCall}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry</span>
                    </button>
                    <button
                      onClick={() => {
                        setCallError(null);
                        setCallState('idle');
                        setActiveMode('demo');
                      }}
                      className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-lg transition-colors"
                    >
                      Switch to Direct Voice
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  );
};

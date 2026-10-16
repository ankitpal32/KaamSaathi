import React, { useState, useEffect, useCallback } from 'react';
import { 
  Job, 
  PaymentRecord, 
  Reminder, 
  Language, 
  NavigationTab,
  PaymentMode 
} from './types';
import { JobApiService, BackendHealth } from './services/jobApi';
import { translations } from './locales/translations';
import { Navbar } from './components/Navbar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { DashboardView } from './components/DashboardView';
import { JobsView } from './components/JobsView';
import { PaymentsView } from './components/PaymentsView';
import { RemindersView } from './components/RemindersView';
import { VoiceAssistantModal } from './components/VoiceAssistantModal';
import { JobModal } from './components/JobModal';
import { RecordPaymentModal } from './components/RecordPaymentModal';
import { ReminderModal } from './components/ReminderModal';
import { CheckCircle2, Server, Database, AlertCircle, RefreshCw, Key, ShieldCheck, UserCheck } from 'lucide-react';
import { initAnonymousSession, getValidAccessToken } from './services/supabaseClient';

export default function App() {
  // 1. Core State
  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [language, setLanguage] = useState<Language>('en');

  const [jobs, setJobs] = useState<Job[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);

  // Backend Integration State
  const [backendState, setBackendState] = useState<{
    online: boolean;
    dbConfigured: boolean;
    checked: boolean;
    usingApi: boolean;
    error?: string;
  }>({
    online: false,
    dbConfigured: false,
    checked: false,
    usingApi: false,
  });
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [authToken, setAuthToken] = useState<string>(() => {
    try {
      return localStorage.getItem('supabase_auth_token') || '';
    } catch {
      return '';
    }
  });
  const [authSession, setAuthSession] = useState<{
    userId: string | null;
    isAnonymous: boolean;
    error: string | null;
  }>({
    userId: null,
    isAnonymous: true,
    error: null,
  });
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [tempTokenInput, setTempTokenInput] = useState('');

  // 2. Modals state
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [jobToEdit, setJobToEdit] = useState<Job | null>(null);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedJobForPayment, setSelectedJobForPayment] = useState<Job | null>(null);

  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; type?: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text: msg, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // 3. Load initial data from backend using anonymous or configured session
  const reloadData = useCallback(async (tokenParam?: string) => {
    setIsLoadingJobs(true);
    let apiSuccess = false;
    let isOnline = false;
    let isDbConfigured = false;
    let errMsg = '';

    try {
      const health = await JobApiService.getHealth();
      isOnline = true;
      isDbConfigured = health.database_configured;

      const activeToken = tokenParam !== undefined
        ? tokenParam
        : ((await getValidAccessToken()) || localStorage.getItem('supabase_auth_token') || '');

      if (activeToken && isDbConfigured) {
        try {
          const apiJobs = await JobApiService.getJobs(activeToken);
          setJobs(apiJobs);
          
          try {
            const apiPayments = await JobApiService.getAllPayments(activeToken);
            setPayments(apiPayments.map((p) => {
              const matchedJob = apiJobs.find((j) => j.id === p.job_id);
              return {
                id: p.id,
                jobId: p.job_id,
                customerName: matchedJob ? matchedJob.customerName : 'Customer',
                amount: Number(p.amount) || 0,
                paymentMode: p.payment_mode || 'cash',
                date: p.recorded_at ? p.recorded_at.replace('T', ' ').substring(0, 16) : new Date().toISOString(),
                notes: p.notes || '',
              };
            }));
          } catch {
            setPayments([]);
          }

          try {
            const apiReminders = await JobApiService.getReminders(activeToken);
            setReminders(apiReminders.map((r) => {
              const matchedJob = apiJobs.find((j) => j.id === r.job_id);
              return {
                id: r.id,
                jobId: r.job_id,
                customerName: matchedJob ? matchedJob.customerName : 'Service Reminder',
                task: r.task,
                dueDate: r.due_date,
                isCompleted: Boolean(r.is_completed),
                trade: r.trade || 'other',
                priority: r.priority || 'normal',
              };
            }));
          } catch {
            setReminders([]);
          }

          apiSuccess = true;
        } catch (apiErr: any) {
          errMsg = apiErr.message;
          console.warn('Backend data retrieval with session token:', apiErr.message);
        }
      }
    } catch {
      isOnline = false;
      errMsg = 'FastAPI backend unreachable at http://127.0.0.1:8000';
    } finally {
      setIsLoadingJobs(false);
    }

    setBackendState({
      online: isOnline,
      dbConfigured: isDbConfigured,
      checked: true,
      usingApi: apiSuccess,
      error: errMsg,
    });

    // When not loaded from API, keep records empty (no demo data substitution)
    if (!apiSuccess) {
      setJobs([]);
      setPayments([]);
      setReminders([]);
    }
  }, []);

  useEffect(() => {
    // Load language preference if stored
    const savedLang = localStorage.getItem('kaamsaathi_lang_v1') as Language;
    if (savedLang === 'en' || savedLang === 'bn') {
      setLanguage(savedLang);
    }

    // Automatically initialize or restore anonymous Supabase session on app launch (No-Login MVP)
    const initSession = async () => {
      const anonRes = await initAnonymousSession();
      if (anonRes.token) {
        setAuthToken(anonRes.token);
        setAuthSession({
          userId: anonRes.userId,
          isAnonymous: anonRes.isAnonymous,
          error: null,
        });
        await reloadData(anonRes.token);
      } else {
        setAuthSession({
          userId: null,
          isAnonymous: false,
          error: anonRes.error,
        });
        if (anonRes.error) {
          showToast(anonRes.error, 'error');
        }
        await reloadData('');
      }
    };

    initSession();
  }, [reloadData]);

  // Language toggle
  const handleToggleLanguage = () => {
    const nextLang: Language = language === 'en' ? 'bn' : 'en';
    setLanguage(nextLang);
    localStorage.setItem('kaamsaathi_lang_v1', nextLang);
  };

  // Refresh Data
  const handleResetData = () => {
    reloadData();
    showToast('Refreshed data from backend.', 'info');
  };

  // Job Actions
  const handleSaveJob = async (jobData: any) => {
    const activeToken = (await getValidAccessToken()) || localStorage.getItem('supabase_auth_token') || '';

    // If we have an active backend and token, persist to PostgreSQL
    if (!backendState.online) {
      showToast('FastAPI backend is offline. Cannot save job.', 'error');
      return;
    }
    if (!activeToken) {
      const errorMsg = authSession.error || 'Authentication required: Anonymous session could not be established.';
      showToast(errorMsg, 'error');
      return;
    }

    try {
      if (jobData.id && !jobData.id.startsWith('job-')) {
        const updated = await JobApiService.updateJob(jobData.id, jobData, activeToken);
        setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
        showToast(translations[language].jobs.jobUpdatedSuccess, 'success');
      } else {
        const created = await JobApiService.createJob(jobData, activeToken);
        setJobs((prev) => [created, ...prev]);
        showToast('Job confirmed and saved to Supabase PostgreSQL!', 'success');
      }
      reloadData(activeToken);
    } catch (err: any) {
      showToast(`Backend save failed: ${err.message}`, 'error');
      throw err;
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    const activeToken = (await getValidAccessToken()) || localStorage.getItem('supabase_auth_token') || '';
    if (!backendState.online) {
      showToast('Backend offline. Cannot delete job.', 'error');
      return;
    }
    if (!activeToken) {
      showToast(authSession.error || 'Authentication required to delete records.', 'error');
      return;
    }

    try {
      await JobApiService.deleteJob(jobId, activeToken);
      showToast('Job removed from PostgreSQL database.', 'info');
      reloadData(activeToken);
    } catch (err: any) {
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  };

  const handleOpenEditJob = (job: Job) => {
    setJobToEdit(job);
    setIsJobModalOpen(true);
  };

  const handleOpenNewJob = () => {
    setJobToEdit(null);
    setIsJobModalOpen(true);
  };

  // Payment Actions
  const handleOpenCollectPayment = (job?: Job) => {
    setSelectedJobForPayment(job || null);
    setIsPaymentModalOpen(true);
  };

  const handleSavePayment = async (paymentData: {
    jobId: string;
    customerName: string;
    amount: number;
    paymentMode: PaymentMode;
    notes?: string;
  }) => {
    const activeToken = (await getValidAccessToken()) || localStorage.getItem('supabase_auth_token') || '';
    if (!backendState.online) {
      showToast('Backend offline. Cannot record payment.', 'error');
      return;
    }
    if (!activeToken) {
      showToast(authSession.error || 'Authentication required: Anonymous session inactive.', 'error');
      return;
    }

    try {
      await JobApiService.recordPayment(paymentData.jobId, paymentData, activeToken);
      showToast('Payment recorded and balance reconciled on backend!', 'success');
      reloadData(activeToken);
    } catch (err: any) {
      showToast(`Payment failed: ${err.message}`, 'error');
    }
  };

  // Reminder Actions
  const handleToggleReminder = async (id: string) => {
    const activeToken = (await getValidAccessToken()) || localStorage.getItem('supabase_auth_token') || '';
    if (!backendState.online || !activeToken) {
      showToast(authSession.error || 'Authentication required to update reminders.', 'error');
      return;
    }
    try {
      await JobApiService.toggleReminder(id, undefined, activeToken);
      reloadData(activeToken);
    } catch (err: any) {
      showToast(`Toggle failed: ${err.message}`, 'error');
    }
  };

  const handleDeleteReminder = async (id: string) => {
    const activeToken = (await getValidAccessToken()) || localStorage.getItem('supabase_auth_token') || '';
    if (!backendState.online || !activeToken) {
      showToast(authSession.error || 'Authentication required to delete reminders.', 'error');
      return;
    }
    try {
      await JobApiService.deleteReminder(id, activeToken);
      showToast('Reminder deleted from database.', 'info');
      reloadData(activeToken);
    } catch (err: any) {
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  };

  const handleSaveReminder = async (reminderData: any) => {
    const activeToken = (await getValidAccessToken()) || localStorage.getItem('supabase_auth_token') || '';
    if (!backendState.online || !activeToken) {
      showToast(authSession.error || 'Authentication required to schedule reminders.', 'error');
      return;
    }
    try {
      await JobApiService.createReminder(reminderData, activeToken);
      showToast('Follow-up reminder scheduled on backend.', 'success');
      reloadData(activeToken);
    } catch (err: any) {
      showToast(`Failed to schedule reminder: ${err.message}`, 'error');
    }
  };

  // Manual token save / reset handler
  const handleSaveToken = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = tempTokenInput.trim();
    setAuthToken(cleanToken);
    if (cleanToken) {
      localStorage.setItem('supabase_auth_token', cleanToken);
      setAuthSession((prev) => ({ ...prev, error: null }));
      showToast('Custom session token configured.', 'success');
    } else {
      localStorage.removeItem('supabase_auth_token');
      showToast('Auth token cleared. Re-establishing anonymous session...', 'info');
      initAnonymousSession().then((res) => {
        if (res.token) {
          setAuthToken(res.token);
          setAuthSession({ userId: res.userId, isAnonymous: res.isAnonymous, error: null });
        }
      });
    }
    setIsTokenModalOpen(false);
    reloadData(cleanToken);
  };

  // Pending payments count badge
  const pendingPaymentCount = jobs.filter((j) => j.remainingBalance > 0).length;

  return (
    <div className="min-h-screen bg-[#fbfbf9] text-slate-900 flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Top Navigation */}
      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        language={language}
        onToggleLanguage={handleToggleLanguage}
        onResetData={handleResetData}
        pendingPaymentCount={pendingPaymentCount}
        openVoiceAssistant={() => setIsVoiceOpen(true)}
      />

      {/* Backend & Cloud Sync Status Bar */}
      <div className="bg-stone-900 text-stone-200 text-xs border-b border-stone-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 min-w-0">
            {backendState.online ? (
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold whitespace-nowrap">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <Server className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Server Connected</span>
                <span className="sm:hidden">Connected</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-400 font-medium whitespace-nowrap">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Server Offline (127.0.0.1:8000)</span>
                <span className="sm:hidden">Offline</span>
              </span>
            )}

            <span className="text-stone-700">|</span>

            {backendState.dbConfigured ? (
              <span className="flex items-center gap-1 text-stone-300 font-medium whitespace-nowrap">
                <Database className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="hidden sm:inline">Cloud Database: Connected</span>
                <span className="sm:hidden">Database: OK</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-stone-400 whitespace-nowrap">
                <Database className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Database: Awaiting .env credentials</span>
                <span className="sm:hidden">Database: Unset</span>
              </span>
            )}

            <span className="text-stone-700 hidden sm:inline">|</span>

            <span className="hidden sm:inline">
              {backendState.usingApi ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  {authSession.isAnonymous ? '● Anonymous Cloud Session' : '● Cloud Sync Active'}
                </span>
              ) : authSession.error ? (
                <span className="text-amber-300" title={authSession.error}>
                  ● Auth: {authSession.error.length > 35 ? `${authSession.error.substring(0, 35)}...` : authSession.error}
                </span>
              ) : authToken ? (
                <span className="text-rose-400">● Status: {backendState.error || 'Connection Failed'}</span>
              ) : (
                <span className="text-amber-300">● Session Inactive</span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setTempTokenInput(authToken);
                setIsTokenModalOpen(true);
              }}
              className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors border border-stone-700 whitespace-nowrap"
              title="Session Details & Local Storage Notice"
            >
              <Key className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">{authToken ? 'Cloud Session' : 'Session Info'}</span>
              <span className="sm:hidden">{authToken ? 'Session' : 'Auth'}</span>
            </button>

            <button
              onClick={() => reloadData()}
              disabled={isLoadingJobs}
              className="p-1 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg transition-colors border border-stone-700 disabled:opacity-50"
              title="Refresh status and jobs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingJobs ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 pb-24 md:pb-8">
        
        {currentTab === 'dashboard' && (
          <DashboardView
            jobs={jobs}
            payments={payments}
            reminders={reminders}
            language={language}
            isDemo={!backendState.usingApi}
            onNavigate={setCurrentTab}
            onOpenVoice={() => setIsVoiceOpen(true)}
            onOpenNewJob={handleOpenNewJob}
            onOpenCollectPayment={handleOpenCollectPayment}
            onToggleReminder={handleToggleReminder}
            onSelectJob={handleOpenEditJob}
          />
        )}

        {currentTab === 'jobs' && (
          <JobsView
            jobs={jobs}
            language={language}
            isLoading={isLoadingJobs}
            error={backendState.error}
            isDemo={!backendState.usingApi}
            onRetry={() => reloadData()}
            onOpenNewJob={handleOpenNewJob}
            onEditJob={handleOpenEditJob}
            onDeleteJob={handleDeleteJob}
            onOpenCollectPayment={handleOpenCollectPayment}
          />
        )}

        {currentTab === 'payments' && (
          <PaymentsView
            jobs={jobs}
            payments={payments}
            language={language}
            isLoading={isLoadingJobs}
            error={backendState.error}
            isDemo={!backendState.usingApi}
            onOpenCollectPayment={handleOpenCollectPayment}
          />
        )}

        {currentTab === 'reminders' && (
          <RemindersView
            reminders={reminders}
            language={language}
            isLoading={isLoadingJobs}
            error={backendState.error}
            isDemo={!backendState.usingApi}
            onToggleReminder={handleToggleReminder}
            onDeleteReminder={handleDeleteReminder}
            onOpenNewReminder={() => setIsReminderModalOpen(true)}
          />
        )}

      </main>

      {/* Mobile Bottom Navigation Bar (Handheld screens only) */}
      <MobileBottomNav
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        language={language}
        pendingPaymentCount={pendingPaymentCount}
        openVoiceAssistant={() => setIsVoiceOpen(true)}
      />

      {/* Voice Assistant Modal */}
      <VoiceAssistantModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        language={language}
        onJobCreated={() => {
          reloadData();
          showToast('Job logged via Voice Assistant!');
        }}
      />

      {/* Job Create/Edit Modal */}
      <JobModal
        isOpen={isJobModalOpen}
        onClose={() => {
          setIsJobModalOpen(false);
          setJobToEdit(null);
        }}
        language={language}
        jobToEdit={jobToEdit}
        onSave={handleSaveJob}
      />

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setSelectedJobForPayment(null);
        }}
        language={language}
        jobs={jobs}
        selectedJob={selectedJobForPayment}
        onSavePayment={handleSavePayment}
      />

      {/* New Reminder Modal */}
      <ReminderModal
        isOpen={isReminderModalOpen}
        onClose={() => setIsReminderModalOpen(false)}
        language={language}
        onSaveReminder={handleSaveReminder}
      />

      {/* Supabase Anonymous Session & Storage Notice Modal */}
      {isTokenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-4 sm:px-5 py-3.5 sm:py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-700">
                  <Key className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">KaamSaathi Cloud Session (No-Login MVP)</h3>
              </div>
              <button 
                onClick={() => setIsTokenModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveToken} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs space-y-1.5 leading-relaxed">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                  Important Data Durability Notice
                </div>
                <p>
                  KaamSaathi uses an automatic anonymous cloud session so technicians can work immediately without passwords or sign-up forms.
                </p>
                <p className="font-medium text-amber-950">
                  ⚠️ Because session tokens are saved in browser storage, clearing your browser cookies, cache, or site data will permanently reset your anonymous identity, and previously saved records will no longer be accessible.
                </p>
              </div>

              {authSession.userId && (
                <div className="p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs space-y-1">
                  <span className="font-semibold text-stone-600">Anonymous User ID:</span>
                  <div className="font-mono text-[11px] text-stone-800 break-all select-all">
                    {authSession.userId}
                  </div>
                </div>
              )}

              {authSession.error && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
                  <div className="font-bold flex items-center gap-1 text-rose-700">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Session Status Warning
                  </div>
                  <p>{authSession.error}</p>
                </div>
              )}

              <details className="text-xs text-stone-600 pt-1 border-t border-stone-100">
                <summary className="cursor-pointer font-medium text-stone-700 hover:text-stone-900 py-1">
                  Advanced: Custom Token Override
                </summary>
                <div className="mt-2 space-y-2">
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Bearer Token (JWT)
                  </label>
                  <textarea
                    rows={3}
                    value={tempTokenInput}
                    onChange={(e) => setTempTokenInput(e.target.value)}
                    placeholder="Paste manual JWT to override session..."
                    className="w-full px-3 py-2 text-[11px] font-mono bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </details>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setTempTokenInput('');
                  }}
                  className="text-xs text-rose-600 hover:text-rose-700 font-semibold"
                >
                  Clear Token
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsTokenModalOpen(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-all"
                  >
                    Apply Session
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Success / Error / Action Toast */}
      {toastMessage && (
        <div className={`fixed bottom-20 md:bottom-6 right-3 left-3 sm:left-auto sm:right-6 max-w-sm z-50 flex items-center gap-2 px-3.5 py-2.5 rounded-xl shadow-xl text-xs sm:text-sm font-semibold animate-fade-in border ${
          toastMessage.type === 'error'
            ? 'bg-rose-950 text-rose-100 border-rose-800'
            : toastMessage.type === 'info'
            ? 'bg-indigo-950 text-indigo-100 border-indigo-800'
            : 'bg-slate-900 text-white border-slate-800'
        }`}>
          {toastMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : toastMessage.type === 'info' ? (
            <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span className="truncate">{toastMessage.text}</span>
        </div>
      )}

    </div>
  );
}

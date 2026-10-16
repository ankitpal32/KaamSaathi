import React from 'react';
import { 
  Briefcase, 
  CreditCard, 
  Bell, 
  CheckCircle2, 
  Clock, 
  Plus, 
  Mic,
  Phone,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Calendar,
  IndianRupee
} from 'lucide-react';
import { Job, PaymentRecord, Reminder, Language, NavigationTab } from '../types';
import { translations } from '../locales/translations';

interface DashboardViewProps {
  jobs: Job[];
  payments: PaymentRecord[];
  reminders: Reminder[];
  language: Language;
  isDemo?: boolean;
  onNavigate: (tab: NavigationTab) => void;
  onOpenVoice: () => void;
  onOpenNewJob: () => void;
  onOpenCollectPayment: (job: Job) => void;
  onToggleReminder: (id: string) => void;
  onSelectJob: (job: Job) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  jobs,
  payments,
  reminders,
  language,
  isDemo,
  onNavigate,
  onOpenVoice,
  onOpenNewJob,
  onOpenCollectPayment,
  onToggleReminder,
  onSelectJob,
}) => {
  const t = translations[language];

  // Helper date
  const todayStr = new Date().toISOString().split('T')[0];

  // Computations strictly from real records
  const todayJobs = jobs.filter((j) => j.date === todayStr);
  const pendingDebtorJobs = jobs.filter((j) => (Number(j.remainingBalance) || 0) > 0);
  
  const totalAgreedAll = jobs.reduce((acc, curr) => acc + (Number(curr.agreedAmount) || 0), 0);
  const totalCollectedAll = jobs.reduce((acc, curr) => acc + (Number(curr.amountPaid) || 0), 0);
  const totalOutstandingUdhaar = Math.max(0, totalAgreedAll - totalCollectedAll);

  const pendingReminders = reminders.filter((r) => !r.isCompleted);
  const recentJobs = [...jobs].reverse().slice(0, 5);

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      
      {/* 1. Welcoming Header Banner (Warm white card, charcoal typography, emerald accent) */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 sm:p-7 border border-stone-200/90 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                {new Date().toLocaleDateString(language === 'bn' ? 'bn-IN' : 'en-IN', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </span>
              {isDemo && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  {language === 'bn' ? 'অফলাইন মোড' : 'Local Mode'}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
              {language === 'bn' ? 'স্বাগতম, কর্মসাথী' : 'Welcome back'}
            </h1>
            <p className="text-xs sm:text-sm text-stone-600">
              {language === 'bn'
                ? 'আজকের কাজ, বকেয়া টাকা এবং গ্রাহকের অনুস্মারক এক নজরে দেখুন।'
                : "Here is your workday overview — jobs, customer debts, and reminders."}
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 pt-1 sm:pt-0">
            <button
              onClick={onOpenNewJob}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>{t.jobs.newJob}</span>
            </button>
            <button
              onClick={onOpenVoice}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-xl border border-stone-200 active:scale-95 transition-all"
            >
              <Mic className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{language === 'bn' ? 'ভয়েস সহকারী' : 'Voice Assistant'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Four Core MVP Summary Cards (Informative, lightweight, readable contrast) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Card 1: Today's Jobs */}
        <div 
          onClick={() => onNavigate('jobs')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200/90 shadow-xs hover:border-stone-300 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold text-stone-600 uppercase tracking-wide">
              {language === 'bn' ? 'আজকের কাজ' : "Today's Jobs"}
            </span>
            <div className="w-8 h-8 rounded-lg bg-stone-100 group-hover:bg-emerald-50 group-hover:text-emerald-700 flex items-center justify-center text-stone-600 transition-colors">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-stone-900 tabular-nums">
            {todayJobs.length}
          </div>
          <p className="text-[11px] text-stone-500 mt-1 truncate">
            {todayJobs.length > 0 
              ? `${todayJobs.filter(j => j.status === 'completed').length} completed` 
              : (language === 'bn' ? 'আজ কোন কাজ নেই' : 'No jobs scheduled today')}
          </p>
        </div>

        {/* Card 2: Total Outstanding Udhaar (Key Indian Technician KPI) */}
        <div 
          onClick={() => onNavigate('payments')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200/90 shadow-xs hover:border-stone-300 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold text-stone-600 uppercase tracking-wide">
              {language === 'bn' ? 'মোট বাকি' : 'Total Udhaar'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-amber-900 tabular-nums font-mono">
            ₹{totalOutstandingUdhaar.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-stone-500 mt-1 truncate">
            {pendingDebtorJobs.length > 0 
              ? `${pendingDebtorJobs.length} customers owe money` 
              : (language === 'bn' ? 'সব পরিশোধিত' : 'All clear — no pending debt')}
          </p>
        </div>

        {/* Card 3: Collected Earnings */}
        <div 
          onClick={() => onNavigate('payments')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200/90 shadow-xs hover:border-stone-300 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold text-stone-600 uppercase tracking-wide">
              {language === 'bn' ? 'মোট উপার্জন' : 'Total Collected'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-emerald-900 tabular-nums font-mono">
            ₹{totalCollectedAll.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-stone-500 mt-1 truncate">
            {jobs.length} jobs logged total
          </p>
        </div>

        {/* Card 4: Upcoming Reminders */}
        <div 
          onClick={() => onNavigate('reminders')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200/90 shadow-xs hover:border-stone-300 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold text-stone-600 uppercase tracking-wide">
              {t.tabs.reminders}
            </span>
            <div className="w-8 h-8 rounded-lg bg-stone-100 group-hover:bg-emerald-50 group-hover:text-emerald-700 flex items-center justify-center text-stone-600 transition-colors">
              <Bell className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-stone-900 tabular-nums">
            {pendingReminders.length}
          </div>
          <p className="text-[11px] text-stone-500 mt-1 truncate">
            {pendingReminders.length > 0 
              ? `${pendingReminders.filter(r => r.priority === 'urgent').length} urgent follow-ups` 
              : (language === 'bn' ? 'কোন বকেয়া নেই' : 'All follow-ups complete')}
          </p>
        </div>

      </div>

      {/* 3. Main Dashboard Content Grid: Left (Today & Recent) + Right (Debts & Reminders) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (2 Cols): Recent & Today's Jobs */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Section: Today's Jobs or Recent Work */}
          <div className="bg-white rounded-2xl border border-stone-200/90 overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-stone-200/80 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-stone-900">
                  {todayJobs.length > 0 
                    ? (language === 'bn' ? 'আজকের কাজ' : "Today's Scheduled Work") 
                    : (language === 'bn' ? 'সাম্প্রতিক কাজের রেকর্ড' : 'Recent Work Records')}
                </h2>
                <p className="text-xs text-stone-500">
                  {todayJobs.length > 0 
                    ? `Showing ${todayJobs.length} job(s) for today` 
                    : 'Your most recent saved jobs'}
                </p>
              </div>
              <button
                onClick={() => onNavigate('jobs')}
                className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1"
              >
                <span>{language === 'bn' ? 'সব দেখুন' : 'View all'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* List */}
            <div className="divide-y divide-stone-100">
              {(todayJobs.length > 0 ? todayJobs : recentJobs).length === 0 ? (
                /* Honest Empty State */
                <div className="p-8 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 mx-auto flex items-center justify-center">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-800">
                      {language === 'bn' ? 'এখনো কোন কাজ যুক্ত করা হয়নি' : 'No jobs logged yet'}
                    </h3>
                    <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
                      {language === 'bn' 
                        ? 'আপনার প্রথম কাজটি ভয়েস সহকারী দিয়ে কথা বলে বা নিচে নতুন কাজ বাটনে ক্লিক করে লিখে রাখুন।'
                        : 'Record your first job easily by speaking to the Voice Assistant or tapping "+ New Job".'}
                    </p>
                  </div>
                  <button
                    onClick={onOpenNewJob}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-all shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t.jobs.newJob}</span>
                  </button>
                </div>
              ) : (
                (todayJobs.length > 0 ? todayJobs : recentJobs).map((job) => {
                  const remaining = Number(job.remainingBalance) || 0;
                  const isPaid = remaining <= 0;

                  return (
                    <div 
                      key={job.id} 
                      className="p-4 sm:p-5 hover:bg-stone-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 
                            onClick={() => onSelectJob(job)}
                            className="text-sm font-bold text-stone-900 hover:text-emerald-800 cursor-pointer truncate"
                          >
                            {job.customerName}
                          </h4>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 uppercase tracking-wider">
                            {job.trade}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            isPaid 
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}>
                            {isPaid 
                              ? (language === 'bn' ? 'পরিশোধিত' : 'Paid in Full')
                              : (language === 'bn' ? 'বাকি আছে' : 'Udhaar Due')}
                          </span>
                        </div>
                        <p className="text-xs text-stone-600 line-clamp-1">
                          {job.description}
                        </p>
                        <div className="flex items-center gap-3 text-[11px] text-stone-500 pt-0.5">
                          <span>{job.date}</span>
                          {job.customerPhone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-stone-400" />
                              {job.customerPhone}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right Amount & Actions */}
                      <div className="flex items-center sm:flex-col sm:items-end justify-between shrink-0 gap-1 sm:gap-0">
                        <div className="text-right">
                          <div className="text-sm font-bold text-stone-900 font-mono tabular-nums">
                            ₹{(Number(job.agreedAmount) || 0).toLocaleString('en-IN')}
                          </div>
                          {!isPaid && (
                            <div className="text-[11px] font-semibold text-amber-800 font-mono tabular-nums">
                              ₹{remaining.toLocaleString('en-IN')} due
                            </div>
                          )}
                        </div>

                        {!isPaid && (
                          <button
                            onClick={() => onOpenCollectPayment(job)}
                            className="px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200"
                          >
                            {language === 'bn' ? 'টাকা নিন' : 'Collect'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* Right Column (1 Col): Outstanding Debts & Upcoming Reminders */}
        <div className="space-y-6">
          
          {/* Outstanding Udhaar Card */}
          <div className="bg-white rounded-2xl border border-stone-200/90 overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 border-b border-stone-200/80 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-stone-900">
                  {language === 'bn' ? 'বাকি টাকার তালিকা' : 'Outstanding Balances'}
                </h3>
                <span className="text-[11px] text-stone-500">
                  {pendingDebtorJobs.length} customers owe money
                </span>
              </div>
              <button
                onClick={() => onNavigate('payments')}
                className="text-xs font-semibold text-emerald-800 hover:text-emerald-950"
              >
                {language === 'bn' ? 'সব' : 'View'}
              </button>
            </div>

            <div className="divide-y divide-stone-100 max-h-72 overflow-y-auto">
              {pendingDebtorJobs.length === 0 ? (
                <div className="p-6 text-center text-xs text-stone-500">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-1.5 opacity-80" />
                  <p className="font-semibold text-stone-800">
                    {language === 'bn' ? 'কোন বাকি নেই' : 'No outstanding balances'}
                  </p>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    All customer jobs are settled in full.
                  </p>
                </div>
              ) : (
                pendingDebtorJobs.slice(0, 5).map((job) => (
                  <div key={job.id} className="p-3.5 hover:bg-stone-50/70 transition-colors flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-stone-900 truncate">
                        {job.customerName}
                      </p>
                      <p className="text-[11px] text-stone-500 truncate">
                        {job.description}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-amber-900 font-mono tabular-nums">
                        ₹{(Number(job.remainingBalance) || 0).toLocaleString('en-IN')}
                      </div>
                      <button
                        onClick={() => onOpenCollectPayment(job)}
                        className="text-[10px] font-semibold text-emerald-800 hover:underline block ml-auto mt-0.5"
                      >
                        {language === 'bn' ? 'আদায়' : 'Collect'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Upcoming Reminders Card */}
          <div className="bg-white rounded-2xl border border-stone-200/90 overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 border-b border-stone-200/80 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-stone-900">
                  {language === 'bn' ? 'আসন্ন অনুস্মারক' : 'Upcoming Reminders'}
                </h3>
                <span className="text-[11px] text-stone-500">
                  {pendingReminders.length} pending follow-ups
                </span>
              </div>
              <button
                onClick={() => onNavigate('reminders')}
                className="text-xs font-semibold text-emerald-800 hover:text-emerald-950"
              >
                {language === 'bn' ? 'সব' : 'View'}
              </button>
            </div>

            <div className="divide-y divide-stone-100 max-h-72 overflow-y-auto">
              {pendingReminders.length === 0 ? (
                <div className="p-6 text-center text-xs text-stone-500">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-1.5 opacity-80" />
                  <p className="font-semibold text-stone-800">
                    {language === 'bn' ? 'কোন অনুস্মারক নেই' : 'No upcoming reminders'}
                  </p>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    You are all caught up on follow-ups.
                  </p>
                </div>
              ) : (
                pendingReminders.slice(0, 5).map((rem) => (
                  <div key={rem.id} className="p-3.5 hover:bg-stone-50/70 transition-colors flex items-start gap-2.5">
                    <button
                      onClick={() => onToggleReminder(rem.id)}
                      className="mt-0.5 w-4 h-4 rounded border border-stone-300 hover:border-emerald-700 flex items-center justify-center shrink-0 transition-colors"
                      title="Mark reminder completed"
                      aria-label="Mark reminder completed"
                    >
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-stone-900 line-clamp-2">
                        {rem.task}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-stone-500 mt-1">
                        <span className="flex items-center gap-1 font-mono">
                          <Calendar className="w-3 h-3 text-stone-400" />
                          {rem.dueDate}
                        </span>
                        {rem.priority === 'urgent' && (
                          <span className="text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded font-semibold">
                            Urgent
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

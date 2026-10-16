import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Phone, 
  CreditCard, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Briefcase,
  AlertCircle
} from 'lucide-react';
import { Job, Language, TradeType, JobStatus } from '../types';
import { translations } from '../locales/translations';

interface JobsViewProps {
  jobs: Job[];
  language: Language;
  isLoading?: boolean;
  error?: string;
  isDemo?: boolean;
  onRetry?: () => void;
  onOpenNewJob: () => void;
  onEditJob: (job: Job) => void;
  onDeleteJob: (jobId: string) => void;
  onOpenCollectPayment: (job: Job) => void;
}

export const JobsView: React.FC<JobsViewProps> = ({
  jobs,
  language,
  isLoading,
  error,
  isDemo,
  onRetry,
  onOpenNewJob,
  onEditJob,
  onDeleteJob,
  onOpenCollectPayment,
}) => {
  const t = translations[language];

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | JobStatus>('all');
  const [tradeFilter, setTradeFilter] = useState<'all' | TradeType>('all');

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        job.customerName.toLowerCase().includes(query) ||
        job.description.toLowerCase().includes(query) ||
        (job.customerPhone && job.customerPhone.includes(query)) ||
        (job.notes && job.notes.toLowerCase().includes(query));

      const matchesStatus =
        statusFilter === 'all' || job.status === statusFilter;

      const matchesTrade =
        tradeFilter === 'all' || job.trade === tradeFilter;

      return matchesSearch && matchesStatus && matchesTrade;
    });
  }, [jobs, searchQuery, statusFilter, tradeFilter]);

  const handleDeleteConfirm = (job: Job) => {
    if (window.confirm(`${t.jobs.confirmDelete} (${job.customerName})`)) {
      onDeleteJob(job.id);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
              {t.jobs.title}
            </h1>
            {isDemo && (
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-amber-50 text-amber-800 rounded-full border border-amber-200">
                {language === 'bn' ? 'অফলাইন' : 'Local Mode'}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-stone-600 mt-1">
            {t.jobs.subtitle}
          </p>
        </div>
        <button
          onClick={onOpenNewJob}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs active:scale-95 transition-all self-start sm:self-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{t.jobs.newJob}</span>
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-rose-800 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-3 py-1 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Loading state indicator */}
      {isLoading && (
        <div className="p-3 bg-stone-100 border border-stone-200 rounded-xl flex items-center gap-2 text-stone-700 text-xs animate-pulse">
          <Clock className="w-4 h-4 animate-spin text-emerald-700" />
          <span>Synchronizing records with backend...</span>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200/90 space-y-3 shadow-xs">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.jobs.searchPlaceholder}
            className="w-full pl-10 pr-4 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 transition-colors"
          />
        </div>

        {/* Filter Controls: Segmented control */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          
          {/* Status Tabs */}
          <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg overflow-x-auto max-w-full">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                statusFilter === 'all'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {t.jobs.allStatuses}
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                statusFilter === 'pending'
                  ? 'bg-white text-rose-800 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {t.jobs.pending}
            </button>
            <button
              onClick={() => setStatusFilter('partially_paid')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                statusFilter === 'partially_paid'
                  ? 'bg-white text-amber-800 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {t.jobs.partiallyPaid}
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                statusFilter === 'completed'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {t.jobs.completed}
            </button>
          </div>

          {/* Trade Filter Dropdown */}
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <span className="text-xs font-semibold text-stone-500 whitespace-nowrap">
              Trade:
            </span>
            <select
              value={tradeFilter}
              onChange={(e) => setTradeFilter(e.target.value as any)}
              className="text-xs font-semibold bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-stone-700"
            >
              <option value="all">All Trades</option>
              <option value="electrical">{t.trades.electrical}</option>
              <option value="plumbing">{t.trades.plumbing}</option>
              <option value="appliance">{t.trades.appliance}</option>
              <option value="other">{t.trades.other}</option>
            </select>
          </div>

        </div>
      </div>

      {/* Jobs Ledger List */}
      <div className="bg-white rounded-xl border border-stone-200/90 overflow-hidden divide-y divide-stone-100 shadow-xs">
        {filteredJobs.map((job) => {
          const remaining = Number(job.remainingBalance) || 0;
          const isPaid = remaining <= 0;

          return (
            <div
              key={job.id}
              className="p-4 sm:p-5 hover:bg-stone-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4"
            >
              {/* Left Info */}
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center flex-wrap gap-2 text-xs text-stone-500">
                  <span className="font-bold text-stone-900 text-sm sm:text-base">
                    {job.customerName}
                  </span>
                  <span aria-hidden="true" className="text-stone-300">·</span>
                  <span className="font-semibold text-emerald-800 capitalize bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                    {t.trades[job.trade] || job.trade}
                  </span>
                  <span aria-hidden="true" className="text-stone-300">·</span>
                  <span className="font-mono tabular-nums text-stone-500">
                    {job.date}
                  </span>
                  {job.customerPhone && (
                    <>
                      <span aria-hidden="true" className="text-stone-300">·</span>
                      <a
                        href={`tel:${job.customerPhone}`}
                        className="inline-flex items-center gap-1 text-stone-600 hover:text-emerald-800 font-mono"
                      >
                        <Phone className="w-3 h-3 text-stone-400" />
                        <span>{job.customerPhone}</span>
                      </a>
                    </>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-stone-700 line-clamp-2">
                  {job.description}
                </p>

                {job.notes && (
                  <p className="text-[11px] text-stone-500 italic">
                    Note: {job.notes}
                  </p>
                )}

                {/* Financial Math Row */}
                <div className="flex items-center flex-wrap gap-2 pt-1 text-xs font-mono tabular-nums">
                  <span className="bg-stone-100 text-stone-700 px-2 py-0.5 rounded">
                    Agreed: <strong className="text-stone-900">₹{(Number(job.agreedAmount) || 0).toLocaleString('en-IN')}</strong>
                  </span>
                  <span className="bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded font-semibold border border-emerald-100">
                    Paid: ₹{(Number(job.amountPaid) || 0).toLocaleString('en-IN')}
                  </span>
                  <span className={`px-2 py-0.5 rounded ${
                    remaining > 0 ? 'bg-amber-50 text-amber-900 font-bold border border-amber-200' : 'bg-stone-50 text-stone-500'
                  }`}>
                    Balance: ₹{remaining.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Right Status & Actions */}
              <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-center gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                
                {/* Status Indicator */}
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                  isPaid
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : job.status === 'partially_paid'
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {isPaid
                    ? (language === 'bn' ? 'পরিশোধিত' : 'Completed')
                    : job.status === 'partially_paid'
                    ? (language === 'bn' ? 'আংশিক বাকি' : 'Partially Paid')
                    : (language === 'bn' ? 'বকেয়া আছে' : 'Pending Payment')}
                </span>

                {/* Action Buttons */}
                <div className="flex items-center gap-1.5">
                  {remaining > 0 && (
                    <button
                      onClick={() => onOpenCollectPayment(job)}
                      className="px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200 flex items-center gap-1"
                      title="Record payment"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>{language === 'bn' ? 'টাকা নিন' : 'Collect'}</span>
                    </button>
                  )}
                  
                  <button
                    onClick={() => onEditJob(job)}
                    className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
                    title={t.jobs.editJob}
                    aria-label={t.jobs.editJob}
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteConfirm(job)}
                    className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title={t.jobs.deleteJob}
                    aria-label={t.jobs.deleteJob}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

              </div>
            </div>
          );
        })}

        {filteredJobs.length === 0 && (
          <div className="py-16 text-center text-stone-400">
            <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-40 text-stone-500" />
            <p className="text-sm font-semibold text-stone-700">
              {t.jobs.noJobsFound}
            </p>
            <p className="text-xs text-stone-400 mt-1">
              Try adjusting your search terms or filter selection.
            </p>
          </div>
        )}
      </div>

    </div>
  );
};

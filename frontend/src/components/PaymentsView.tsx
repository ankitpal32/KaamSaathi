import React, { useState } from 'react';
import { 
  CreditCard, 
  ArrowDownRight, 
  CheckCircle2, 
  Plus, 
  Search,
  Wallet,
  Smartphone,
  Building,
  Clock,
  AlertCircle
} from 'lucide-react';
import { Job, PaymentRecord, Language } from '../types';
import { translations } from '../locales/translations';

interface PaymentsViewProps {
  jobs: Job[];
  payments: PaymentRecord[];
  language: Language;
  isLoading?: boolean;
  error?: string;
  isDemo?: boolean;
  onOpenCollectPayment: (job?: Job) => void;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({
  jobs,
  payments,
  language,
  isLoading,
  error,
  isDemo,
  onOpenCollectPayment,
}) => {
  const t = translations[language];
  const [customerSearch, setCustomerSearch] = useState('');

  // JavaScript arithmetic calculations
  const totalAgreed = jobs.reduce((sum, j) => sum + (Number(j.agreedAmount) || 0), 0);
  const totalCollected = jobs.reduce((sum, j) => sum + (Number(j.amountPaid) || 0), 0);
  const totalOutstandingBalance = Math.max(0, totalAgreed - totalCollected);

  // Filter customers with balances
  const customersWithDues = jobs.filter(
    (j) => (Number(j.remainingBalance) || 0) > 0 &&
      (j.customerName.toLowerCase().includes(customerSearch.toLowerCase()) ||
       j.description.toLowerCase().includes(customerSearch.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
              {t.payments.title}
            </h1>
            {isDemo && (
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-amber-50 text-amber-800 rounded-full border border-amber-200">
                {language === 'bn' ? 'অফলাইন' : 'Local Mode'}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-stone-600 mt-1">
            {t.payments.subtitle}
          </p>
        </div>
        <button
          onClick={() => onOpenCollectPayment()}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs active:scale-95 transition-all self-start sm:self-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{t.payments.recordPayment}</span>
        </button>
      </div>

      {/* 3 Metric Cards with Strict Arithmetic */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        
        {/* Total Billed */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/90 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-600 uppercase tracking-wider">
              {t.quickStats.totalAgreed}
            </span>
            <div className="w-8 h-8 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-stone-900 font-mono tabular-nums">
              ₹{totalAgreed.toLocaleString('en-IN')}
            </span>
            <span className="block text-xs text-stone-500 mt-1 truncate">
              Across {jobs.length} recorded work orders
            </span>
          </div>
        </div>

        {/* Total Collected */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/90 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-600 uppercase tracking-wider">
              {t.quickStats.totalCollected}
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-emerald-900 font-mono tabular-nums">
              ₹{totalCollected.toLocaleString('en-IN')}
            </span>
            <span className="block text-xs text-stone-500 mt-1 font-mono tabular-nums truncate">
              {totalAgreed > 0 ? Math.round((totalCollected / totalAgreed) * 100) : 0}% collection rate
            </span>
          </div>
        </div>

        {/* Total Outstanding (Udhaar) */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/90 shadow-xs sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-600 uppercase tracking-wider">
              {t.quickStats.outstandingUdhaar}
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center shrink-0">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-amber-900 font-mono tabular-nums">
              ₹{totalOutstandingBalance.toLocaleString('en-IN')}
            </span>
            <span className="block text-xs text-stone-500 mt-1 font-mono tabular-nums truncate">
              {customersWithDues.length} customers with remaining dues
            </span>
          </div>
        </div>

      </div>

      {/* Main Split: Customers with Outstanding Dues + Payment History Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Customers with Dues (7 cols on lg) */}
        <div className="lg:col-span-7 bg-white p-4 sm:p-6 rounded-2xl border border-stone-200/90 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-stone-900">
                {language === 'bn' ? 'বকেয়া খাতা (উধার)' : 'Customer Credit Ledger'}
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Customers with remaining balances to collect
              </p>
            </div>
            
            <div className="relative w-full sm:w-auto">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Search debtor..."
                className="pl-8 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 w-full sm:w-48 text-stone-800"
              />
            </div>
          </div>

          <div className="divide-y divide-stone-100">
            {customersWithDues.map((job) => (
              <div
                key={job.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 hover:bg-stone-50/70 px-2 rounded-lg transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-stone-900 truncate">
                      {job.customerName}
                    </span>
                    <span className="text-xs text-stone-300">·</span>
                    <span className="text-xs font-semibold text-emerald-800 capitalize shrink-0">
                      {t.trades[job.trade]}
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 truncate mt-0.5">
                    {job.description}
                  </p>
                  <div className="flex items-center flex-wrap gap-2 text-[11px] text-stone-500 mt-1 font-mono tabular-nums">
                    <span>Agreed: ₹{(Number(job.agreedAmount) || 0).toLocaleString('en-IN')}</span>
                    <span>·</span>
                    <span className="text-emerald-800 font-semibold">Paid: ₹{(Number(job.amountPaid) || 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                  <div className="text-left sm:text-right">
                    <span className="text-base font-bold text-amber-900 font-mono tabular-nums block">
                      ₹{(Number(job.remainingBalance) || 0).toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] text-stone-500 block sm:hidden">Balance</span>
                  </div>
                  <button
                    onClick={() => onOpenCollectPayment(job)}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs transition-colors whitespace-nowrap"
                  >
                    {language === 'bn' ? 'টাকা নিন' : 'Collect'}
                  </button>
                </div>
              </div>
            ))}

            {customersWithDues.length === 0 && (
              <div className="py-12 text-center text-stone-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2 opacity-80" />
                <p className="text-xs font-bold text-stone-800">
                  No outstanding balances!
                </p>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  All recorded customer jobs have been settled in full.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Recent Payment Records Feed (5 cols on lg) */}
        <div className="lg:col-span-5 bg-white p-4 sm:p-6 rounded-2xl border border-stone-200/90 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{t.payments.recentTransactions}</span>
            </h2>
            <span className="text-xs font-mono tabular-nums text-stone-500">
              {payments.length} receipts
            </span>
          </div>

          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
            {payments.map((p) => (
              <div
                key={p.id}
                className="p-3 bg-stone-50/80 border border-stone-200/80 rounded-xl flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    p.paymentMode === 'upi'
                      ? 'bg-purple-50 text-purple-700 border border-purple-200'
                      : p.paymentMode === 'cash'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    {p.paymentMode === 'upi' ? (
                      <Smartphone className="w-4 h-4" />
                    ) : (
                      <Wallet className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-stone-900 block truncate">
                      {p.customerName}
                    </span>
                    <span className="text-[11px] text-stone-500 flex items-center gap-1.5 mt-0.5">
                      <span className="uppercase font-semibold text-[10px] text-stone-600">{p.paymentMode}</span>
                      <span>·</span>
                      <span className="font-mono tabular-nums">{p.date ? p.date.substring(0, 10) : ''}</span>
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-sm font-bold text-emerald-800 font-mono tabular-nums block">
                    +₹{(Number(p.amount) || 0).toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-stone-500 font-medium">Received</span>
                </div>
              </div>
            ))}

            {payments.length === 0 && (
              <div className="py-12 text-center text-stone-400">
                <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-40 text-stone-500" />
                <p className="text-xs text-stone-600">{t.payments.noTransactions}</p>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

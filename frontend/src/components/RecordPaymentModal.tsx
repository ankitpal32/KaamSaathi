import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Smartphone, Wallet, Building } from 'lucide-react';
import { Job, PaymentMode, Language } from '../types';
import { translations } from '../locales/translations';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  jobs: Job[];
  selectedJob?: Job | null;
  onSavePayment: (paymentData: {
    jobId: string;
    customerName: string;
    amount: number;
    paymentMode: PaymentMode;
    notes?: string;
  }) => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  language,
  jobs,
  selectedJob,
  onSavePayment,
}) => {
  const t = translations[language];

  // Eligible jobs with unpaid balances
  const jobsWithBalances = jobs.filter((j) => (Number(j.remainingBalance) || 0) > 0);

  const [targetJobId, setTargetJobId] = useState<string>('');
  const [amount, setAmount] = useState<number | ''>('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('upi');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (selectedJob && (Number(selectedJob.remainingBalance) || 0) > 0) {
      setTargetJobId(selectedJob.id);
      setAmount(selectedJob.remainingBalance);
    } else if (jobsWithBalances.length > 0) {
      setTargetJobId(jobsWithBalances[0].id);
      setAmount(jobsWithBalances[0].remainingBalance);
    } else {
      setTargetJobId('');
      setAmount('');
    }
    setError('');
    setNotes('');
    setConfirmed(false);
  }, [selectedJob, isOpen]);

  // Active target job
  const activeJob = jobs.find((j) => j.id === targetJobId);
  const remainingMax = activeJob ? Number(activeJob.remainingBalance) || 0 : 0;

  const handleJobSelect = (id: string) => {
    setTargetJobId(id);
    const chosen = jobs.find((j) => j.id === id);
    if (chosen) {
      setAmount(chosen.remainingBalance);
    }
    setError('');
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!activeJob) {
      setError('Please select an active job with an unpaid balance.');
      return;
    }

    const numericAmount = Number(amount) || 0;
    if (numericAmount <= 0) {
      setError('Payment amount must be greater than zero.');
      return;
    }

    if (numericAmount > remainingMax) {
      setError(`${t.payments.exceedsBalanceWarning}₹${remainingMax.toLocaleString('en-IN')}`);
      return;
    }

    onSavePayment({
      jobId: activeJob.id,
      customerName: activeJob.customerName,
      amount: numericAmount,
      paymentMode,
      notes: notes.trim() || `Collected via ${paymentMode.toUpperCase()}`,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/60 backdrop-blur-xs animate-fade-in">
      <div 
        className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-modal-title"
      >
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between shrink-0">
          <h2 id="payment-modal-title" className="text-base font-bold text-stone-900">
            {t.payments.recordPayment}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Job Selection */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Select Customer & Job *
            </label>
            {jobsWithBalances.length > 0 ? (
              <select
                value={targetJobId}
                onChange={(e) => handleJobSelect(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none text-stone-900"
                required
              >
                {jobsWithBalances.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.customerName} - {j.description} (Due: ₹{(Number(j.remainingBalance) || 0).toLocaleString('en-IN')})
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                All recorded customer jobs are settled in full.
              </p>
            )}
          </div>

          {activeJob && (
            <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs space-y-1">
              <div className="flex justify-between text-stone-500">
                <span>Agreed Total:</span>
                <span className="font-mono tabular-nums text-stone-700 font-semibold">
                  ₹{(Number(activeJob.agreedAmount) || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between text-stone-500">
                <span>Previously Collected:</span>
                <span className="font-mono tabular-nums text-emerald-800 font-semibold">
                  ₹{(Number(activeJob.amountPaid) || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-stone-200 font-bold">
                <span className="text-stone-800">Remaining Balance:</span>
                <span className="font-mono tabular-nums text-amber-800">
                  ₹{remainingMax.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          )}

          {/* Payment Amount */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-stone-700">
                {t.payments.amountToCollect} *
              </label>
              {activeJob && remainingMax > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(remainingMax)}
                  className="text-[11px] font-semibold text-emerald-800 hover:text-emerald-950"
                >
                  Pay Full (₹{remainingMax.toLocaleString('en-IN')})
                </button>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2 text-stone-400 font-medium">₹</span>
              <input
                type="number"
                min="1"
                max={remainingMax || undefined}
                value={amount}
                onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="500"
                className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-stone-300 rounded-xl font-mono tabular-nums focus:ring-2 focus:ring-emerald-600 focus:outline-none text-stone-900"
                required
              />
            </div>
          </div>

          {/* Payment Mode Selector */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              {t.payments.paymentMode} *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMode('upi')}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                  paymentMode === 'upi'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs'
                    : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                <Smartphone className="w-4 h-4 text-purple-600" />
                <span>UPI (GPay)</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMode('cash')}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                  paymentMode === 'cash'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs'
                    : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                <Wallet className="w-4 h-4 text-emerald-700" />
                <span>Cash</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMode('bank_transfer')}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                  paymentMode === 'bank_transfer'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs'
                    : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                <Building className="w-4 h-4 text-blue-600" />
                <span>Bank</span>
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Transaction Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. PhonePe transaction reference / cash handed on site"
              className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none text-stone-900"
            />
          </div>

          {/* Confirmation & Financial Verification Card */}
          {activeJob && Number(amount) > 0 && (
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
              <div className="text-[11px] font-bold text-emerald-950 flex items-center justify-between">
                <span>Payment Verification Read-back</span>
                <span className="font-mono text-xs">₹{Number(amount).toLocaleString('en-IN')}</span>
              </div>
              <p className="text-xs text-emerald-900 leading-relaxed">
                Recording <strong>₹{Number(amount).toLocaleString('en-IN')}</strong> ({paymentMode.toUpperCase()}) for <strong>{activeJob.customerName}</strong>. 
                Remaining balance will update from ₹{remainingMax.toLocaleString('en-IN')} to <strong>₹{Math.max(0, remainingMax - (Number(amount) || 0)).toLocaleString('en-IN')}</strong>.
              </p>
              <label className="flex items-center gap-2 pt-1 text-xs font-semibold text-emerald-950 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="rounded border-emerald-400 text-emerald-700 focus:ring-emerald-600 h-4 w-4"
                />
                <span>I confirm receipt of this payment and agree to update the ledger.</span>
              </label>
            </div>
          )}

          <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 pt-3 border-t border-stone-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-stone-600 hover:text-stone-900 rounded-xl transition-colors"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={jobsWithBalances.length === 0 || !confirmed}
              className="px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4 shrink-0" />
              <span>Record Payment</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

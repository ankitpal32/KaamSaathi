import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { Job, TradeType, Language } from '../types';
import { translations } from '../locales/translations';

interface JobModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  jobToEdit?: Job | null;
  onSave: (jobData: any) => void;
}

export const JobModal: React.FC<JobModalProps> = ({
  isOpen,
  onClose,
  language,
  jobToEdit,
  onSave,
}) => {
  const t = translations[language];

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [trade, setTrade] = useState<TradeType>('electrical');
  const [description, setDescription] = useState('');
  const [agreedAmount, setAgreedAmount] = useState<number | ''>('');
  const [amountPaid, setAmountPaid] = useState<number | ''>(0);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (jobToEdit) {
      setCustomerName(jobToEdit.customerName);
      setCustomerPhone(jobToEdit.customerPhone || '');
      setTrade(jobToEdit.trade);
      setDescription(jobToEdit.description);
      setAgreedAmount(jobToEdit.agreedAmount);
      setAmountPaid(jobToEdit.amountPaid);
      setDate(jobToEdit.date);
      setNotes(jobToEdit.notes || '');
      setConfirmed(true);
    } else {
      setCustomerName('');
      setCustomerPhone('');
      setTrade('electrical');
      setDescription('');
      setAgreedAmount('');
      setAmountPaid(0);
      setDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      setConfirmed(false);
    }
    setError('');
    setIsSubmitting(false);
  }, [jobToEdit, isOpen]);

  if (!isOpen) return null;

  const numericAgreed = Number(agreedAmount) || 0;
  const numericPaid = Number(amountPaid) || 0;
  const remainingBalance = Math.max(0, numericAgreed - numericPaid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!customerName.trim()) {
      setError('Please enter a customer name.');
      return;
    }

    if (numericAgreed <= 0) {
      setError('Agreed amount must be greater than zero.');
      return;
    }

    if (numericPaid > numericAgreed) {
      setError('Amount paid cannot exceed the agreed amount.');
      return;
    }

    if (!confirmed) {
      setError('Please confirm that you have verified all job and payment details before saving.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        ...(jobToEdit ? { id: jobToEdit.id } : {}),
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || '+91 98000 00000',
        trade,
        description: description.trim() || `${trade} repair service`,
        agreedAmount: numericAgreed,
        amountPaid: numericPaid,
        date,
        notes: notes.trim(),
        confirmed: true,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save job.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/60 backdrop-blur-xs animate-fade-in">
      <div 
        className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-modal-title"
      >
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between shrink-0">
          <h2 id="job-modal-title" className="text-base font-bold text-stone-900">
            {jobToEdit ? t.jobs.editJob : t.jobs.newJob}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                {t.jobs.customer} *
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Ramesh Babu"
                className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none text-stone-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                {t.jobs.phone}
              </label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+91 98301 00000"
                className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none font-mono text-stone-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                {t.jobs.trade} *
              </label>
              <select
                value={trade}
                onChange={(e) => setTrade(e.target.value as TradeType)}
                className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none text-stone-900"
              >
                <option value="electrical">{t.trades.electrical}</option>
                <option value="plumbing">{t.trades.plumbing}</option>
                <option value="appliance">{t.trades.appliance}</option>
                <option value="other">{t.trades.other}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                {t.jobs.date} *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none font-mono text-stone-900"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {t.jobs.description} *
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Ceiling fan motor rewinding & bearing repair"
              className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none text-stone-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                {t.jobs.agreedAmount} *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-stone-400 font-medium">₹</span>
                <input
                  type="number"
                  min="1"
                  value={agreedAmount}
                  onChange={(e) => setAgreedAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="1200"
                  className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-stone-300 rounded-xl font-mono tabular-nums focus:ring-2 focus:ring-emerald-600 focus:outline-none text-stone-900"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                {t.jobs.amountPaid}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-stone-400 font-medium">₹</span>
                <input
                  type="number"
                  min="0"
                  max={numericAgreed || undefined}
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-stone-300 rounded-xl font-mono tabular-nums focus:ring-2 focus:ring-emerald-600 focus:outline-none text-stone-900"
                />
              </div>
            </div>
          </div>

          {/* Balance display */}
          <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between text-xs">
            <span className="text-stone-600 font-medium">Remaining Customer Udhaar:</span>
            <span className={`font-mono font-bold text-base tabular-nums ${
              remainingBalance > 0 ? 'text-amber-800' : 'text-emerald-800'
            }`}>
              ₹{remainingBalance.toLocaleString('en-IN')}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Notes / Special Instructions
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Customer promised remaining payment on Friday evening."
              className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none text-stone-900"
            />
          </div>

          {/* User Confirmation Checkbox */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-start gap-2.5">
            <input
              type="checkbox"
              id="confirmJobDetails"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-stone-300 text-emerald-700 focus:ring-emerald-600 cursor-pointer"
            />
            <label htmlFor="confirmJobDetails" className="text-xs text-stone-700 cursor-pointer select-none leading-relaxed">
              <span className="font-semibold text-stone-900 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 inline" />
                Confirm job details
              </span>
              I have verified the customer name, trade scope, and agreed amount (₹{numericAgreed || 0}).
            </label>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 pt-3 border-t border-stone-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-stone-600 hover:text-stone-900 rounded-xl transition-colors disabled:opacity-50"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !confirmed}
              className="px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{t.common.save}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

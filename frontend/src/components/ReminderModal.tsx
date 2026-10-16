import React, { useState } from 'react';
import { X, Check, Bell, AlertCircle } from 'lucide-react';
import { TradeType, Language } from '../types';
import { translations } from '../locales/translations';

interface ReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  onSaveReminder: (reminderData: {
    customerName: string;
    customerPhone?: string;
    task: string;
    dueDate: string;
    trade: TradeType;
    priority?: 'normal' | 'urgent';
  }) => void;
}

export const ReminderModal: React.FC<ReminderModalProps> = ({
  isOpen,
  onClose,
  language,
  onSaveReminder,
}) => {
  const t = translations[language];

  // Helper date function
  const getOffsetDate = (days: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [task, setTask] = useState('');
  const [dueDate, setDueDate] = useState(getOffsetDate(1)); // default tomorrow
  const [trade, setTrade] = useState<TradeType>('electrical');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!customerName.trim()) {
      setError('Please provide a customer name.');
      return;
    }

    if (!task.trim()) {
      setError('Please describe the follow-up task or reason.');
      return;
    }

    if (!dueDate) {
      setError('Please select a due date.');
      return;
    }

    onSaveReminder({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      task: task.trim(),
      dueDate,
      trade,
      priority,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/60 backdrop-blur-xs animate-fade-in">
      <div 
        className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reminder-modal-title"
      >
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between shrink-0">
          <h2 id="reminder-modal-title" className="text-base font-bold text-stone-900 flex items-center gap-2">
            <Bell className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{t.reminders.addReminder}</span>
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

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Customer Name *
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Priya Roy"
              className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none text-stone-900"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Customer Phone
            </label>
            <input
              type="text"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="+91 98000 00000"
              className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none font-mono text-stone-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Related Trade *
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
              Follow-up Task Description *
            </label>
            <textarea
              rows={2}
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="e.g. Call customer for warranty check on split AC cooling"
              className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none text-stone-900"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-stone-700">
                Due Date *
              </label>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800">
                <button
                  type="button"
                  onClick={() => setDueDate(getOffsetDate(0))}
                  className="hover:underline"
                >
                  Today
                </button>
                <span className="text-stone-300">·</span>
                <button
                  type="button"
                  onClick={() => setDueDate(getOffsetDate(1))}
                  className="hover:underline"
                >
                  Tomorrow
                </button>
                <span className="text-stone-300">·</span>
                <button
                  type="button"
                  onClick={() => setDueDate(getOffsetDate(3))}
                  className="hover:underline"
                >
                  +3 Days
                </button>
              </div>
            </div>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-xl font-mono focus:ring-2 focus:ring-emerald-600 focus:outline-none text-stone-900"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Priority
            </label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-stone-700 cursor-pointer">
                <input
                  type="radio"
                  name="priority"
                  value="normal"
                  checked={priority === 'normal'}
                  onChange={() => setPriority('normal')}
                  className="text-emerald-700 focus:ring-emerald-600"
                />
                <span>Normal</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs text-stone-700 cursor-pointer">
                <input
                  type="radio"
                  name="priority"
                  value="urgent"
                  checked={priority === 'urgent'}
                  onChange={() => setPriority('urgent')}
                  className="text-rose-600 focus:ring-rose-500"
                />
                <span className="font-semibold text-rose-800">Urgent</span>
              </label>
            </div>
          </div>

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
              className="px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4 shrink-0" />
              <span>{t.common.save}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

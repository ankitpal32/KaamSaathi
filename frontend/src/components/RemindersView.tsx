import React, { useState } from 'react';
import { 
  Bell, 
  Plus, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  Phone, 
  AlertCircle,
  Calendar,
  Info
} from 'lucide-react';
import { Reminder, Language, TradeType } from '../types';
import { translations } from '../locales/translations';

interface RemindersViewProps {
  reminders: Reminder[];
  language: Language;
  isLoading?: boolean;
  error?: string;
  isDemo?: boolean;
  onToggleReminder: (id: string) => void;
  onDeleteReminder: (id: string) => void;
  onOpenNewReminder: () => void;
}

export const RemindersView: React.FC<RemindersViewProps> = ({
  reminders,
  language,
  isLoading,
  error,
  isDemo,
  onToggleReminder,
  onDeleteReminder,
  onOpenNewReminder,
}) => {
  const t = translations[language];
  const [filterSection, setFilterSection] = useState<'all' | 'today' | 'upcoming' | 'completed'>('all');

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredReminders = reminders.filter((r) => {
    if (filterSection === 'today') return r.dueDate === todayStr && !r.isCompleted;
    if (filterSection === 'upcoming') return r.dueDate > todayStr && !r.isCompleted;
    if (filterSection === 'completed') return r.isCompleted;
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
              {t.reminders.title}
            </h1>
            {isDemo && (
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-amber-50 text-amber-800 rounded-full border border-amber-200">
                {language === 'bn' ? 'অফলাইন' : 'Local Mode'}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-stone-600 mt-1">
            {t.reminders.subtitle}
          </p>
        </div>
        <button
          onClick={onOpenNewReminder}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs active:scale-95 transition-all self-start sm:self-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{t.reminders.addReminder}</span>
        </button>
      </div>

      {/* Helpful Info Note */}
      <div className="p-3.5 bg-stone-100 border border-stone-200 rounded-xl flex items-start gap-2.5 text-xs text-stone-700">
        <Info className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">{t.reminders.disclaimer}</span>
          <p className="text-stone-500 text-[11px] mt-0.5">
            KaamSaathi keeps track of all your customer follow-ups and service visits securely on your ledger.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg max-w-full overflow-x-auto">
        <button
          onClick={() => setFilterSection('all')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
            filterSection === 'all'
              ? 'bg-white text-stone-900 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          {t.common.all} ({reminders.length})
        </button>
        <button
          onClick={() => setFilterSection('today')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
            filterSection === 'today'
              ? 'bg-white text-rose-800 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          {t.reminders.today} ({reminders.filter((r) => r.dueDate === todayStr && !r.isCompleted).length})
        </button>
        <button
          onClick={() => setFilterSection('upcoming')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
            filterSection === 'upcoming'
              ? 'bg-white text-emerald-800 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          {t.reminders.upcoming} ({reminders.filter((r) => r.dueDate > todayStr && !r.isCompleted).length})
        </button>
        <button
          onClick={() => setFilterSection('completed')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
            filterSection === 'completed'
              ? 'bg-white text-stone-900 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          {t.reminders.completed} ({reminders.filter((r) => r.isCompleted).length})
        </button>
      </div>

      {/* Reminders List */}
      <div className="bg-white rounded-2xl border border-stone-200/90 divide-y divide-stone-100 shadow-xs overflow-hidden">
        {filteredReminders.map((rem) => {
          const isToday = rem.dueDate === todayStr;
          const isPast = rem.dueDate < todayStr && !rem.isCompleted;

          return (
            <div
              key={rem.id}
              className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 transition-colors ${
                rem.isCompleted ? 'bg-stone-50/50' : 'hover:bg-stone-50/60'
              }`}
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={rem.isCompleted}
                  onChange={() => onToggleReminder(rem.id)}
                  className="mt-1 w-5 h-5 rounded text-emerald-700 focus:ring-emerald-600 cursor-pointer shrink-0 border-stone-300"
                  aria-label="Toggle completed"
                />
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center flex-wrap gap-2 text-xs">
                    <span className="font-bold text-stone-900 text-sm truncate">
                      {rem.customerName}
                    </span>
                    <span className="text-stone-300">·</span>
                    <span className="capitalize font-semibold text-emerald-800 shrink-0 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                      {t.trades[rem.trade] || rem.trade}
                    </span>
                    <span className="text-stone-300">·</span>
                    <span className={`font-mono tabular-nums font-semibold flex items-center gap-1 ${
                      isPast 
                        ? 'text-rose-700' 
                        : isToday 
                        ? 'text-amber-800' 
                        : 'text-stone-500'
                    }`}>
                      <Calendar className="w-3 h-3 shrink-0" />
                      {rem.dueDate}
                      {isToday && ' (Today)'}
                      {isPast && ' (Overdue)'}
                    </span>
                  </div>

                  <p className={`text-xs sm:text-sm ${
                    rem.isCompleted ? 'line-through text-stone-400' : 'text-stone-800'
                  }`}>
                    {rem.task}
                  </p>

                  {rem.customerPhone && (
                    <a
                      href={`tel:${rem.customerPhone}`}
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-stone-500 hover:text-emerald-800 pt-0.5"
                    >
                      <Phone className="w-3 h-3 text-stone-400" />
                      <span>{rem.customerPhone}</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                <button
                  onClick={() => onToggleReminder(rem.id)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    rem.isCompleted
                      ? 'text-stone-600 hover:bg-stone-200'
                      : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                >
                  {rem.isCompleted ? t.reminders.reopen : t.reminders.markDone}
                </button>

                <button
                  onClick={() => onDeleteReminder(rem.id)}
                  className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title={t.reminders.delete}
                  aria-label={t.reminders.delete}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {filteredReminders.length === 0 && (
          <div className="py-16 text-center text-stone-400">
            <Bell className="w-10 h-10 mx-auto mb-3 opacity-40 text-stone-500" />
            <p className="text-sm font-semibold text-stone-700">
              {t.reminders.noReminders}
            </p>
            <button
              onClick={onOpenNewReminder}
              className="mt-3 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg inline-flex items-center gap-1.5 border border-emerald-200"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.reminders.addReminder}</span>
            </button>
          </div>
        )}
      </div>

    </div>
  );
};

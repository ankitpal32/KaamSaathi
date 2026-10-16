import React from 'react';
import { 
  Wrench, 
  RotateCcw, 
  Languages, 
  Mic, 
  LayoutDashboard, 
  Briefcase, 
  CreditCard, 
  Bell 
} from 'lucide-react';
import { Language, NavigationTab } from '../types';
import { translations } from '../locales/translations';

interface NavbarProps {
  currentTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  language: Language;
  onToggleLanguage: () => void;
  onResetData: () => void;
  pendingPaymentCount: number;
  openVoiceAssistant: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  language,
  onToggleLanguage,
  onResetData,
  pendingPaymentCount,
  openVoiceAssistant,
}) => {
  const t = translations[language];

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
          
          {/* Brand Zone */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-700 flex items-center justify-center text-white shadow-xs shrink-0">
              <Wrench className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-bold text-base sm:text-lg text-stone-900 tracking-tight whitespace-nowrap">
                  KaamSaathi
                </span>
                <span className="hidden sm:inline text-xs text-stone-300 font-normal">
                  /
                </span>
                <span className="hidden sm:inline text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md whitespace-nowrap border border-emerald-100">
                  {language === 'bn' ? 'কাজের খাতা' : 'Worker Ledger'}
                </span>
              </div>
              <p className="text-[11px] text-stone-500 hidden md:block truncate">
                {t.tagline} · Electrical · Plumbing · Appliances
              </p>
            </div>
          </div>

          {/* Desktop Nav Zone */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-1.5">
            <button
              onClick={() => onTabChange('dashboard')}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-2 ${
                currentTab === 'dashboard'
                  ? 'bg-emerald-50 text-emerald-800 font-semibold'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/70'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-stone-500" />
              {t.tabs.dashboard}
            </button>

            <button
              onClick={() => onTabChange('jobs')}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-2 ${
                currentTab === 'jobs'
                  ? 'bg-emerald-50 text-emerald-800 font-semibold'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/70'
              }`}
            >
              <Briefcase className="w-4 h-4 text-stone-500" />
              {t.tabs.jobs}
            </button>

            <button
              onClick={() => onTabChange('payments')}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-2 relative ${
                currentTab === 'payments'
                  ? 'bg-emerald-50 text-emerald-800 font-semibold'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/70'
              }`}
            >
              <CreditCard className="w-4 h-4 text-stone-500" />
              {t.tabs.payments}
              {pendingPaymentCount > 0 && (
                <span className="ml-1 text-[11px] font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded-full tabular-nums">
                  {pendingPaymentCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onTabChange('reminders')}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-2 ${
                currentTab === 'reminders'
                  ? 'bg-emerald-50 text-emerald-800 font-semibold'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/70'
              }`}
            >
              <Bell className="w-4 h-4 text-stone-500" />
              {t.tabs.reminders}
            </button>
          </nav>

          {/* Right Action Zone */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Language Toggle */}
            <button
              onClick={onToggleLanguage}
              title="Switch language between English and বাংলা"
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200/80 rounded-lg transition-colors border border-stone-200"
              aria-label="Toggle language"
            >
              <Languages className="w-3.5 h-3.5 text-stone-600 shrink-0" />
              <span>{language === 'en' ? 'বাংলা' : 'EN'}</span>
            </button>

            {/* Refresh Data Button */}
            <button
              onClick={onResetData}
              title={t.common.resetData}
              className="p-1.5 sm:p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
              aria-label="Refresh data"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Voice Action Button */}
            <button
              onClick={openVoiceAssistant}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs active:scale-95 transition-all whitespace-nowrap"
            >
              <Mic className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{language === 'bn' ? 'ভয়েস সহকারী' : 'Voice Assistant'}</span>
              <span className="sm:hidden">{language === 'bn' ? 'ভয়েস' : 'Voice'}</span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};

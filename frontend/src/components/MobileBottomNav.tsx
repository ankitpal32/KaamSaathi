import React from 'react';
import { 
  LayoutDashboard, 
  Briefcase, 
  Mic, 
  CreditCard, 
  Bell 
} from 'lucide-react';
import { Language, NavigationTab } from '../types';
import { translations } from '../locales/translations';

interface MobileBottomNavProps {
  currentTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  language: Language;
  pendingPaymentCount: number;
  openVoiceAssistant: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  onTabChange,
  language,
  pendingPaymentCount,
  openVoiceAssistant,
}) => {
  const t = translations[language];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 shadow-sm px-2 py-1 safe-area-inset-bottom">
      <nav className="grid grid-cols-5 items-center h-14 max-w-md mx-auto">
        
        {/* Dashboard Tab */}
        <button
          onClick={() => onTabChange('dashboard')}
          className={`flex flex-col items-center justify-center min-h-[44px] min-w-[44px] transition-colors ${
            currentTab === 'dashboard' ? 'text-emerald-800 font-semibold' : 'text-stone-500 hover:text-stone-800'
          }`}
          aria-label={t.tabs.dashboard}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[56px]">
            {t.tabs.dashboard}
          </span>
        </button>

        {/* Jobs Tab */}
        <button
          onClick={() => onTabChange('jobs')}
          className={`flex flex-col items-center justify-center min-h-[44px] min-w-[44px] transition-colors ${
            currentTab === 'jobs' ? 'text-emerald-800 font-semibold' : 'text-stone-500 hover:text-stone-800'
          }`}
          aria-label={t.tabs.jobs}
        >
          <Briefcase className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[56px]">
            {t.tabs.jobs}
          </span>
        </button>

        {/* Center Prominent Voice Mic Button */}
        <div className="flex flex-col items-center justify-center">
          <button
            onClick={openVoiceAssistant}
            className="w-12 h-12 -mt-4 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white flex items-center justify-center shadow-md shadow-emerald-950/20 active:scale-95 transition-transform"
            aria-label="Voice Log"
          >
            <Mic className="w-6 h-6" />
          </button>
          <span className="text-[10px] text-emerald-800 font-semibold mt-0.5">
            {language === 'bn' ? 'ভয়েস' : 'Voice'}
          </span>
        </div>

        {/* Payments Tab */}
        <button
          onClick={() => onTabChange('payments')}
          className={`flex flex-col items-center justify-center min-h-[44px] min-w-[44px] transition-colors relative ${
            currentTab === 'payments' ? 'text-emerald-800 font-semibold' : 'text-stone-500 hover:text-stone-800'
          }`}
          aria-label={t.tabs.payments}
        >
          <div className="relative">
            <CreditCard className="w-5 h-5" />
            {pendingPaymentCount > 0 && (
              <span className="absolute -top-1 -right-2.5 w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center tabular-nums">
                {pendingPaymentCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[56px]">
            {t.tabs.payments}
          </span>
        </button>

        {/* Reminders Tab */}
        <button
          onClick={() => onTabChange('reminders')}
          className={`flex flex-col items-center justify-center min-h-[44px] min-w-[44px] transition-colors ${
            currentTab === 'reminders' ? 'text-emerald-800 font-semibold' : 'text-stone-500 hover:text-stone-800'
          }`}
          aria-label={t.tabs.reminders}
        >
          <Bell className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[56px]">
            {t.tabs.reminders}
          </span>
        </button>

      </nav>
    </div>
  );
};

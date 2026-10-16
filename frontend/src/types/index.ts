export type TradeType = 'electrical' | 'plumbing' | 'appliance' | 'other';

export type JobStatus = 'pending' | 'partially_paid' | 'completed' | 'in_progress';

export interface Job {
  id: string;
  customerName: string;
  customerPhone: string;
  trade: TradeType;
  description: string;
  agreedAmount: number;
  amountPaid: number;
  remainingBalance: number;
  date: string; // YYYY-MM-DD
  status: JobStatus;
  notes?: string;
}

export type PaymentMode = 'cash' | 'upi' | 'bank_transfer';

export interface PaymentRecord {
  id: string;
  jobId: string;
  customerName: string;
  amount: number;
  paymentMode: PaymentMode;
  date: string; // YYYY-MM-DD HH:mm or ISO
  notes?: string;
}

export interface Reminder {
  id: string;
  customerName: string;
  customerPhone?: string;
  jobId?: string;
  task: string;
  dueDate: string; // YYYY-MM-DD
  isCompleted: boolean;
  trade: TradeType;
  priority?: 'normal' | 'urgent';
}

export type VoiceAssistantState = 
  | 'idle' 
  | 'listening' 
  | 'processing' 
  | 'confirmation' 
  | 'success' 
  | 'error';

export interface VoiceDraftJob {
  customerName: string;
  customerPhone: string;
  trade: TradeType;
  description: string;
  agreedAmount: number;
  amountPaid: number;
  remainingBalance: number;
  notes?: string;
}

export type Language = 'en' | 'bn';

export type NavigationTab = 'dashboard' | 'voice' | 'jobs' | 'payments' | 'reminders';

export type BolnaCallUIState = 
  | 'idle' 
  | 'connecting' 
  | 'active' 
  | 'muted' 
  | 'ending' 
  | 'ended' 
  | 'error';

export interface BolnaCallErrorState {
  code: string;
  message: string;
  details?: string;
  isBackendMissing?: boolean;
}


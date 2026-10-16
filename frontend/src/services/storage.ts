import { Job, PaymentRecord, Reminder } from '../types';

const STORAGE_KEYS = {
  JOBS: 'kaamsaathi_jobs_v1',
  PAYMENTS: 'kaamsaathi_payments_v1',
  REMINDERS: 'kaamsaathi_reminders_v1',
  LANGUAGE: 'kaamsaathi_lang_v1',
};

// No hardcoded sample or fabricated records. Production live storage begins strictly empty.
export const INITIAL_JOBS: Job[] = [];
export const INITIAL_PAYMENTS: PaymentRecord[] = [];
export const INITIAL_REMINDERS: Reminder[] = [];

export const StorageService = {
  getJobs: (): Job[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.JOBS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Error reading jobs from localStorage', e);
    }
    return [];
  },

  saveJobs: (jobs: Job[]): void => {
    try {
      localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(jobs));
    } catch (e) {
      console.error('Error saving jobs to localStorage', e);
    }
  },

  addJob: (newJob: Omit<Job, 'id' | 'remainingBalance' | 'status'> & { status?: Job['status'] }): Job => {
    const jobs = StorageService.getJobs();
    const agreedAmount = Number(newJob.agreedAmount) || 0;
    const amountPaid = Number(newJob.amountPaid) || 0;
    const remainingBalance = Math.max(0, agreedAmount - amountPaid);

    let calculatedStatus: Job['status'] = newJob.status || 'pending';
    if (amountPaid >= agreedAmount && agreedAmount > 0) {
      calculatedStatus = 'completed';
    } else if (amountPaid > 0 && amountPaid < agreedAmount) {
      calculatedStatus = 'partially_paid';
    } else if (amountPaid === 0) {
      calculatedStatus = 'pending';
    }

    const createdJob: Job = {
      ...newJob,
      id: `job-${Date.now()}`,
      agreedAmount,
      amountPaid,
      remainingBalance,
      status: calculatedStatus,
      date: newJob.date || new Date().toISOString().split('T')[0],
    };

    const updated = [createdJob, ...jobs];
    StorageService.saveJobs(updated);

    if (amountPaid > 0) {
      StorageService.addPayment({
        jobId: createdJob.id,
        customerName: createdJob.customerName,
        amount: amountPaid,
        paymentMode: 'cash',
        date: `${createdJob.date} ${new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}`,
        notes: 'Initial payment logged with job',
      });
    }

    return createdJob;
  },

  updateJob: (updatedJob: Job): Job[] => {
    const jobs = StorageService.getJobs();
    const agreedAmount = Number(updatedJob.agreedAmount) || 0;
    const amountPaid = Number(updatedJob.amountPaid) || 0;
    const remainingBalance = Math.max(0, agreedAmount - amountPaid);

    let status = updatedJob.status;
    if (remainingBalance === 0 && agreedAmount > 0) {
      status = 'completed';
    } else if (amountPaid > 0 && remainingBalance > 0) {
      status = 'partially_paid';
    }

    const updated = jobs.map((j) =>
      j.id === updatedJob.id
        ? {
            ...updatedJob,
            agreedAmount,
            amountPaid,
            remainingBalance,
            status,
          }
        : j
    );
    StorageService.saveJobs(updated);
    return updated;
  },

  deleteJob: (jobId: string): Job[] => {
    const jobs = StorageService.getJobs();
    const filtered = jobs.filter((j) => j.id !== jobId);
    StorageService.saveJobs(filtered);
    return filtered;
  },

  getPayments: (): PaymentRecord[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Error reading payments from localStorage', e);
    }
    return [];
  },

  savePayments: (payments: PaymentRecord[]): void => {
    try {
      localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));
    } catch (e) {
      console.error('Error saving payments to localStorage', e);
    }
  },

  addPayment: (payment: Omit<PaymentRecord, 'id' | 'date'> & { date?: string }): PaymentRecord => {
    const payments = StorageService.getPayments();
    const created: PaymentRecord = {
      ...payment,
      id: `pay-${Date.now()}`,
      amount: Number(payment.amount) || 0,
      date: payment.date || `${new Date().toISOString().split('T')[0]} ${new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}`,
    };

    const updatedPayments = [created, ...payments];
    StorageService.savePayments(updatedPayments);

    // Also update the job's paid and balance amounts
    const jobs = StorageService.getJobs();
    const targetJob = jobs.find((j) => j.id === payment.jobId);
    if (targetJob) {
      const newPaid = Number(targetJob.amountPaid) + Number(payment.amount);
      const remainingBalance = Math.max(0, targetJob.agreedAmount - newPaid);
      const status: Job['status'] = remainingBalance === 0 ? 'completed' : 'partially_paid';

      StorageService.updateJob({
        ...targetJob,
        amountPaid: newPaid,
        remainingBalance,
        status,
      });
    }

    return created;
  },

  getReminders: (): Reminder[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.REMINDERS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Error reading reminders', e);
    }
    return [];
  },

  saveReminders: (reminders: Reminder[]): void => {
    try {
      localStorage.setItem(STORAGE_KEYS.REMINDERS, JSON.stringify(reminders));
    } catch (e) {
      console.error('Error saving reminders', e);
    }
  },

  addReminder: (reminder: Omit<Reminder, 'id' | 'isCompleted'>): Reminder => {
    const reminders = StorageService.getReminders();
    const created: Reminder = {
      ...reminder,
      id: `rem-${Date.now()}`,
      isCompleted: false,
    };
    const updated = [created, ...reminders];
    StorageService.saveReminders(updated);
    return created;
  },

  toggleReminder: (id: string): Reminder[] => {
    const reminders = StorageService.getReminders();
    const updated = reminders.map((r) =>
      r.id === id ? { ...r, isCompleted: !r.isCompleted } : r
    );
    StorageService.saveReminders(updated);
    return updated;
  },

  deleteReminder: (id: string): Reminder[] => {
    const reminders = StorageService.getReminders();
    const filtered = reminders.filter((r) => r.id !== id);
    StorageService.saveReminders(filtered);
    return filtered;
  },

  resetAllData: (): void => {
    localStorage.removeItem(STORAGE_KEYS.JOBS);
    localStorage.removeItem(STORAGE_KEYS.PAYMENTS);
    localStorage.removeItem(STORAGE_KEYS.REMINDERS);
  },
};

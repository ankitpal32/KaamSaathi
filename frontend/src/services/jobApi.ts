import { Job, TradeType, JobStatus } from '../types';

const rawBaseUrl = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || 
  'http://localhost:8000';

// Normalize base URL so `${API_BASE_URL}/api/...` and `${API_BASE_URL}/health` resolve correctly regardless of trailing /api
export const API_BASE_URL = rawBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');

export interface BackendHealth {
  status: string;
  app_name: string;
  version: string;
  database_configured: boolean;
  environment: string;
}

export interface BackendJobPayload {
  customer_name: string;
  customer_phone?: string;
  trade: TradeType;
  description: string;
  agreed_amount: number;
  amount_paid: number;
  status?: JobStatus;
  notes?: string;
  confirmed: boolean;
}

export interface BackendJobRecord {
  id: string;
  owner_id: string;
  customer_name: string;
  customer_phone: string;
  trade: TradeType;
  description: string;
  agreed_amount: number | string;
  amount_paid: number | string;
  remaining_balance: number | string;
  status: JobStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Transforms a Supabase snake_case job record into the camelCase frontend Job model.
 */
export function mapBackendJobToFrontend(bJob: BackendJobRecord): Job {
  const agreed = Number(bJob.agreed_amount) || 0;
  const paid = Number(bJob.amount_paid) || 0;
  const remaining = bJob.remaining_balance !== undefined 
    ? Number(bJob.remaining_balance) 
    : Math.max(0, agreed - paid);

  return {
    id: bJob.id,
    customerName: bJob.customer_name,
    customerPhone: bJob.customer_phone || '',
    trade: bJob.trade || 'other',
    description: bJob.description,
    agreedAmount: agreed,
    amountPaid: paid,
    remainingBalance: remaining,
    date: bJob.created_at ? bJob.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
    status: bJob.status || 'pending',
    notes: bJob.notes || '',
  };
}

export class JobApiService {
  private static getStoredAuthToken(): string | null {
    try {
      return localStorage.getItem('supabase_auth_token') || localStorage.getItem('sb_access_token');
    } catch {
      return null;
    }
  }

  /**
   * Health check verifying backend status without credentials.
   */
  public static async getHealth(): Promise<BackendHealth> {
    const res = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Backend health check failed with HTTP ${res.status}`);
    }

    return res.json();
  }

  /**
   * Fetches all jobs for the authenticated user from the backend.
   */
  public static async getJobs(customToken?: string): Promise<Job[]> {
    const token = customToken || this.getStoredAuthToken();
    if (!token) {
      throw new Error('NO_AUTH_TOKEN: Supabase access token is missing. Sign in or configure a session token to fetch database records.');
    }

    const res = await fetch(`${API_BASE_URL}/api/jobs`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (res.status === 401) {
      throw new Error('UNAUTHORIZED: Invalid or expired token.');
    }
    if (res.status === 503) {
      throw new Error('DATABASE_NOT_CONFIGURED: Supabase credentials not configured on backend.');
    }
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Failed to fetch jobs (HTTP ${res.status})`);
    }

    const rawJobs: BackendJobRecord[] = await res.json();
    return rawJobs.map(mapBackendJobToFrontend);
  }

  /**
   * Posts a confirmed job to the FastAPI backend.
   */
  public static async createJob(
    jobData: Omit<Job, 'id' | 'remainingBalance' | 'status'> & { status?: JobStatus; confirmed?: boolean },
    customToken?: string
  ): Promise<Job> {
    const token = customToken || this.getStoredAuthToken();
    if (!token) {
      throw new Error('NO_AUTH_TOKEN: Authentication required to persist jobs to Supabase database.');
    }

    const payload: BackendJobPayload = {
      customer_name: jobData.customerName,
      customer_phone: jobData.customerPhone || '',
      trade: jobData.trade,
      description: jobData.description,
      agreed_amount: Number(jobData.agreedAmount),
      amount_paid: Number(jobData.amountPaid) || 0,
      status: jobData.status,
      notes: jobData.notes || '',
      confirmed: jobData.confirmed ?? true,
    };

    const res = await fetch(`${API_BASE_URL}/api/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 400) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Job creation rejected by validation.');
    }
    if (res.status === 401) {
      throw new Error('UNAUTHORIZED: Invalid or expired token.');
    }
    if (res.status === 503) {
      throw new Error('DATABASE_NOT_CONFIGURED: Supabase backend is not configured.');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to create job (HTTP ${res.status})`);
    }

    const created: BackendJobRecord = await res.json();
    return mapBackendJobToFrontend(created);
  }

  /**
   * Retrieves single authorized job by ID.
   */
  public static async getJobById(jobId: string, customToken?: string): Promise<Job> {
    const token = customToken || this.getStoredAuthToken();
    if (!token) {
      throw new Error('NO_AUTH_TOKEN: Authentication required.');
    }

    const res = await fetch(`${API_BASE_URL}/api/jobs/${jobId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to retrieve job ${jobId}`);
    }

    const raw: BackendJobRecord = await res.json();
    return mapBackendJobToFrontend(raw);
  }

  /**
   * Updates an existing job on the backend.
   */
  public static async updateJob(
    jobId: string,
    jobData: Partial<Omit<Job, 'id' | 'remainingBalance'>> & { confirmed?: boolean },
    customToken?: string
  ): Promise<Job> {
    const token = customToken || this.getStoredAuthToken();
    if (!token) {
      throw new Error('NO_AUTH_TOKEN: Authentication required.');
    }

    const payload: Record<string, any> = {
      confirmed: jobData.confirmed ?? true,
    };
    if (jobData.customerName !== undefined) payload.customer_name = jobData.customerName;
    if (jobData.customerPhone !== undefined) payload.customer_phone = jobData.customerPhone;
    if (jobData.trade !== undefined) payload.trade = jobData.trade;
    if (jobData.description !== undefined) payload.description = jobData.description;
    if (jobData.agreedAmount !== undefined) payload.agreed_amount = Number(jobData.agreedAmount);
    if (jobData.amountPaid !== undefined) payload.amount_paid = Number(jobData.amountPaid);
    if (jobData.status !== undefined) payload.status = jobData.status;
    if (jobData.notes !== undefined) payload.notes = jobData.notes;

    const res = await fetch(`${API_BASE_URL}/api/jobs/${jobId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to update job (HTTP ${res.status})`);
    }

    const raw: BackendJobRecord = await res.json();
    return mapBackendJobToFrontend(raw);
  }

  /**
   * Deletes a job from the backend.
   */
  public static async deleteJob(jobId: string, customToken?: string): Promise<void> {
    const token = customToken || this.getStoredAuthToken();
    if (!token) {
      throw new Error('NO_AUTH_TOKEN: Authentication required.');
    }

    const res = await fetch(`${API_BASE_URL}/api/jobs/${jobId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to delete job (HTTP ${res.status})`);
    }
  }

  /**
   * Records a payment against a job on the backend.
   */
  public static async recordPayment(
    jobId: string,
    paymentData: { amount: number; paymentMode: string; notes?: string; confirmed?: boolean },
    customToken?: string
  ): Promise<any> {
    const token = customToken || this.getStoredAuthToken();
    if (!token) {
      throw new Error('NO_AUTH_TOKEN: Authentication required.');
    }

    const payload = {
      amount: Number(paymentData.amount),
      payment_mode: paymentData.paymentMode,
      notes: paymentData.notes || '',
      confirmed: paymentData.confirmed ?? true,
    };

    const res = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to record payment (HTTP ${res.status})`);
    }

    return res.json();
  }

  /**
   * Fetches all payment events for the technician across all jobs.
   */
  public static async getAllPayments(customToken?: string): Promise<any[]> {
    const token = customToken || this.getStoredAuthToken();
    if (!token) {
      throw new Error('NO_AUTH_TOKEN: Authentication required.');
    }

    const res = await fetch(`${API_BASE_URL}/api/payments`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to fetch payments (HTTP ${res.status})`);
    }

    return res.json();
  }

  /**
   * Fetches all reminders for the technician.
   */
  public static async getReminders(customToken?: string, includeCompleted = true): Promise<any[]> {
    const token = customToken || this.getStoredAuthToken();
    if (!token) {
      throw new Error('NO_AUTH_TOKEN: Authentication required.');
    }

    const res = await fetch(`${API_BASE_URL}/api/reminders?include_completed=${includeCompleted}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to fetch reminders (HTTP ${res.status})`);
    }

    return res.json();
  }

  /**
   * Creates a new follow-up reminder.
   */
  public static async createReminder(reminderData: any, customToken?: string): Promise<any> {
    const token = customToken || this.getStoredAuthToken();
    if (!token) {
      throw new Error('NO_AUTH_TOKEN: Authentication required.');
    }

    const payload = {
      task: reminderData.task,
      due_date: reminderData.dueDate || reminderData.due_date,
      job_id: reminderData.jobId || reminderData.job_id || null,
      trade: reminderData.trade || 'other',
      priority: reminderData.priority || 'normal',
    };

    const res = await fetch(`${API_BASE_URL}/api/reminders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to create reminder (HTTP ${res.status})`);
    }

    return res.json();
  }

  /**
   * Toggles reminder completion status.
   */
  public static async toggleReminder(reminderId: string, isCompleted?: boolean, customToken?: string): Promise<any> {
    const token = customToken || this.getStoredAuthToken();
    if (!token) {
      throw new Error('NO_AUTH_TOKEN: Authentication required.');
    }

    const url = isCompleted !== undefined 
      ? `${API_BASE_URL}/api/reminders/${reminderId}/toggle?is_completed=${isCompleted}`
      : `${API_BASE_URL}/api/reminders/${reminderId}/toggle`;

    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to toggle reminder (HTTP ${res.status})`);
    }

    return res.json();
  }

  /**
   * Deletes a reminder from the backend.
   */
  public static async deleteReminder(reminderId: string, customToken?: string): Promise<void> {
    const token = customToken || this.getStoredAuthToken();
    if (!token) {
      throw new Error('NO_AUTH_TOKEN: Authentication required.');
    }

    const res = await fetch(`${API_BASE_URL}/api/reminders/${reminderId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to delete reminder (HTTP ${res.status})`);
    }
  }

  /**
   * Fetches deterministic dashboard stats from the backend.
   */
  public static async getDashboardStats(customToken?: string): Promise<any> {
    const token = customToken || this.getStoredAuthToken();
    if (!token) {
      throw new Error('NO_AUTH_TOKEN: Authentication required.');
    }

    const res = await fetch(`${API_BASE_URL}/api/dashboard/stats`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to fetch dashboard stats (HTTP ${res.status})`);
    }

    return res.json();
  }

  /**
   * Executes a Bolna voice tool call with backend validation and confirmation.
   */
  public static async executeBolnaTool(
    toolName: string,
    args: Record<string, any>,
    confirmed?: boolean,
    customToken?: string
  ): Promise<any> {
    const token = customToken || this.getStoredAuthToken();
    if (!token) {
      throw new Error('NO_AUTH_TOKEN: Authentication required for voice tool actions.');
    }

    const payload = {
      tool_name: toolName,
      arguments: args,
      confirmed: confirmed,
    };

    const res = await fetch(`${API_BASE_URL}/api/bolna/tools/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Voice tool execution failed (HTTP ${res.status})`);
    }

    return res.json();
  }
}

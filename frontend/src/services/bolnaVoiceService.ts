import { BolnaWebCall, type CallError, type CallEndInfo, type CallState } from '@bolna/web-call';
import { BolnaCallUIState, BolnaCallErrorState } from '../types';

export interface BolnaVoiceServiceListeners {
  onStateChange: (state: BolnaCallUIState) => void;
  onVolumeChange?: (level: number) => void;
  onError: (error: BolnaCallErrorState) => void;
  onCallEnd?: (reason: string) => void;
  onCallStart?: () => void;
}

export class BolnaVoiceService {
  private client: BolnaWebCall | null = null;
  private sessionUrl: string;
  private currentState: BolnaCallUIState = 'idle';
  private listeners: BolnaVoiceServiceListeners;
  private isLocallyMuted = false;
  private userData?: Record<string, unknown>;

  constructor(
    listeners: BolnaVoiceServiceListeners,
    customSessionUrl?: string,
    userData?: Record<string, unknown>
  ) {
    this.listeners = listeners;
    // Configuration priority: custom parameter -> environment variable -> default proxy route
    this.sessionUrl = 
      customSessionUrl || 
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BOLNA_SESSION_URL) || 
      '/api/bolna-session';
    this.userData = userData;
  }

  public getSessionUrl(): string {
    return this.sessionUrl;
  }

  public getState(): BolnaCallUIState {
    return this.currentState;
  }

  public getRunId(): string | null {
    return this.client ? this.client.getRunId() : null;
  }

  public isMuted(): boolean {
    return this.isLocallyMuted;
  }

  private setState(newState: BolnaCallUIState) {
    this.currentState = newState;
    this.listeners.onStateChange(newState);
  }

  /**
   * Initializes and starts a live WebRTC call using @bolna/web-call.
   * Calls the configured backend session endpoint (POST /api/bolna-session) to obtain
   * short-lived SIP credentials. No API keys are used in browser.
   */
  public async startCall(extraUserData?: Record<string, unknown>): Promise<void> {
    try {
      if (this.client) {
        await this.endCall();
      }

      this.setState('connecting');
      this.isLocallyMuted = false;

      // Instantiate official BolnaWebCall with the backend sessionUrl
      this.client = new BolnaWebCall({
        sessionUrl: this.sessionUrl,
        userData: { ...this.userData, ...extraUserData },
        debug: true,
      });

      // Hook up SDK event listeners
      this.client.on('state-change', (sdkState: CallState) => {
        if (sdkState === 'active') {
          this.setState(this.isLocallyMuted ? 'muted' : 'active');
        } else if (sdkState === 'connecting' || sdkState === 'ringing') {
          this.setState('connecting');
        } else if (sdkState === 'ended') {
          if (this.currentState !== 'ending') {
            this.setState('ended');
          }
        }
      });

      this.client.on('call-start', () => {
        this.setState(this.isLocallyMuted ? 'muted' : 'active');
        if (this.listeners.onCallStart) {
          this.listeners.onCallStart();
        }
      });

      this.client.on('volume-level', (level: number) => {
        if (this.listeners.onVolumeChange) {
          this.listeners.onVolumeChange(level);
        }
      });

      this.client.on('call-end', (info: CallEndInfo) => {
        this.setState('ended');
        if (this.listeners.onCallEnd) {
          this.listeners.onCallEnd(info.reason || 'Call ended');
        }
      });

      this.client.on('error', (err: CallError) => {
        console.error('BolnaWebCall error:', err);
        const mappedError = this.mapCallError(err);
        this.setState('error');
        this.listeners.onError(mappedError);
      });

      // Start the call session (triggers session fetch + mic request + WebRTC connect)
      await this.client.start({
        userData: { ...this.userData, ...extraUserData },
      });

    } catch (err: any) {
      console.error('Failed to initiate Bolna voice call:', err);
      const mappedError = this.mapGenericError(err);
      this.setState('error');
      this.listeners.onError(mappedError);
    }
  }

  /**
   * Mute or unmute the local microphone track
   */
  public toggleMute(): boolean {
    if (!this.client || (this.currentState !== 'active' && this.currentState !== 'muted')) {
      return this.isLocallyMuted;
    }

    const nextMuted = !this.isLocallyMuted;
    this.client.setMuted(nextMuted);
    this.isLocallyMuted = nextMuted;

    this.setState(nextMuted ? 'muted' : 'active');
    return nextMuted;
  }

  /**
   * Hangs up the active WebRTC call session and releases all resources
   */
  public async endCall(): Promise<void> {
    if (!this.client) {
      this.setState('idle');
      return;
    }

    try {
      this.setState('ending');
      await this.client.stop();
    } catch (err) {
      console.warn('Error while ending BolnaWebCall:', err);
    } finally {
      this.setState('ended');
      this.client = null;
      this.isLocallyMuted = false;
    }
  }

  /**
   * Retries initiating the call session
   */
  public async retry(): Promise<void> {
    await this.startCall();
  }

  /**
   * Cleans up all listeners and releases resources on unmount
   */
  public destroy(): void {
    if (this.client) {
      this.client.stop().catch(() => {});
      this.client = null;
    }
    this.currentState = 'idle';
  }

  /**
   * Maps Bolna SDK Error into human-friendly diagnostics
   */
  private mapCallError(err: CallError): BolnaCallErrorState {
    switch (err.code) {
      case 'microphone_denied':
        return {
          code: 'microphone_denied',
          message: 'Microphone permission denied.',
          details: 'Please allow microphone access in your browser address bar to speak with KaamSaathi.',
        };
      case 'mint_failed':
        return {
          code: 'mint_failed',
          message: 'Could not fetch voice session from backend.',
          details: `The backend endpoint ${this.sessionUrl} failed or is not reachable yet. Backend FastAPI integration is required to mint Bolna sessions.`,
          isBackendMissing: true,
        };
      case 'connect_failed':
        return {
          code: 'connect_failed',
          message: 'WebRTC voice connection failed.',
          details: 'Could not establish media connection with Bolna FreeSWITCH gateway. Check your internet connection or network firewall.',
        };
      case 'at_capacity':
        return {
          code: 'at_capacity',
          message: 'Voice agent is currently at capacity.',
          details: 'All agent lines are occupied. Please try again shortly.',
        };
      case 'call_rejected':
        return {
          code: 'call_rejected',
          message: 'Voice session was rejected.',
          details: 'The Bolna agent ended or rejected the call.',
        };
      default:
        return {
          code: err.code || 'unknown_error',
          message: err.message || 'An error occurred during the voice call.',
          details: typeof err.cause === 'string' ? err.cause : undefined,
        };
    }
  }

  private mapGenericError(err: any): BolnaCallErrorState {
    const msg = err?.message || String(err);
    if (msg.includes('Failed to fetch') || msg.includes('404') || msg.includes('mint')) {
      return {
        code: 'mint_failed',
        message: 'Backend voice endpoint not available.',
        details: `POST ${this.sessionUrl} is not yet implemented on the server. Backend work is required to mint Bolna voice sessions with your BOLNA_API_KEY.`,
        isBackendMissing: true,
      };
    }
    if (msg.includes('Permission') || msg.includes('NotAllowedError')) {
      return {
        code: 'microphone_denied',
        message: 'Microphone permission blocked.',
        details: 'Browser blocked microphone access. Click the lock/tune icon in your address bar to allow.',
      };
    }
    return {
      code: 'connection_error',
      message: 'Failed to connect voice session.',
      details: msg,
    };
  }
}

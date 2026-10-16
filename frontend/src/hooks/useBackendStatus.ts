import { useState, useEffect, useCallback } from 'react';
import { JobApiService, BackendHealth } from '../services/jobApi';

export interface BackendStatusState {
  online: boolean;
  dbConfigured: boolean;
  checked: boolean;
  usingApi: boolean;
  error?: string;
}

export function useBackendStatus() {
  const [backendState, setBackendState] = useState<BackendStatusState>({
    online: false,
    dbConfigured: false,
    checked: false,
    usingApi: false,
  });

  const checkStatus = useCallback(async (hasToken: boolean): Promise<BackendStatusState> => {
    try {
      const health: BackendHealth = await JobApiService.getHealth();
      const newState: BackendStatusState = {
        online: true,
        dbConfigured: health.database_configured,
        checked: true,
        usingApi: hasToken && health.database_configured,
      };
      setBackendState(newState);
      return newState;
    } catch (err: any) {
      const fallbackState: BackendStatusState = {
        online: false,
        dbConfigured: false,
        checked: true,
        usingApi: false,
        error: err.message || 'Backend unreachable',
      };
      setBackendState(fallbackState);
      return fallbackState;
    }
  }, []);

  return {
    backendState,
    setBackendState,
    checkStatus,
  };
}

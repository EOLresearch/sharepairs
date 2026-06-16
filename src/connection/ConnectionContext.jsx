import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '../components/UserAuth/AuthContext';
import {
  addConnectionListener,
  ping,
  setConnectionState,
  getConnectionState,
  getBackoffConfig,
  PING_INTERVAL_MS,
} from './connection';

const ConnectionContext = createContext(null);

export function ConnectionProvider({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState(() => getConnectionState());
  const backoffMsRef = useRef(getBackoffConfig().initialMs);
  const timeoutRef = useRef(null);
  const mountedRef = useRef(true);

  const scheduleNext = useCallback((delayMs, runPing) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(runPing, delayMs);
  }, []);

  const runPing = useCallback(() => {
    if (!mountedRef.current || !user) return;

    ping()
      .then((ok) => {
        if (!mountedRef.current) return;
        const prev = getConnectionState();
        if (ok) {
          if (prev.status === 'reconnecting') {
            setConnectionState({
              status: 'online',
              lastError: null,
              reconnectGeneration: prev.reconnectGeneration + 1,
            });
          } else {
            setConnectionState({ status: 'online', lastError: null });
          }
          backoffMsRef.current = getBackoffConfig().initialMs;
          scheduleNext(PING_INTERVAL_MS, runPing);
        } else {
          const { maxMs, multiplier } = getBackoffConfig();
          setConnectionState({
            status: 'reconnecting',
            lastError: 'Connection problem. Reconnecting…',
          });
          scheduleNext(backoffMsRef.current, runPing);
          backoffMsRef.current = Math.min(backoffMsRef.current * multiplier, maxMs);
        }
      })
      .catch(() => {
        if (!mountedRef.current) return;
        const { maxMs, multiplier } = getBackoffConfig();
        setConnectionState({
          status: 'reconnecting',
          lastError: 'Connection problem. Reconnecting…',
        });
        scheduleNext(backoffMsRef.current, runPing);
        backoffMsRef.current = Math.min(backoffMsRef.current * multiplier, maxMs);
      });
  }, [scheduleNext, user]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setConnectionState({ status: 'online', lastError: null });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }
    runPing();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [user, runPing]);

  useEffect(() => {
    const unsub = addConnectionListener(() => {
      setState(getConnectionState());
    });
    return unsub;
  }, []);

  return (
    <ConnectionContext.Provider value={state}>
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection() {
  const ctx = useContext(ConnectionContext);
  return ctx ?? getConnectionState();
}

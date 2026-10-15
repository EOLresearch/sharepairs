import { useEffect, useRef } from 'react';
import { useAuth } from '../components/UserAuth/AuthContext';
import { getWsToken } from '../services/authService';
import { getMessages } from '../services/messageService';
import { setConnectionState, getConnectionState } from '../connection/connection';
import {
  connect,
  disconnect,
  on,
  off,
  getConnectionState as getWsState,
} from './client';

export function RealtimeProvider({ children }) {
  const { user, refreshAuth } = useAuth();
  const refreshAuthRef = useRef(refreshAuth);
  refreshAuthRef.current = refreshAuth;
  const prevWsState = useRef('disconnected');
  const everConnected = useRef(false);
  const intentionalClose = useRef(false);

  useEffect(() => {
    if (!user) {
      intentionalClose.current = true;
      everConnected.current = false;
      disconnect();
      setConnectionState({ status: 'online', lastError: null });
      return undefined;
    }

    let cancelled = false;
    intentionalClose.current = false;

    const start = async () => {
      try {
        const { token } = await getWsToken();
        if (cancelled || !token) return;
        await connect(
          () => getWsToken().then((r) => r?.token || null),
          {
            backfill: async (conversationId) => {
              const msgs = await getMessages(conversationId);
              return Array.isArray(msgs) ? msgs : [];
            },
          }
        );
      } catch (err) {
        console.warn('WebSocket connect failed:', err);
        // Don't sticky-banner on first failure before we ever connected
        if (everConnected.current) {
          setConnectionState({
            status: 'reconnecting',
            lastError: 'Realtime connection unavailable',
          });
        }
      }
    };

    start();

    const onWsState = ({ state }) => {
      const prev = prevWsState.current;
      prevWsState.current = state;

      if (state === 'connected') {
        everConnected.current = true;
        const http = getConnectionState();
        setConnectionState({
          status: 'online',
          lastError: null,
          reconnectGeneration:
            prev === 'connecting' || prev === 'disconnected' || prev === 'error'
              ? http.reconnectGeneration + 1
              : http.reconnectGeneration,
        });
        return;
      }

      // Initial handshake / intentional teardown — do not show Reconnecting banner
      if (intentionalClose.current || cancelled) return;
      if (!everConnected.current) return;

      if (state === 'connecting' || state === 'error' || state === 'disconnected') {
        if (getWsState() !== 'connected') {
          setConnectionState({
            status: 'reconnecting',
            lastError: 'Connection problem. Reconnecting…',
          });
        }
      }
    };

    on('connectionStateChange', onWsState);

    const onMatchCreated = () => {
      refreshAuthRef.current?.();
    };
    on('matchCreated', onMatchCreated);

    return () => {
      cancelled = true;
      intentionalClose.current = true;
      off('connectionStateChange', onWsState);
      off('matchCreated', onMatchCreated);
      disconnect();
    };
  }, [user?.uid]);

  return children;
}

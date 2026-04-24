import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  MetronomeState,
  MetronomeActionType,
  TimeSyncResponse,
  WS_EVENTS,
} from '@metro-nomedeul/shared';
import { CONFIG } from '../apis/config';

const TIME_SYNC_ROUNDS = 5;
const TIME_SYNC_INTERVAL_MS = 200;
const TIME_SYNC_RESYNC_INTERVAL_MS = 5 * 60 * 1000;

interface UseSocketOptions {
  roomUuid: string;
  userId: string;
  onMetronomeState?: (state: MetronomeState) => void;
  onBeatSync?: (state: MetronomeState) => void;
  onInitialState?: (state: MetronomeState) => void;
  onServerShutdown?: () => void;
}

export const useSocket = ({
  roomUuid,
  userId,
  onMetronomeState,
  onBeatSync,
  onInitialState,
  onServerShutdown,
}: UseSocketOptions) => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const clockOffsetRef = useRef(0);

  const onMetronomeStateRef = useRef(onMetronomeState);
  const onBeatSyncRef = useRef(onBeatSync);
  const onInitialStateRef = useRef(onInitialState);
  const onServerShutdownRef = useRef(onServerShutdown);

  useEffect(() => {
    onMetronomeStateRef.current = onMetronomeState;
  }, [onMetronomeState]);
  useEffect(() => {
    onBeatSyncRef.current = onBeatSync;
  }, [onBeatSync]);
  useEffect(() => {
    onInitialStateRef.current = onInitialState;
  }, [onInitialState]);
  useEffect(() => {
    onServerShutdownRef.current = onServerShutdown;
  }, [onServerShutdown]);

  useEffect(() => {
    if (!roomUuid) return;

    const socket = io(CONFIG.WS_URL, {
      query: { roomUuid, userId },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
    });

    socketRef.current = socket;

    let resyncIntervalId: ReturnType<typeof setInterval> | null = null;
    let activeSyncCleanup: (() => void) | null = null;

    // Time sync: measure RTT and estimate clock offset
    const performTimeSync = (onComplete?: () => void) => {
      // Cancel any prior in-flight sync before starting a new one
      activeSyncCleanup?.();

      const offsets: number[] = [];
      let round = 0;
      let pingTimer: ReturnType<typeof setTimeout> | null = null;
      let cancelled = false;

      const sendPing = () => {
        if (cancelled) return;
        socket.emit(WS_EVENTS.TIME_SYNC_REQUEST, {
          clientSendTime: Date.now(),
        });
      };

      const onSyncResponse = (data: TimeSyncResponse) => {
        if (cancelled) return;
        const clientReceiveTime = Date.now();
        const rtt = clientReceiveTime - data.clientSendTime;
        const offset = data.serverTime - (data.clientSendTime + rtt / 2);
        offsets.push(offset);
        round++;

        if (round < TIME_SYNC_ROUNDS) {
          pingTimer = setTimeout(sendPing, TIME_SYNC_INTERVAL_MS);
        } else {
          cleanup();
          offsets.sort((a, b) => a - b);
          clockOffsetRef.current = offsets[Math.floor(offsets.length / 2)];
          onComplete?.();
        }
      };

      const cleanup = () => {
        cancelled = true;
        if (pingTimer) clearTimeout(pingTimer);
        socket.off(WS_EVENTS.TIME_SYNC_RESPONSE, onSyncResponse);
        activeSyncCleanup = null;
      };
      activeSyncCleanup = cleanup;

      socket.on(WS_EVENTS.TIME_SYNC_RESPONSE, onSyncResponse);
      sendPing();
    };

    socket.on('connect', () => {
      setIsConnected(true);
      // Defer REQUEST_SYNC until after offset is measured, so the full-state
      // re-broadcast is interpreted with a valid clockOffsetRef.
      performTimeSync(() => {
        socket.emit(WS_EVENTS.REQUEST_SYNC);
      });

      if (resyncIntervalId) clearInterval(resyncIntervalId);
      resyncIntervalId = setInterval(
        performTimeSync,
        TIME_SYNC_RESYNC_INTERVAL_MS,
      );
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      if (resyncIntervalId) {
        clearInterval(resyncIntervalId);
        resyncIntervalId = null;
      }
      activeSyncCleanup?.();
    });

    socket.on(WS_EVENTS.METRONOME_STATE, (data: MetronomeState) => {
      onMetronomeStateRef.current?.(data);
    });

    socket.on(WS_EVENTS.BEAT_SYNC, (data: MetronomeState) => {
      onBeatSyncRef.current?.(data);
    });

    socket.on(WS_EVENTS.INITIAL_STATE, (data: MetronomeState) => {
      onInitialStateRef.current?.(data);
    });

    socket.on(WS_EVENTS.SERVER_SHUTDOWN, () => {
      onServerShutdownRef.current?.();
    });

    return () => {
      if (resyncIntervalId) clearInterval(resyncIntervalId);
      activeSyncCleanup?.();
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [roomUuid, userId]);

  const emit = useCallback(
    (event: MetronomeActionType, data?: Record<string, unknown>) => {
      socketRef.current?.emit(event, data);
    },
    [],
  );

  return { isConnected, emit, clockOffset: clockOffsetRef };
};

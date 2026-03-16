import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  MetronomeState,
  MetronomeActionType,
  WS_EVENTS,
} from '@metro-nomedeul/shared';
import { CONFIG } from '../apis/config';

interface UseSocketOptions {
  roomUuid: string;
  userId: string;
  onMetronomeState?: (state: MetronomeState) => void;
  onBeatSync?: (state: MetronomeState) => void;
  onInitialState?: (state: MetronomeState) => void;
}

export const useSocket = ({
  roomUuid,
  userId,
  onMetronomeState,
  onBeatSync,
  onInitialState,
}: UseSocketOptions) => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const onMetronomeStateRef = useRef(onMetronomeState);
  const onBeatSyncRef = useRef(onBeatSync);
  const onInitialStateRef = useRef(onInitialState);

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

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
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

    return () => {
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

  return { isConnected, emit };
};

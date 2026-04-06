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
  const clockOffsetRef = useRef(0);

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

    // Time sync: measure RTT and estimate clock offset
    const performTimeSync = () => {
      const offsets: number[] = [];
      let round = 0;

      const sendPing = () => {
        socket.emit(WS_EVENTS.TIME_SYNC_REQUEST, {
          clientSendTime: Date.now(),
        });
      };

      const onSyncResponse = (data: TimeSyncResponse) => {
        const clientReceiveTime = Date.now();
        const rtt = clientReceiveTime - data.clientSendTime;
        // offset = serverTime - clientTime (positive means server is ahead)
        const offset = data.serverTime - (data.clientSendTime + rtt / 2);
        offsets.push(offset);
        round++;

        if (round < TIME_SYNC_ROUNDS) {
          setTimeout(sendPing, TIME_SYNC_INTERVAL_MS);
        } else {
          socket.off(WS_EVENTS.TIME_SYNC_RESPONSE, onSyncResponse);
          // Use median to filter outliers
          offsets.sort((a, b) => a - b);
          clockOffsetRef.current = offsets[Math.floor(offsets.length / 2)];
        }
      };

      socket.on(WS_EVENTS.TIME_SYNC_RESPONSE, onSyncResponse);
      sendPing();
    };

    socket.on('connect', () => {
      setIsConnected(true);
      performTimeSync();
      // 재연결 시 최신 메트로놈 상태 요청
      socket.emit(WS_EVENTS.REQUEST_SYNC);
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

  return { isConnected, emit, clockOffset: clockOffsetRef };
};

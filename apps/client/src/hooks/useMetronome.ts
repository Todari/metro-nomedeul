import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Metronome } from '../utils/metronome';
import { useSocket } from './useSocket';
import { WS_EVENTS } from '@metro-nomedeul/shared';
import type { MetronomeState } from '@metro-nomedeul/shared';

const USER_ID_KEY = 'metronomdeul:userId';

const getOrCreateUserId = (): string => {
  if (typeof window === 'undefined') {
    return `client-${Math.random().toString(36).slice(2)}`;
  }
  try {
    const stored = window.localStorage.getItem(USER_ID_KEY);
    if (stored) return stored;
    const fresh = `client-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(USER_ID_KEY, fresh);
    return fresh;
  } catch {
    return `client-${Math.random().toString(36).slice(2)}`;
  }
};

export const useMetronome = (roomUuid: string) => {
  const metronomeRef = useRef<Metronome | null>(null);
  const initPromiseRef = useRef<Promise<boolean> | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tempo, setTempo] = useState(120);
  const [beats, setBeats] = useState(4);
  const [currentBeat, setCurrentBeat] = useState(1);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const userId = useMemo(() => getOrCreateUserId(), []);

  const handleServerMessage = useCallback((data: MetronomeState) => {
    metronomeRef.current?.handleServerState(data);
  }, []);

  const { isConnected, emit, clockOffset } = useSocket({
    roomUuid,
    userId,
    onMetronomeState: handleServerMessage,
    onBeatSync: handleServerMessage,
    onInitialState: handleServerMessage,
  });

  useEffect(() => {
    if (metronomeRef.current) return;

    const metronome = new Metronome();
    metronomeRef.current = metronome;
    metronome.setClockOffsetRef(clockOffset);

    metronome.setOnPlayStateChange(setIsPlaying);
    metronome.setOnTempoChange(setTempo);
    metronome.setOnBeatsChange(setBeats);
    metronome.setOnBeat((beatIdx, bpb) => {
      setCurrentBeat((beatIdx % bpb) + 1);
    });

    return () => {
      metronomeRef.current?.destroy();
      metronomeRef.current = null;
    };
  }, []);

  const initializeAudio = useCallback(async (): Promise<boolean> => {
    const metronome = metronomeRef.current;
    if (!metronome) return false;

    // 모바일에서 같은 탭(예: Play 버튼 + document 전역 리스너)에 두 핸들러가 동시 발화하는
    // race를 방지: 진행 중인 init이 있으면 같은 Promise를 반환해 둘 다 같은 결과를 받도록 한다
    if (initPromiseRef.current) return initPromiseRef.current;

    if (isAudioReady && !metronome.hasPendingPlayback()) return true;

    const promise = (async (): Promise<boolean> => {
      setIsInitializing(true);
      setAudioError(null);
      try {
        if (metronome.hasPendingPlayback()) {
          const ok = await metronome.resumeAfterGesture();
          if (ok) {
            setIsAudioReady(true);
            return true;
          }
        }

        const ok = await metronome.initialize();
        if (ok) {
          setIsAudioReady(true);
          setAudioError(null);
        } else {
          setAudioError(
            '오디오를 초기화할 수 없습니다. 브라우저 설정을 확인해주세요.',
          );
        }
        return ok;
      } catch {
        setAudioError('오디오 초기화 중 오류가 발생했습니다.');
        return false;
      } finally {
        setIsInitializing(false);
        initPromiseRef.current = null;
      }
    })();

    initPromiseRef.current = promise;
    return promise;
  }, [isAudioReady]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        metronomeRef.current?.resumeIfSuspended();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  const startMetronome = useCallback(async () => {
    if (!metronomeRef.current) return;

    const ok = isAudioReady || (await initializeAudio());
    if (!ok) {
      setAudioError(
        '오디오를 시작할 수 없습니다. 화면을 터치한 후 다시 시도해주세요.',
      );
      return;
    }
    setAudioError(null);

    emit(WS_EVENTS.START_METRONOME as 'startMetronome', { tempo, beats });
    await metronomeRef.current.start();
  }, [isAudioReady, initializeAudio, tempo, beats, emit]);

  const stopMetronome = useCallback(() => {
    if (!metronomeRef.current) return;
    emit(WS_EVENTS.STOP_METRONOME as 'stopMetronome');
    metronomeRef.current.stop();
  }, [emit]);

  const changeTempo = useCallback(
    (newTempo: number) => {
      if (!metronomeRef.current) return;
      setTempo(newTempo);
      emit(WS_EVENTS.CHANGE_TEMPO as 'changeTempo', { tempo: newTempo });
    },
    [emit],
  );

  const changeBeats = useCallback(
    (newBeats: number) => {
      if (!metronomeRef.current) return;
      setBeats(newBeats);
      emit(WS_EVENTS.CHANGE_BEATS as 'changeBeats', { beats: newBeats });
    },
    [emit],
  );

  const tapTempo = useCallback(() => {
    if (!metronomeRef.current) return;
    const newTempo = metronomeRef.current.tapTempo();
    setTempo(newTempo);
    emit(WS_EVENTS.CHANGE_TEMPO as 'changeTempo', { tempo: newTempo });
  }, [emit]);

  const requestSync = useCallback(() => {
    emit(WS_EVENTS.REQUEST_SYNC as 'requestSync');
  }, [emit]);

  // user gesture 핸들러 안에서 동기적으로 호출해야 iOS Safari resume hang을 피함
  const primeAudioContext = useCallback(() => {
    metronomeRef.current?.primeAudioContextSync();
  }, []);

  const clearTapTimes = useCallback(() => {
    metronomeRef.current?.clearTapTimes();
  }, []);

  const getTapCount = useCallback(() => {
    return metronomeRef.current?.getTapCount() ?? 0;
  }, []);

  return {
    isPlaying,
    tempo,
    beats,
    currentBeat,
    isAudioReady,
    isInitializing,
    isConnected,
    audioError,
    startMetronome,
    stopMetronome,
    changeTempo,
    changeBeats,
    tapTempo,
    clearTapTimes,
    getTapCount,
    initializeAudio,
    primeAudioContext,
    requestSync,
  };
};

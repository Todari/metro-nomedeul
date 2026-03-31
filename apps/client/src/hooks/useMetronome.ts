import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Metronome } from '../utils/metronome';
import { useSocket } from './useSocket';
import { WS_EVENTS } from '@metro-nomedeul/shared';
import type { MetronomeState } from '@metro-nomedeul/shared';

export const useMetronome = (roomUuid: string) => {
  const metronomeRef = useRef<Metronome | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tempo, setTempo] = useState(120);
  const [beats, setBeats] = useState(4);
  const [currentBeat, setCurrentBeat] = useState(1);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const userId = useMemo(
    () => `client-${Math.random().toString(36).slice(2)}`,
    [],
  );

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

  const initializeAudio = useCallback(async () => {
    if (isAudioReady || !metronomeRef.current || isInitializing) return false;

    setIsInitializing(true);
    setAudioError(null);
    try {
      const success = await metronomeRef.current.initialize();
      if (success) {
        setIsAudioReady(true);
      } else {
        setAudioError(
          '오디오를 초기화할 수 없습니다. 브라우저 설정을 확인해주세요.',
        );
      }
      return success;
    } catch {
      setAudioError('오디오 초기화 중 오류가 발생했습니다.');
      return false;
    } finally {
      setIsInitializing(false);
    }
  }, [isAudioReady, isInitializing]);

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
  };
};

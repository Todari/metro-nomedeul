import { useEffect, useRef, useState, useCallback } from 'react';
import { Metronome } from '../utils/metronome';

export const useMetronome = (websocket: WebSocket | null) => {
  const metronomeRef = useRef<Metronome | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tempo, setTempo] = useState(120);
  const [beats, setBeats] = useState(4);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  // 메트로놈 초기화
  useEffect(() => {
    if (!websocket) {
      console.error('WebSocket이 연결되지 않았습니다');
      return;
    }
    
    // 기존 메트로놈 정리
    if (metronomeRef.current) {
      metronomeRef.current.destroy();
    }
    
    // 새 메트로놈 인스턴스 생성
    const metronome = new Metronome(websocket);
    metronomeRef.current = metronome;
    
    // 콜백 설정
    metronome.setOnPlayStateChange((playing: boolean) => {
      setIsPlaying(playing);
    });
    
    metronome.setOnTempoChange((newTempo: number) => {
      setTempo(newTempo);
    });

    metronome.setOnBeatsChange((newBeats: number) => {
      setBeats(newBeats);
    });
    
    return () => {
      // 정리 작업
      if (metronomeRef.current) {
        metronomeRef.current.destroy();
        metronomeRef.current = null;
      }
    };
  }, [websocket]);

  // 오디오 초기화 (사용자 상호작용 시)
  const initializeAudio = useCallback(async () => {
    if (!metronomeRef.current || isInitializing) return false;
    
    setIsInitializing(true);
    try {
      const success = await metronomeRef.current.initialize();
      if (success) {
        setIsAudioReady(true);
      }
      return success;
    } catch (error) {
      console.error('오디오 초기화 실패:', error);
      return false;
    } finally {
      setIsInitializing(false);
    }
  }, [isInitializing]);

  // 메트로놈 시작
  const startMetronome = useCallback(async () => {
    if (!metronomeRef.current) {
      console.error('메트로놈이 초기화되지 않았습니다');
      return;
    }

    // 오디오가 준비되지 않은 경우 먼저 초기화
    if (!isAudioReady) {
      const initialized = await initializeAudio();
      if (!initialized) {
        console.error('오디오 초기화 실패로 메트로놈을 시작할 수 없습니다');
        return;
      }
    }

    try {
      await metronomeRef.current.start();
    } catch (error) {
      console.error('메트로놈 시작 실패:', error);
    }
  }, [isAudioReady, initializeAudio]);

  // 메트로놈 정지
  const stopMetronome = useCallback(() => {
    if (!metronomeRef.current) return;
    metronomeRef.current.stop();
  }, []);

  // 템포 변경
  const changeTempo = useCallback((newTempo: number) => {
    if (!metronomeRef.current) return;
    setTempo(newTempo);
    metronomeRef.current.requestChangeTempo(newTempo);
  }, []);

  // 박자 변경
  const changeBeats = useCallback((newBeats: number) => {
    if (!metronomeRef.current) return;
    setBeats(newBeats);
    metronomeRef.current.requestChangeBeats(newBeats);
  }, []);

  // 탭 템포
  const tapTempo = useCallback(() => {
    if (!metronomeRef.current) return;
    const newTempo = metronomeRef.current.tapTempo();
    setTempo(newTempo);
    metronomeRef.current.requestChangeTempo(newTempo);
  }, []);

  // 탭 기록 초기화
  const clearTapTimes = useCallback(() => {
    if (!metronomeRef.current) return;
    metronomeRef.current.clearTapTimes();
  }, []);

  // 탭 기록 개수
  const getTapCount = useCallback(() => {
    if (!metronomeRef.current) return 0;
    return metronomeRef.current.getTapCount();
  }, []);

  return {
    isPlaying,
    tempo,
    beats,
    isAudioReady,
    isInitializing,
    startMetronome,
    stopMetronome,
    changeTempo,
    changeBeats,
    tapTempo,
    clearTapTimes,
    getTapCount,
    initializeAudio
  };
};

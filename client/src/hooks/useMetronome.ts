import { useEffect, useRef, useState, useCallback } from 'react';
import { Metronome } from '../utils/metronome';

export const useMetronome = (websocket: WebSocket | null) => {
  const metronomeRef = useRef<Metronome | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tempo, setTempo] = useState(120);
  const [beats, setBeats] = useState(4);
  const [currentBeat, setCurrentBeat] = useState(1);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  // 오디오 초기화 (사용자 상호작용 시)
  const initializeAudio = useCallback(async () => {
    if (isAudioReady) {
      return true;
    }
    if (!metronomeRef.current || isInitializing) {
      console.log('초기화 조건 불만족:', { metronomeRef: !!metronomeRef.current, isInitializing });
      return false;
    }
    
    console.log('오디오 초기화 시작');
    setIsInitializing(true);
    try {
      const success = await metronomeRef.current.initialize();
      console.log('오디오 초기화 결과:', success);
      if (success) {
        setIsAudioReady(true);
        console.log('오디오 준비 완료');
      }
      return success;
    } catch (error) {
      console.error('오디오 초기화 실패:', error);
      return false;
    } finally {
      setIsInitializing(false);
    }
  }, [isInitializing, isAudioReady]);

  // 메트로놈 인스턴스 생성 (웹소켓과 무관)
  useEffect(() => {
    if (metronomeRef.current) return;

    const metronome = new Metronome(null);
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
    metronome.setOnBeat((beatIdx, bpb) => {
      // beatIdx는 0 기반, UI는 1 기반으로 표시
      setCurrentBeat((beatIdx % bpb) + 1);
    });

    return () => {
      if (metronomeRef.current) {
        metronomeRef.current.destroy();
        metronomeRef.current = null;
      }
    };
  }, []);

  // 웹소켓 주입/변경
  useEffect(() => {
    if (!metronomeRef.current) return;
    metronomeRef.current.setWebSocket(websocket ?? null);
  }, [websocket]);

  // 메트로놈 시작
  const startMetronome = useCallback(async () => {
    if (!metronomeRef.current) {
      console.error('메트로놈이 초기화되지 않았습니다');
      return;
    }

    // 오디오가 준비되지 않은 경우 버튼(시작)에서 선초기화 실행
    const ok = isAudioReady ? true : await initializeAudio();
    if (!ok) {
      console.error('오디오 초기화 실패로 메트로놈을 시작할 수 없습니다');
      return;
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
    currentBeat,
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

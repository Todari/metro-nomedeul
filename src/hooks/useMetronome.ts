import { useEffect, useRef, useState } from 'react';
import { Metronome } from '../utils/metronome';

export const useMetronome = (websocket: WebSocket) => {
  const metronomeRef = useRef<Metronome | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tempo, setTempo] = useState(128);
  const [beats, setBeats] = useState(4);

  useEffect(() => {
    if (!websocket) {
      console.error('websocket is not connected');
      return;
    }
    
    // 메트로놈 인스턴스 생성
    const metronome = new Metronome(websocket);
    metronomeRef.current = metronome;
    
    // 상태 변경 콜백 설정
    metronome.setOnPlayStateChange((playing) => {
      setIsPlaying(playing);
    });
    
    metronome.setOnTempoChange((newTempo) => {
      setTempo(newTempo);
    });

    metronome.setOnBeatsChange((newBeats) => {
      setBeats(newBeats);
    });
    
    return () => {
      // 정리 작업 (필요한 경우)
      if (metronome.isActive()) {
        metronome.requestStop();
      }
    };
  }, [websocket]);

  const startMetronome = () => {
    metronomeRef.current?.requestStart(tempo);
  };

  const stopMetronome = () => {
    metronomeRef.current?.requestStop();
  };

  const changeTempo = (newTempo: number) => {
    metronomeRef.current?.requestChangeTempo(newTempo);
  };

  const changeBeats = (newBeats: number) => {
    metronomeRef.current?.requestChangeBeats(newBeats);
  };

  return {
    isPlaying,
    tempo,
    beats,
    startMetronome,
    stopMetronome,
    changeTempo,
    changeBeats
  };
};

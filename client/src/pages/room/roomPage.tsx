import { useEffect, useMemo, useState } from "react";
import { css } from "../../../styled-system/css";
import { vstack } from "../../../styled-system/patterns";
import { useParams } from "react-router-dom";
import { useWebSocket } from "../../hooks/useWebSocket";
import { CONFIG } from "../../apis/config";
import { useMetronome } from "../../hooks/useMetronome";
import { BasicMetronomeControls } from "../../components/BasicMetronomeControls";
import { SettingsBottomSheet } from "../../components/SettingsBottomSheet";
import { BeatCard } from "../../components/BeatCard";
import { Header } from "../../components/Header";

export const RoomPage = () => {
  const { uuid } = useParams();
  const wsUrl = useMemo(() => `${CONFIG.WS_URL}/${uuid}?userId=client-${Math.random().toString(36).slice(2)}`, [uuid]);
  const { messages, socket } = useWebSocket(wsUrl);
  const { isPlaying, tempo, beats, startMetronome, stopMetronome, changeTempo, changeBeats, tapTempo, clearTapTimes, getTapCount } = useMetronome(socket);

  const [localTempo, setLocalTempo] = useState(tempo);
  const [localBeats, setLocalBeats] = useState(beats);
  const [currentBeat, setCurrentBeat] = useState(1);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    console.log(messages);
  }, [messages]);
  
  useEffect(() => {
    setLocalTempo(tempo);
  }, [tempo]);

  useEffect(() => {
    setLocalBeats(beats);
  }, [beats]);

  // 박자 카운터 시뮬레이션 (실제로는 서버에서 받아와야 함)
  useEffect(() => {
    if (!isPlaying) {
      setCurrentBeat(1);
      return;
    }

    const interval = setInterval(() => {
      setCurrentBeat(prev => {
        if (prev >= localBeats) {
          return 1; // 다음 마디로
        }
        return prev + 1;
      });
    }, (60 / localTempo) * 1000); // BPM에 따른 간격

    return () => clearInterval(interval);
  }, [isPlaying, localTempo, localBeats]);
  
  const handleStartMetronome = () => {
    startMetronome();
  };

  const handleStopMetronome = () => {
    stopMetronome();
  };

  const handleTapTempo = () => {
    tapTempo();
  };

  const handleClearTap = () => {
    clearTapTimes();
  };

  const handleSettingsClick = () => {
    setIsSettingsOpen(true);
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
  };

  return (
    <div className={vstack({alignItems: 'stretch', gap: 0, h: '100dvh' })}>
      <Header />
      <div className={vstack({ gap: 4, alignItems: 'stretch', maxW: '4xl', h: 'full' })}>
        
        {/* 박자 카드 */}
        <div className={css({ display: 'flex', justifyContent: 'center', alignItems: 'center', w: 'full', h: 'fit-content' })}>
          <BeatCard 
            currentBeat={currentBeat} 
            isPlaying={isPlaying}
          />
        </div>

        {/* QR 코드 */}
        {/* {uuid && (
          <div className={css({ p: 6, bg: 'neutral.800', rounded: '2xl', border: '1px solid', borderColor: 'neutral.700', shadow: 'lg' })}>
            <QrDisplay uuid={uuid} />
          </div>
        )} */}

        {/* 메트로놈 컨트롤 */}
        <BasicMetronomeControls
          isPlaying={isPlaying}
          tempo={localTempo}
          beats={localBeats}
          onStart={handleStartMetronome}
          onStop={handleStopMetronome}
          onSettingsClick={handleSettingsClick}
        />

        {/* 설정 바텀시트 */}
        <SettingsBottomSheet
          isOpen={isSettingsOpen}
          onClose={handleCloseSettings}
          tempo={localTempo}
          beats={localBeats}
          onTempoChange={(t) => { setLocalTempo(t); changeTempo(t); }}
          onBeatsChange={(b) => { setLocalBeats(b); changeBeats(b); }}
          onTapTempo={handleTapTempo}
          onClearTap={handleClearTap}
          tapCount={getTapCount()}
        />
      </div>
    </div>
  );
};

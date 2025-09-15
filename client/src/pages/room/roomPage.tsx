import { useEffect, useMemo, useState } from "react";
import { css } from "../../../styled-system/css";
import { vstack } from "../../../styled-system/patterns";
import { useParams } from "react-router-dom";
import { useWebSocket } from "../../hooks/useWebSocket";
import { CONFIG } from "../../apis/config";
import { useMetronome } from "../../hooks/useMetronome";
import { MetronomeControls } from "../../components/MetronomeControls";
import { SettingsBottomSheet } from "../../components/SettingsBottomSheet";
import { BeatCard } from "../../components/BeatCard";
import { Header } from "../../components/Header";

export const RoomPage = () => {
  const { uuid } = useParams();
  const wsUrl = useMemo(() => `${CONFIG.WS_URL}/${uuid}?userId=client-${Math.random().toString(36).slice(2)}`, [uuid]);
  const { messages, socket } = useWebSocket(wsUrl);
  const { 
    isPlaying, 
    tempo, 
    beats, 
    currentBeat,
    isInitializing,
    startMetronome, 
    stopMetronome, 
    changeTempo, 
    changeBeats, 
    tapTempo, 
    clearTapTimes, 
    getTapCount
  } = useMetronome(socket);

  const [localTempo, setLocalTempo] = useState(tempo);
  const [localBeats, setLocalBeats] = useState(beats);
  // 엔진 비트 콜백과 동기화하므로 로컬 카운터 제거
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

  // 엔진에서 비트 콜백을 통해 동기화하므로 별도 카운터 불필요
  
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
        <div className={css({ display: 'flex', justifyContent: 'center', alignItems: 'center', w: 'full', h: 'full' })}>
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
        <MetronomeControls
          isPlaying={isPlaying}
          tempo={localTempo}
          beats={localBeats}
          isInitializing={isInitializing}
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

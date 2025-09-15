import { useEffect, useMemo, useState, useRef } from "react";
import { css } from "../../../styled-system/css";
import { vstack } from "../../../styled-system/patterns";
import { useParams } from "react-router-dom";
import { useWebSocket } from "../../hooks/useWebSocket";
import { CONFIG } from "../../apis/config";
import { useMetronome } from "../../hooks/useMetronome";
import { MetronomeState } from "../../types/model";
import { MetronomeControls } from "../../components/MetronomeControls";
import { SettingsBottomSheet } from "../../components/SettingsBottomSheet";
import { ShareBottomSheet } from "../../components/ShareBottomSheet";
import { BeatCard } from "../../components/BeatCard";
import { Header } from "../../components/Header";

export const RoomPage = () => {
  const { uuid } = useParams();
  const wsUrl = useMemo(() => `${CONFIG.WS_URL}/${uuid}?userId=client-${Math.random().toString(36).slice(2)}`, [uuid]);
  
  // WebSocket 메시지 핸들러를 위한 ref
  const messageHandlerRef = useRef<((data: MetronomeState) => void) | null>(null);
  
  const { messages, socket, sendMessage } = useWebSocket(wsUrl, messageHandlerRef.current || undefined);
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
    getTapCount,
    handleWebSocketMessage
  } = useMetronome(socket, sendMessage);

  const [localTempo, setLocalTempo] = useState(tempo);
  const [localBeats, setLocalBeats] = useState(beats);
  // 엔진 비트 콜백과 동기화하므로 로컬 카운터 제거
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // WebSocket 메시지 핸들러 설정
  useEffect(() => {
    messageHandlerRef.current = handleWebSocketMessage;
  }, [handleWebSocketMessage]);

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

  const handleShareClick = () => {
    setIsShareOpen(true);
  };

  const handleCloseShare = () => {
    setIsShareOpen(false);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToast('복사되었습니다');
      setTimeout(() => setToast(null), 1500);
    } catch {
      setToast('복사 실패');
      setTimeout(() => setToast(null), 1500);
    }
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
          onShareClick={handleShareClick}
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

        <ShareBottomSheet isOpen={isShareOpen} onClose={handleCloseShare} uuid={uuid} onCopied={handleCopyLink} />

        {/* 토스트 */}
        {toast && (
          <div className={css({ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', bg: 'black/80', color: 'white', px: 4, py: 2, rounded: 'md', zIndex: 60 })}>{toast}</div>
        )}
      </div>
    </div>
  );
};

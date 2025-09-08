import { useEffect, useMemo, useState } from "react";
import { css } from "../../../styled-system/css";
import { vstack } from "../../../styled-system/patterns";
import { useParams } from "react-router-dom";
import { useWebSocket } from "../../hooks/useWebSocket";
import { CONFIG } from "../../apis/config";
import { useMetronome } from "../../hooks/useMetronome";
import { QrDisplay } from "../../components/QrDisplay";
import { MetronomeControls } from "../../components/MetronomeControls";

export const RoomPage = () => {
  const { uuid } = useParams();
  const wsUrl = useMemo(() => `${CONFIG.WS_URL}/${uuid}?userId=client-${Math.random().toString(36).slice(2)}`, [uuid]);
  const { messages, socket } = useWebSocket(wsUrl);
  const { isPlaying, tempo, beats, startMetronome, stopMetronome, changeTempo, changeBeats, tapTempo, clearTapTimes, getTapCount } = useMetronome(socket);

  const [localTempo, setLocalTempo] = useState(tempo);
  const [localBeats, setLocalBeats] = useState(beats);

  useEffect(() => {
    console.log(messages);
  }, [messages]);
  
  useEffect(() => {
    setLocalTempo(tempo);
  }, [tempo]);

  useEffect(() => {
    setLocalBeats(beats);
  }, [beats]);
  
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

  return (
    <div className={vstack({ gap: 6, alignItems: 'stretch' })}>
      <h1 className={css({ color: 'gray.900', fontSize: '2xl', fontWeight: 'bold', letterSpacing: '-0.02em' })}>메트로놈들</h1>
      {uuid && (
        <div className={css({ p: 4, bg: 'white', rounded: 'xl', border: '1px solid', borderColor: 'gray.300', shadow: 'sm' })}>
          <QrDisplay uuid={uuid} />
        </div>
      )}
      <MetronomeControls
        isPlaying={isPlaying}
        tempo={localTempo}
        beats={localBeats}
        onStart={handleStartMetronome}
        onStop={handleStopMetronome}
        onTempoChange={(t) => { setLocalTempo(t); changeTempo(t); }}
        onBeatsChange={(b) => { setLocalBeats(b); changeBeats(b); }}
        onTapTempo={handleTapTempo}
        onClearTap={handleClearTap}
        tapCount={getTapCount()}
      />
    </div>
  );
};

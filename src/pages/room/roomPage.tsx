import { useEffect, useMemo, useState } from "react";
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
  const { isPlaying, tempo, beats, startMetronome, stopMetronome, changeTempo, changeBeats } = useMetronome(socket);

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

  return (
  <>
      <h1>메트로놈들</h1>
      {uuid && <QrDisplay uuid={uuid} />}
      <MetronomeControls
        isPlaying={isPlaying}
        tempo={localTempo}
        beats={localBeats}
        onStart={handleStartMetronome}
        onStop={handleStopMetronome}
        onTempoChange={(t) => { setLocalTempo(t); changeTempo(t); }}
        onBeatsChange={(b) => { setLocalBeats(b); changeBeats(b); }}
      />
    </>);
};

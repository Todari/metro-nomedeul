import { useParams } from "react-router-dom";
import { useWebSocket } from "../../hooks/useWebSocket";
import { CONFIG } from "../../apis/config";
import { useMetronome } from "../../hooks/useMetronome";
import { useEffect } from "react";

export const RoomPage = () => {
  const { uuid } = useParams();
  const { messages, sendMessage, socket } = useWebSocket(`${CONFIG.WS_URL}/${uuid}`);
  const { isPlaying, tempo, beats, startMetronome, stopMetronome, changeTempo, changeBeats } = useMetronome(socket);

  useEffect(() => {
    console.log(messages);
  }, [messages]);
  
  const handleStartMetronome = () => {
    startMetronome();
  };

  const handleStopMetronome = () => {
    stopMetronome();
  };

  return (
  <>
      <h1>메트로놈들</h1>
      <button onClick={handleStartMetronome}>메트로놈 시작</button>
      <button onClick={handleStopMetronome}>메트로놈 중지</button>
    </>);
};

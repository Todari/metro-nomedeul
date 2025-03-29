import { useEffect } from "react";
import { useRequestPostRoom } from "./hooks/useRequestPostRoom";
import { useNavigate } from "react-router-dom";

function App() {
  const { mutate: createRoom, data, isSuccess, isPending, isError, error } = useRequestPostRoom();
  const navigate = useNavigate();

  const handleCreateRoom = () => {
    createRoom();
  };

  useEffect(() => {
    if (isSuccess) {
      navigate(`/room/${data.uuid}`);
    }
  }, [isSuccess, data, navigate]);

  return (
    <>
      <h1>메트로놈들</h1>
      <button onClick={handleCreateRoom}>방 생성하기</button>
      <button>방 입장하기</button>
    </>
  )
}

export default App

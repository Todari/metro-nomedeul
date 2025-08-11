import { useEffect, useState } from "react";
import { useRequestPostRoom } from "./hooks/useRequestPostRoom";
import { useNavigate } from "react-router-dom";
import { QrScanner } from "./components/QrScanner";

function App() {
  const { mutate: createRoom, data, isSuccess } = useRequestPostRoom();
  const navigate = useNavigate();

  const handleCreateRoom = () => {
    createRoom();
  };
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    if (isSuccess) {
      navigate(`/room/${data.uuid}`);
    }
  }, [isSuccess, data, navigate]);

  return (
    <>
      <h1>메트로놈들</h1>
      <button onClick={handleCreateRoom}>방 생성하기</button>
      <button onClick={() => setShowScanner((v) => !v)}>방 입장하기</button>
      {showScanner && (
        <div style={{ marginTop: 16 }}>
          <QrScanner
            onDetected={(text) => {
              try {
                const url = new URL(text);
                const parts = url.pathname.split('/');
                const idx = parts.findIndex((p) => p === 'room');
                if (idx >= 0 && parts[idx + 1]) {
                  navigate(`/room/${parts[idx + 1]}`);
                }
              } catch {
                // 텍스트에 URL이 없으면 uuid로 가정
                navigate(`/room/${text}`);
              }
            }}
            onError={(e) => {
              console.error(e);
              alert('카메라 접근 혹은 QR 감지 실패');
            }}
          />
        </div>
      )}
    </>
  )
}

export default App

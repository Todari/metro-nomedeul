import { useEffect, useState } from "react";
import { css } from "../styled-system/css";
import { vstack, hstack } from "../styled-system/patterns";
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
    <div className={vstack({ gap: 6, alignItems: 'stretch' })}>
      <div className={vstack({ gap: 2, alignItems: 'flex-start' })}>
        <h1 className={css({ color: 'gray.900', fontSize: '2xl', fontWeight: 'bold', letterSpacing: '-0.02em' })}>메트로놈들</h1>
        <p className={css({ color: 'gray.700', fontSize: 'sm' })}>방을 생성하거나 QR로 입장하세요</p>
      </div>

      <div className={hstack({ gap: 3 })}>
        <button
          className={css({
            px: 4,
            py: 2.5,
            rounded: 'lg',
            bg: 'blue.600',
            color: 'white',
            _hover: { bg: 'blue.700' },
            _active: { bg: 'blue.800' },
            transition: 'background-color 0.2s ease'
          })}
          onClick={handleCreateRoom}
        >
          방 생성하기
        </button>
        <button
          className={css({
            px: 4,
            py: 2.5,
            rounded: 'lg',
            bg: 'gray.300',
            color: 'black',
            _hover: { bg: 'gray.400' },
            _active: { bg: 'gray.500' },
            transition: 'background-color 0.2s ease'
          })}
          onClick={() => setShowScanner((v) => !v)}
        >
          방 입장하기
        </button>
      </div>

      {showScanner && (
        <div className={css({ mt: 4, p: 4, bg: 'white/70', rounded: 'xl', backdropFilter: 'saturate(180%) blur(8px)', border: '1px solid', borderColor: 'gray.300' })}>
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
    </div>
  )
}

export default App

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
          <div className={css({ mb: 3, textAlign: 'center' })}>
            <h3 className={css({ fontSize: 'lg', fontWeight: 'semibold', color: 'gray.800', mb: 1 })}>QR 코드 스캔</h3>
            <p className={css({ fontSize: 'sm', color: 'gray.600' })}>방의 QR 코드를 카메라에 비춰주세요</p>
          </div>
          <QrScanner
            onDetected={(text) => {
              console.log('QR 코드 감지:', text);
              try {
                // URL 형태인 경우 파싱
                const url = new URL(text);
                const parts = url.pathname.split('/');
                const idx = parts.findIndex((p) => p === 'room');
                if (idx >= 0 && parts[idx + 1]) {
                  const roomId = parts[idx + 1];
                  console.log('방 ID 추출:', roomId);
                  navigate(`/room/${roomId}`);
                } else {
                  // URL이지만 room 경로가 아닌 경우
                  alert('올바른 방 QR 코드가 아닙니다.');
                }
              } catch {
                // URL이 아닌 경우 직접 방 ID로 처리
                if (text.length === 8) {
                  console.log('직접 방 ID 입력:', text);
                  navigate(`/room/${text}`);
                } else {
                  alert('올바른 방 ID가 아닙니다. 8자리 코드를 확인해주세요.');
                }
              }
            }}
            onError={(e) => {
              console.error('QR 스캐너 오류:', e);
              // 에러 메시지는 QrScanner 컴포넌트에서 처리됨
            }}
          />
        </div>
      )}
    </div>
  )
}

export default App

import { useEffect, useState } from "react";
import { css } from "../styled-system/css";
import { vstack, hstack } from "../styled-system/patterns";
import { useRequestPostRoom } from "./hooks/useRequestPostRoom";
import { useNavigate } from "react-router-dom";
import { QrScanner } from "./components/QrScanner";
import { Button } from "./components/Button";
import { Header } from "./components/Header";

function App() {
  const { mutate: createRoom, data, isSuccess } = useRequestPostRoom();
  const navigate = useNavigate();

  const handleCreateRoom = () => {
    createRoom();
  };
  const [showScanner] = useState(false);

  useEffect(() => {
    if (isSuccess) {
      navigate(`/room/${data.uuid}`);
    }
  }, [isSuccess, data, navigate]);

  return (
    <div className={vstack({alignItems: 'stretch', gap: 0 })}>
      <Header />
      <div className={vstack({ gap: 4, p: 4, alignItems: 'flex-start' })}>
        <div
          className={css({
            w: 'full',
            p: 6,
            bg: 'neutral.800',
            rounded: '2xl',
          })}
        >
          <div className={vstack({ gap: 6, alignItems: 'flex-start' })}>
            <h2 className={css({ fontSize: 'xl', fontWeight: 'bold', color: 'white' })}>
              메트로놈이 모여 메트로놈"들"
            </h2>
            <p className={css({ color: 'neutral.500', lineHeight: '1.7' })}>
              메트로놈들은 여러명이 동시에 클릭을 들을 수 있게 해줍니다.
              아래와 같은 상황에서 사용해 보세요.
            </p>

            <div className={vstack({ gap: 3, alignItems: 'flex-start' })}>
              <span className={css({ color: 'neutral.300', fontWeight:'bold' })}>🎤 보컬이 이어폰을 끼고 노래부르고 싶을때!</span>
              <span className={css({ color: 'neutral.300', fontWeight:'bold' })}>🥁 드럼이 박자를 제대로 맞추는지 검사할때!</span>
              <span className={css({ color: 'neutral.300', fontWeight:'bold' })}>🎸 기타가 드럼소리를 안듣고 지 맘대로 칠 때!</span>
              <span className={css({ color: 'neutral.300', fontWeight:'bold' })}>🦻 베이스의 소리가 안들릴 때!</span>
            </div>

            <p className={css({ color: 'neutral.500', fontWeight: 'semibold', mt: 2 })}>
              메트로놈들과 함께 박자잘맞추는놈들이 되어봅시다
            </p>
          </div>
        </div>

        
        
          <Button
            variant="primary"
            onClick={handleCreateRoom}
            aria-label="방 생성하기"
            className={css({ w: 'full' })}
          >
            방 생성하기
          </Button>
          {/* <Button
            variant="secondary"
            onClick={() => setShowScanner((v) => !v)}
            aria-label="방 입장하기"
          >
            방 입장하기
          </Button> */}
        

        {showScanner && (
          <div className={css({ mt: 4, p: 4, bg: 'white/70', rounded: 'xl', backdropFilter: 'saturate(180%) blur(8px)', border: '1px solid', borderColor: 'neutral.300' })}>
            <div className={css({ mb: 3, textAlign: 'center' })}>
              <h3 className={css({ fontSize: 'lg', fontWeight: 'semibold', color: 'neutral.800', mb: 1 })}>QR 코드 스캔</h3>
              <p className={css({ fontSize: 'sm', color: 'neutral.600' })}>방의 QR 코드를 카메라에 비춰주세요</p>
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
    </div>
  )
}

export default App

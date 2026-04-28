import { useEffect, useState } from "react";
import { css } from "../styled-system/css";
import { hstack, vstack } from "../styled-system/patterns";
import { useRequestPostRoom } from "./hooks/useRequestPostRoom";
import { useNavigate } from "react-router-dom";
import { QrScanner } from "./components/QrScanner";
import { Button } from "./components/Button";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { trackEvent } from "./ga";

const SCENARIOS: Array<{ emoji: string; text: string }> = [
  { emoji: '🎤', text: '보컬이 이어폰을 끼고 노래 부르고 싶을 때' },
  { emoji: '🥁', text: '드럼이 박자를 제대로 맞추는지 검사할 때' },
  { emoji: '🎸', text: '기타가 드럼 소리를 안 듣고 지 맘대로 칠 때' },
  { emoji: '🎻', text: '베이스 소리가 안 들릴 때' },
];

const FAQ_ITEMS: Array<{ q: string; a: string }> = [
  {
    q: '정말 같은 박자로 동시에 들리나요?',
    a: '서버 시간 기준으로 비트를 스케줄하고 클라이언트마다 네트워크 왕복 시간(RTT)을 측정해 보정합니다. 일반적인 Wi-Fi 환경에서 ±5~10ms 오차로 동기화되어 실연주에 충분합니다.',
  },
  {
    q: '한 방에 몇 명까지 동시에 접속할 수 있나요?',
    a: '한 방당 최대 20명까지 동시에 접속 가능합니다. 합주, 합창, 군무 등 일반적인 그룹 활동에 충분한 규모입니다.',
  },
  {
    q: '방은 얼마나 유지되나요?',
    a: '방 생성 후 24시간 동안 유지되며, 그 이후엔 자동 삭제됩니다. 장기 사용이 필요하면 그때마다 새 방을 만들어 사용해주세요.',
  },
  {
    q: '어떤 브라우저에서 동작하나요?',
    a: 'Chrome, Safari, Firefox, Edge 모두 지원하며 모바일(iOS / Android)에서도 작동합니다. Web Audio API를 사용하므로 최신 버전 브라우저를 권장합니다.',
  },
  {
    q: '회원가입이나 결제가 필요한가요?',
    a: '아니요. 회원가입, 로그인, 결제 모두 필요 없습니다. 방을 만들고 링크 또는 QR 코드만 공유하면 바로 사용할 수 있습니다.',
  },
  {
    q: '인터넷 연결이 끊기면 어떻게 되나요?',
    a: '자동으로 재연결을 시도하며, 복구되는 즉시 다른 참가자들과 박자가 다시 동기화됩니다. 잠깐 끊겨도 합주를 멈출 필요 없습니다.',
  },
];

const Badge = ({ children }: { children: string }) => (
  <span
    className={css({
      px: 3,
      py: 1,
      bg: 'neutral.700',
      color: 'neutral.200',
      rounded: 'full',
      fontSize: 'xs',
      fontWeight: 'semibold',
    })}
  >
    {children}
  </span>
);

const Card = ({ children }: { children: React.ReactNode }) => (
  <div
    className={css({
      w: 'full',
      p: 6,
      bg: 'neutral.800',
      rounded: '2xl',
    })}
  >
    {children}
  </div>
);

const SectionTitle = ({ children }: { children: string }) => (
  <h2 className={css({ fontSize: 'xl', fontWeight: 'bold', color: 'white' })}>
    {children}
  </h2>
);

function App() {
  const { mutate: createRoom, data, isSuccess, isPending } = useRequestPostRoom();
  const navigate = useNavigate();

  const handleCreateRoom = () => {
    if (isPending) return;
    createRoom();
  };
  const [showScanner] = useState(false);

  useEffect(() => {
    if (isSuccess && data?.uuid) {
      trackEvent('create_room');
      navigate(`/room/${data.uuid}`);
    }
  }, [isSuccess, data, navigate]);

  return (
    <div className={vstack({ alignItems: 'stretch', gap: 0 })}>
      <Header />
      <div className={vstack({ gap: 4, p: 4, alignItems: 'flex-start' })}>
        <Card>
          <div className={vstack({ gap: 6, alignItems: 'flex-start' })}>
            <SectionTitle>메트로놈이 모여 메트로놈"들"</SectionTitle>

            <div
              className={hstack({
                gap: 2,
                flexWrap: 'wrap',
              })}
            >
              <Badge>무료</Badge>
              <Badge>회원가입 없음</Badge>
              <Badge>설치 없음</Badge>
            </div>

            <p className={css({ color: 'neutral.500', lineHeight: '1.7' })}>
              메트로놈들은 여러 명이 동시에 같은 클릭을 들을 수 있게 해주는 실시간 동기화 메트로놈입니다.
              아래와 같은 상황에서 사용해 보세요.
            </p>

            <div className={vstack({ gap: 3, alignItems: 'flex-start' })}>
              {SCENARIOS.map((s) => (
                <span
                  key={s.text}
                  className={css({
                    color: 'neutral.300',
                    fontWeight: 'bold',
                    lineHeight: '1.5',
                  })}
                >
                  {s.emoji} {s.text}
                </span>
              ))}
            </div>

            <p
              className={css({
                color: 'neutral.500',
                fontWeight: 'semibold',
                mt: 2,
              })}
            >
              메트로놈들과 함께 박자잘맞추는놈들이 되어봅시다
            </p>
          </div>
        </Card>

        <Card>
          <div className={vstack({ gap: 5, alignItems: 'flex-start' })}>
            <SectionTitle>사용 방법</SectionTitle>
            <div className={vstack({ gap: 4, alignItems: 'flex-start' })}>
              <div className={vstack({ gap: 1, alignItems: 'flex-start' })}>
                <span className={css({ color: 'white', fontWeight: 'bold' })}>1. 방 만들기</span>
                <span className={css({ color: 'neutral.500', fontSize: 'sm' })}>
                  아래 버튼을 눌러 방을 만드세요
                </span>
              </div>
              <div className={vstack({ gap: 1, alignItems: 'flex-start' })}>
                <span className={css({ color: 'white', fontWeight: 'bold' })}>2. 멤버 초대</span>
                <span className={css({ color: 'neutral.500', fontSize: 'sm' })}>
                  QR 코드나 링크를 공유하세요
                </span>
              </div>
              <div className={vstack({ gap: 1, alignItems: 'flex-start' })}>
                <span className={css({ color: 'white', fontWeight: 'bold' })}>3. 함께 연주</span>
                <span className={css({ color: 'neutral.500', fontSize: 'sm' })}>
                  재생 버튼을 누르면 모든 기기에서 동시에 클릭이 재생됩니다
                </span>
              </div>
            </div>
          </div>
        </Card>

        <Button
          variant="primary"
          onClick={handleCreateRoom}
          aria-label="방 생성하기"
          disabled={isPending}
          className={css({ w: 'full' })}
        >
          {isPending ? '방 만드는 중…' : '방 생성하기'}
        </Button>

        <Card>
          <div className={vstack({ gap: 4, alignItems: 'stretch' })}>
            <SectionTitle>자주 묻는 질문</SectionTitle>
            <div className={vstack({ gap: 2, alignItems: 'stretch' })}>
              {FAQ_ITEMS.map((item) => (
                <details
                  key={item.q}
                  className={css({
                    bg: 'neutral.900',
                    rounded: 'xl',
                    overflow: 'hidden',
                    '&[open] > summary::after': { transform: 'rotate(180deg)' },
                  })}
                >
                  <summary
                    className={css({
                      px: 4,
                      py: 3,
                      color: 'white',
                      fontWeight: 'semibold',
                      fontSize: 'sm',
                      cursor: 'pointer',
                      listStyle: 'none',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 3,
                      _hover: { bg: 'neutral.800' },
                      '&::-webkit-details-marker': { display: 'none' },
                      '&::after': {
                        content: '"⌄"',
                        color: 'neutral.500',
                        fontSize: 'lg',
                        lineHeight: '1',
                        transition: 'transform 0.15s ease',
                      },
                    })}
                  >
                    {item.q}
                  </summary>
                  <p
                    className={css({
                      px: 4,
                      pb: 4,
                      pt: 1,
                      color: 'neutral.400',
                      fontSize: 'sm',
                      lineHeight: '1.7',
                    })}
                  >
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </Card>

        <Button
          variant="primary"
          onClick={handleCreateRoom}
          aria-label="지금 바로 시작하기"
          disabled={isPending}
          className={css({ w: 'full' })}
        >
          {isPending ? '방 만드는 중…' : '지금 바로 시작하기'}
        </Button>

        {showScanner && (
          <div className={css({ mt: 4, p: 4, bg: 'white/70', rounded: 'xl', backdropFilter: 'saturate(180%) blur(8px)', border: '1px solid', borderColor: 'neutral.300' })}>
            <div className={css({ mb: 3, textAlign: 'center' })}>
              <h3 className={css({ fontSize: 'lg', fontWeight: 'semibold', color: 'neutral.800', mb: 1 })}>QR 코드 스캔</h3>
              <p className={css({ fontSize: 'sm', color: 'neutral.600' })}>방의 QR 코드를 카메라에 비춰주세요</p>
            </div>
            <QrScanner
              onDetected={(text) => {
                try {
                  const url = new URL(text);
                  const parts = url.pathname.split('/');
                  const idx = parts.findIndex((p) => p === 'room');
                  if (idx >= 0 && parts[idx + 1]) {
                    const roomId = parts[idx + 1];
                    navigate(`/room/${roomId}`);
                  } else {
                    alert('올바른 방 QR 코드가 아닙니다.');
                  }
                } catch {
                  if (text.length === 8) {
                    navigate(`/room/${text}`);
                  } else {
                    alert('올바른 방 ID가 아닙니다. 8자리 코드를 확인해주세요.');
                  }
                }
              }}
              onError={(e) => {
                console.error('QR 스캐너 오류:', e);
              }}
            />
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

export default App;

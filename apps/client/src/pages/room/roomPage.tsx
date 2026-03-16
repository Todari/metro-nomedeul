import { useEffect, useRef, useState } from 'react';
import { css } from '../../../styled-system/css';
import { vstack } from '../../../styled-system/patterns';
import { useParams } from 'react-router-dom';
import { useMetronome } from '../../hooks/useMetronome';
import { MetronomeControls } from '../../components/MetronomeControls';
import { SettingsBottomSheet } from '../../components/SettingsBottomSheet';
import { ShareBottomSheet } from '../../components/ShareBottomSheet';
import { BeatCard } from '../../components/BeatCard';
import { Header } from '../../components/Header';
import { getRoom } from '../../apis/room';

export const RoomPage = () => {
  const { uuid } = useParams();

  const {
    isPlaying,
    tempo,
    beats,
    currentBeat,
    isInitializing,
    isAudioReady,
    isConnected,
    audioError,
    startMetronome,
    stopMetronome,
    changeTempo,
    changeBeats,
    tapTempo,
    initializeAudio,
  } = useMetronome(uuid ?? '');

  // 방 존재 여부 확인
  const [roomError, setRoomError] = useState<'not_found' | 'error' | null>(
    null,
  );
  const [isRoomLoading, setIsRoomLoading] = useState(true);

  useEffect(() => {
    if (!uuid) {
      setRoomError('not_found');
      setIsRoomLoading(false);
      return;
    }
    getRoom(uuid)
      .then(() => setIsRoomLoading(false))
      .catch((err) => {
        setRoomError(err?.response?.status === 404 ? 'not_found' : 'error');
        setIsRoomLoading(false);
      });
  }, [uuid]);

  // 초기 로딩 시 깜빡임 방지: 2초 후부터 연결 끊김 표시
  const [showDisconnected, setShowDisconnected] = useState(false);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isConnected) {
      disconnectTimerRef.current = setTimeout(
        () => setShowDisconnected(true),
        2000,
      );
    } else {
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }
      setShowDisconnected(false);
    }
    return () => {
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current);
      }
    };
  }, [isConnected]);

  useEffect(() => {
    if (isAudioReady) return;

    const handleUserInteraction = () => {
      initializeAudio();
    };

    const events = ['click', 'touchstart', 'keydown'] as const;
    events.forEach((event) => {
      document.addEventListener(event, handleUserInteraction, {
        once: true,
        passive: true,
      });
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleUserInteraction);
      });
    };
  }, [initializeAudio, isAudioReady]);

  const [localTempo, setLocalTempo] = useState(tempo);
  const [localBeats, setLocalBeats] = useState(beats);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setLocalTempo(tempo);
  }, [tempo]);

  useEffect(() => {
    setLocalBeats(beats);
  }, [beats]);

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

  if (isRoomLoading) {
    return (
      <div
        className={vstack({
          alignItems: 'center',
          justifyContent: 'center',
          h: '100dvh',
          gap: 4,
        })}
      >
        <div
          className={css({
            fontSize: 'lg',
            color: 'neutral.400',
          })}
        >
          방을 불러오는 중...
        </div>
      </div>
    );
  }

  if (roomError) {
    return (
      <div
        className={vstack({
          alignItems: 'center',
          justifyContent: 'center',
          h: '100dvh',
          gap: 4,
        })}
      >
        <div
          className={css({
            fontSize: '2xl',
            fontWeight: 'bold',
            color: 'white',
          })}
        >
          {roomError === 'not_found'
            ? '방을 찾을 수 없습니다'
            : '오류가 발생했습니다'}
        </div>
        <div className={css({ fontSize: 'md', color: 'neutral.400' })}>
          {roomError === 'not_found'
            ? '유효하지 않은 방 주소입니다.'
            : '잠시 후 다시 시도해주세요.'}
        </div>
        <a
          href="/"
          className={css({
            mt: 4,
            px: 6,
            py: 3,
            bg: 'orange.600',
            color: 'white',
            rounded: 'lg',
            textDecoration: 'none',
            _hover: { bg: 'orange.700' },
          })}
        >
          홈으로 돌아가기
        </a>
      </div>
    );
  }

  return (
    <div className={vstack({ alignItems: 'stretch', gap: 0, h: '100dvh' })}>
      <Header />
      {showDisconnected && (
        <div
          className={css({
            bg: 'red.500/90',
            color: 'white',
            textAlign: 'center',
            py: 2,
            px: 4,
            fontSize: 'sm',
          })}
        >
          연결이 끊어졌습니다. 재연결 중...
        </div>
      )}
      {audioError && (
        <div
          className={css({
            bg: 'orange.500/90',
            color: 'white',
            textAlign: 'center',
            py: 2,
            px: 4,
            fontSize: 'sm',
          })}
        >
          {audioError}
        </div>
      )}
      <div
        className={vstack({
          gap: 4,
          alignItems: 'stretch',
          maxW: '4xl',
          h: 'full',
        })}
      >
        <div
          className={css({
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            w: 'full',
            h: 'full',
          })}
        >
          <BeatCard currentBeat={currentBeat} isPlaying={isPlaying} />
        </div>

        <MetronomeControls
          isPlaying={isPlaying}
          tempo={localTempo}
          beats={localBeats}
          isInitializing={isInitializing}
          onStart={startMetronome}
          onStop={stopMetronome}
          onSettingsClick={() => setIsSettingsOpen(true)}
          onShareClick={() => setIsShareOpen(true)}
          onStopForSettings={stopMetronome}
        />

        <SettingsBottomSheet
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          tempo={localTempo}
          beats={localBeats}
          isPlaying={isPlaying}
          onTempoChange={(t) => {
            setLocalTempo(t);
            changeTempo(t);
          }}
          onBeatsChange={(b) => {
            setLocalBeats(b);
            changeBeats(b);
          }}
          onTapTempo={tapTempo}
          onStopForSettings={stopMetronome}
        />

        <ShareBottomSheet
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          uuid={uuid}
          onCopied={handleCopyLink}
        />

        {toast && (
          <div
            className={css({
              position: 'fixed',
              bottom: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              bg: 'black/80',
              color: 'white',
              px: 4,
              py: 2,
              rounded: 'md',
              zIndex: 60,
            })}
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  );
};

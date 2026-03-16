import { useEffect, useState } from 'react';
import { css } from '../../../styled-system/css';
import { vstack } from '../../../styled-system/patterns';
import { useParams } from 'react-router-dom';
import { useMetronome } from '../../hooks/useMetronome';
import { MetronomeControls } from '../../components/MetronomeControls';
import { SettingsBottomSheet } from '../../components/SettingsBottomSheet';
import { ShareBottomSheet } from '../../components/ShareBottomSheet';
import { BeatCard } from '../../components/BeatCard';
import { Header } from '../../components/Header';

export const RoomPage = () => {
  const { uuid } = useParams();

  const {
    isPlaying,
    tempo,
    beats,
    currentBeat,
    isInitializing,
    isAudioReady,
    startMetronome,
    stopMetronome,
    changeTempo,
    changeBeats,
    tapTempo,
    initializeAudio,
  } = useMetronome(uuid ?? '');

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

  return (
    <div className={vstack({ alignItems: 'stretch', gap: 0, h: '100dvh' })}>
      <Header />
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

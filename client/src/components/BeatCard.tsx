import { useEffect, useState } from 'react';
import { css } from '../../styled-system/css';

interface BeatCardProps {
  currentBeat: number;
  isPlaying: boolean;
  className?: string;
}

export function BeatCard({ currentBeat, isPlaying, className }: BeatCardProps) {
  const [isAccent, setIsAccent] = useState(false);
  const [isRegular, setIsRegular] = useState(false);

  useEffect(() => {
    if (!isPlaying) {
      setIsAccent(false);
      setIsRegular(false);
      return;
    }

    // 첫 번째 박자 (강박)일 때
    if (currentBeat === 1) {
      setIsAccent(true);
      setIsRegular(false);
      
      // 200ms 후에 원래 색상으로 돌아가기
      const timer = setTimeout(() => {
        setIsAccent(false);
      }, 200);
      
      return () => clearTimeout(timer);
    } 
    // 일반 박자일 때
    else if (currentBeat > 1) {
      setIsRegular(true);
      setIsAccent(false);
      
      // 200ms 후에 원래 색상으로 돌아가기
      const timer = setTimeout(() => {
        setIsRegular(false);
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, [currentBeat, isPlaying]);

  return (
    <div
      className={css({
        p: 8,
        w:'full',
        aspectRatio: '1/1',
        rounded: '2xl',
        textAlign: 'center',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        bg: isAccent ? 'white' : isRegular ? 'neutral.300' : 'neutral.800',
        color: isAccent ? 'neutral.900' : isRegular ? 'neutral.800' : 'white',
  
        ...(className && { className })
      })}
    >
      <div className={css({ fontSize: '6xl', fontWeight: 'bold', mb: 2 })}>
        {currentBeat}
      </div>
      {/* <div className={css({ fontSize: 'lg', opacity: 0.8 })}>
        / {totalBeats}
      </div> */}
    </div>
  );
}

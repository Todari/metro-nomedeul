import { useState, useEffect, useRef, useCallback } from 'react';
import { css } from '../../styled-system/css';

interface ScrollPickerProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  height?: number;
  itemHeight?: number;
  className?: string;
}

export function ScrollPicker({
  min,
  max,
  value,
  onChange,
  step = 1,
  height = 280,
  itemHeight = 40,
  className
}: ScrollPickerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startOffset, setStartOffset] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const isDraggingRef = useRef(false);

  // 값 목록 생성 (역순으로 정렬)
  const values = Array.from(
    { length: Math.floor((max - min) / step) + 1 },
    (_, i) => min + i * step
  ).reverse();

  // 현재 선택된 값의 인덱스
  const selectedIndex = values.indexOf(value);
  
  // 중앙 정렬을 위한 오프셋 계산
  const centerOffset = (height - itemHeight) / 2;

  // 초기 오프셋 설정
  useEffect(() => {
    if (selectedIndex !== -1 && !isDraggingRef.current && !isAnimating) {
      // 선택된 아이템이 중앙에 오도록 오프셋 계산
      const newOffset = -selectedIndex * itemHeight;
      setOffset(newOffset);
    }
  }, [selectedIndex, itemHeight, isAnimating]);


  // 스냅 애니메이션
  const snapToValue = useCallback((targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= values.length) return;
    
    setIsAnimating(true);
    const targetOffset = -targetIndex * itemHeight;
    
    const startTime = performance.now();
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / 300, 1); // 300ms 애니메이션
      
      // easeOutCubic 이징 함수
      const easeOutCubic = 1 - Math.pow(1 - progress, 3);
      
      const currentOffset = offset + (targetOffset - offset) * easeOutCubic;
      setOffset(currentOffset);
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setOffset(targetOffset);
        setIsAnimating(false);
        onChange(values[targetIndex]);
      }
    };
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    animationRef.current = requestAnimationFrame((time) => animate(time));
  }, [offset, itemHeight, values, onChange]);

  // 마우스/터치 이벤트 핸들러
  const handleStart = useCallback((clientY: number) => {
    if (isAnimating) return;
    
    setIsDragging(true);
    isDraggingRef.current = true;
    setStartY(clientY);
    setStartOffset(offset);
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      setIsAnimating(false);
    }
  }, [isAnimating, offset]);

  const handleMove = useCallback((clientY: number) => {
    if (!isDraggingRef.current) return;
    
    const deltaY = clientY - startY;
    const newOffset = startOffset + deltaY; // 원래 방향으로 복원
    setOffset(newOffset);

    // 이동 중에도 중앙값을 실시간 반영
    const idx = Math.round(-newOffset / itemHeight);
    const clampedIdx = Math.max(0, Math.min(values.length - 1, idx));
    const nextVal = values[clampedIdx];
    if (nextVal !== value) {
      onChange(nextVal);
    }
  }, [startY, startOffset, itemHeight, values, value, onChange]);

  const handleEnd = useCallback(() => {
    if (!isDraggingRef.current) return;
    
    setIsDragging(false);
    isDraggingRef.current = false;
    
    // 가장 가까운 값으로 스냅
    const currentIndex = Math.round(-offset / itemHeight);
    const clampedIndex = Math.max(0, Math.min(values.length - 1, currentIndex));
    snapToValue(clampedIndex);
  }, [offset, itemHeight, values.length, snapToValue]);

  // 마우스 이벤트
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientY);
  }, [handleStart]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    handleMove(e.clientY);
  }, [handleMove]);

  const handleMouseUp = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  // 터치 이벤트
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    handleStart(e.touches[0].clientY);
  }, [handleStart]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    handleMove(e.touches[0].clientY);
  }, [handleMove]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    e.preventDefault();
    handleEnd();
  }, [handleEnd]);

  // 휠 이벤트
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    if (isAnimating) return;
    
    const delta = e.deltaY > 0 ? 1 : -1; // 원래 방향으로 복원
    const currentIndex = Math.round(-offset / itemHeight);
    const newIndex = Math.max(0, Math.min(values.length - 1, currentIndex + delta));
    snapToValue(newIndex);
  }, [isAnimating, offset, itemHeight, values.length, snapToValue]);

  // 이벤트 리스너 등록/해제
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  // 컴포넌트 언마운트 시 애니메이션 정리
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={css({
        position: 'relative',
        height: `${height}px`,
        overflow: 'hidden',
        userSelect: 'none',
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        ...(className && { className })
      })}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onWheel={handleWheel}
    >
      {/* 선택 영역 표시 */}
      <div
        className={css({
          position: 'absolute',
          top: '50%',
          left: '0',
          right: '0',
          height: `${itemHeight}px`,
          transform: 'translateY(-50%)',
          backgroundColor: 'orange.500/20',
          borderRadius: 'lg',
          pointerEvents: 'none',
          zIndex: 2
        })}
      />
      
      {/* 값 목록 */}
      <div
        style={{
          position: 'absolute',
          top: `${centerOffset + offset}px`,
          left: '0',
          right: '0',
          transition: isAnimating ? 'none' : 'top 0.1s ease-out'
        }}
      >
        {values.map((val, index) => {
          const isSelected = val === value;
          const distance = Math.abs(index - selectedIndex);
          const opacity = Math.max(0.3, 1 - distance * 0.2);
          const scale = Math.max(0.8, 1 - distance * 0.1);
          
          return (
            <div
              key={val}
              className={css({
                height: `${itemHeight}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isSelected ? 'xl' : 'lg',
                fontWeight: isSelected ? 'bold' : 'normal',
                color: isSelected ? 'orange.400' : 'neutral.300',
                opacity,
                transform: `scale(${scale})`,
                transition: 'all 0.2s ease-out'
              })}
            >
              {val}
            </div>
          );
        })}
      </div>
    </div>
  );
}

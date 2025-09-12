import { useState, useEffect, useRef, useCallback } from 'react';
import { css } from '../../styled-system/css';

interface HorizontalScrollPickerProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  width?: number;
  itemWidth?: number;
  className?: string;
}

export function HorizontalScrollPicker({
  min,
  max,
  value,
  onChange,
  step = 1,
  width = 200,
  itemWidth = 40,
  className
}: HorizontalScrollPickerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startOffset, setStartOffset] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const isDraggingRef = useRef(false);

  // 값 목록 생성
  const values = Array.from(
    { length: Math.floor((max - min) / step) + 1 },
    (_, i) => min + i * step
  );

  // 현재 선택된 값의 인덱스
  const selectedIndex = values.indexOf(value);
  
  // 중앙 정렬을 위한 오프셋 계산 (동적으로 계산)
  const [centerOffset, setCenterOffset] = useState((width - itemWidth) / 2);
  
  // 컨테이너 크기 변경 시 centerOffset 업데이트
  useEffect(() => {
    const updateCenterOffset = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        setCenterOffset((containerWidth - itemWidth) / 2);
      }
    };
    
    updateCenterOffset();
    window.addEventListener('resize', updateCenterOffset);
    
    return () => {
      window.removeEventListener('resize', updateCenterOffset);
    };
  }, [itemWidth]);

  // 초기 오프셋 설정
  useEffect(() => {
    if (selectedIndex !== -1) {
      // 선택된 아이템이 중앙에 오도록 오프셋 계산
      const newOffset = -selectedIndex * itemWidth;
      setOffset(newOffset);
    }
  }, [selectedIndex, itemWidth]);

  // 스냅 애니메이션
  const snapToValue = useCallback((targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= values.length) return;
    
    setIsAnimating(true);
    const targetOffset = -targetIndex * itemWidth;
    
    const startTime = performance.now();
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / 300, 1); // 300ms 애니메이션
      
      // easeOutCubic 이징 함수
      const easeOutCubic = 1 - Math.pow(1 - progress, 3);
      
      const currentOffset = offset + (targetOffset - offset) * easeOutCubic;
      setOffset(currentOffset);
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame((time) => animate(time));
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
  }, [offset, itemWidth, values, onChange]);

  // 마우스/터치 이벤트 핸들러
  const handleStart = useCallback((clientX: number) => {
    if (isAnimating) return;
    
    setIsDragging(true);
    isDraggingRef.current = true;
    setStartX(clientX);
    setStartOffset(offset);
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      setIsAnimating(false);
    }
  }, [isAnimating, offset]);

  const handleMove = useCallback((clientX: number) => {
    if (!isDraggingRef.current) return;
    
    const deltaX = clientX - startX;
    const newOffset = startOffset + deltaX;
    setOffset(newOffset);
  }, [startX, startOffset]);

  const handleEnd = useCallback(() => {
    if (!isDraggingRef.current) return;
    
    setIsDragging(false);
    isDraggingRef.current = false;
    
    // 가장 가까운 값으로 스냅
    const currentIndex = Math.round(-offset / itemWidth);
    const clampedIndex = Math.max(0, Math.min(values.length - 1, currentIndex));
    snapToValue(clampedIndex);
  }, [offset, itemWidth, values.length, snapToValue]);

  // 마우스 이벤트
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX);
  }, [handleStart]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    handleMove(e.clientX);
  }, [handleMove]);

  const handleMouseUp = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  // 터치 이벤트
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    handleStart(e.touches[0].clientX);
  }, [handleStart]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    handleMove(e.touches[0].clientX);
  }, [handleMove]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    e.preventDefault();
    handleEnd();
  }, [handleEnd]);

  // 휠 이벤트
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    if (isAnimating) return;
    
    const delta = e.deltaY > 0 ? 1 : -1;
    const currentIndex = Math.round(-offset / itemWidth);
    const newIndex = Math.max(0, Math.min(values.length - 1, currentIndex + delta));
    snapToValue(newIndex);
  }, [isAnimating, offset, itemWidth, values.length, snapToValue]);

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
        width: '100%',
        height: `${itemWidth}px`,
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
          left: '50%',
          top: '0',
          bottom: '0',
          width: `${itemWidth}px`,
          transform: 'translateX(-50%)',
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
          left: `${centerOffset + offset}px`,
          top: '0',
          bottom: '0',
          transition: isAnimating ? 'none' : 'left 0.1s ease-out',
          display: 'flex'
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
                width: `${itemWidth}px`,
                height: `${itemWidth}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isSelected ? 'lg' : 'md',
                fontWeight: isSelected ? 'bold' : 'normal',
                color: isSelected ? 'orange.400' : 'neutral.300',
                opacity,
                transform: `scale(${scale})`,
                transition: 'all 0.2s ease-out',
                flexShrink: 0
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

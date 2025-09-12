import { useEffect, useRef, useState } from 'react';
import { css } from "../../styled-system/css";

declare global {
  interface Window {
    BarcodeDetector?: typeof BarcodeDetector;
  }
  // lib.dom.d.ts가 없는 환경을 위한 선언 보호
  const BarcodeDetector: {
    new (options?: { formats?: string[] }): BarcodeDetector;
    getSupportedFormats?: () => Promise<string[]>;
  };
  interface BarcodeDetector {
    detect(source: CanvasImageSource | ImageBitmapSource | HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
  }
}

interface QrScannerProps {
  onDetected: (text: string) => void;
  onError?: (err: unknown) => void;
}

// 경량 대체: Native BarcodeDetector API 사용 (iOS 17+/안드로이드 크롬 최신)
// 미지원 시 input[type=file] 대체로 폴백
export function QrScanner({ onDetected, onError }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let rafId = 0;
    let detector: BarcodeDetector | null = null;

    async function setup() {
      try {
        setIsLoading(true);
        setError(null);
        
        // 카메라 권한 확인
        const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
        if (permission.state === 'denied') {
          throw new Error('카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.');
        }

        const BarcodeDetectorCtor = window.BarcodeDetector as (typeof BarcodeDetector) | undefined;
        if (!BarcodeDetectorCtor) {
          setUnsupported(true);
          setIsLoading(false);
          return;
        }
        
        detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
        
        // 카메라 스트림 요청 (더 구체적인 옵션)
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsLoading(false);
        }
        
        const loop = async () => {
          if (!videoRef.current || !detector) return;
          try {
            const bitmaps = await detector.detect(videoRef.current);
            if (bitmaps && bitmaps.length > 0) {
              onDetected(bitmaps[0].rawValue);
              return; // 일단 1회 감지 후 종료
            }
          } catch {
            // ignore per frame errors
          }
          rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
      } catch (err) {
        console.error('QR 스캐너 설정 실패:', err);
        setError(err instanceof Error ? err.message : '카메라 접근에 실패했습니다.');
        onError?.(err);
        setUnsupported(true);
        setIsLoading(false);
      }
    }

    setup();
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [onDetected, onError]);

  if (unsupported) {
    return (
      <div className={css({ p: 4, bg: 'red.50', color: 'red.800', rounded: 'md', border: '1px solid', borderColor: 'red.200' })}>
        <p className={css({ mb: 2, fontWeight: 'medium' })}>QR 스캐너를 사용할 수 없습니다</p>
        {error && (
          <p className={css({ mb: 3, fontSize: 'sm', color: 'red.600' })}>{error}</p>
        )}
        <p className={css({ mb: 3, fontSize: 'sm' })}>
          브라우저가 QR 감지를 지원하지 않거나 카메라 접근이 불가합니다.
        </p>
        <div className={css({ p: 3, bg: 'white', rounded: 'md', border: '1px solid', borderColor: 'neutral.200' })}>
          <p className={css({ mb: 2, fontSize: 'sm', fontWeight: 'medium' })}>대안: 방 ID 직접 입력</p>
          <input
            className={css({ 
              w: 'full', 
              px: 3, 
              py: 2, 
              rounded: 'md', 
              border: '1px solid', 
              borderColor: 'neutral.300', 
              bg: 'white',
              fontSize: 'sm'
            })}
            type="text"
            placeholder="8자리 방 ID를 입력하세요 (예: AbC123Xy)"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                const value = (e.target as HTMLInputElement).value.trim();
                if (value.length === 8) {
                  onDetected(value);
                }
              }
            }}
          />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={css({ p: 8, textAlign: 'center' })}>
        <div className={css({ mb: 4, fontSize: 'lg', color: 'neutral.600' })}>카메라를 시작하는 중...</div>
        <div className={css({ 
          w: '8', 
          h: '8', 
          border: '2px solid', 
          borderColor: 'blue.200', 
          borderTopColor: 'blue.600',
          rounded: 'full',
          animation: 'spin 1s linear infinite',
          mx: 'auto'
        })} />
      </div>
    );
  }

  return (
    <div className={css({ position: 'relative' })}>
      <video 
        className={css({ 
          w: 'full', 
          maxW: '480px', 
          rounded: 'lg', 
          border: '2px solid', 
          borderColor: 'blue.300', 
          shadow: 'lg' 
        })} 
        ref={videoRef} 
        playsInline 
        autoPlay
        muted
      />
      <div className={css({ 
        position: 'absolute', 
        top: '50%', 
        left: '50%', 
        transform: 'translate(-50%, -50%)',
        w: '200px',
        h: '200px',
        border: '2px solid',
        borderColor: 'blue.500',
        rounded: 'lg',
        pointerEvents: 'none'
      })}>
        <div className={css({
          position: 'absolute',
          top: '-2px',
          left: '-2px',
          w: '20px',
          h: '20px',
          borderTop: '4px solid',
          borderLeft: '4px solid',
          borderColor: 'blue.500',
          rounded: 'tl-lg'
        })} />
        <div className={css({
          position: 'absolute',
          top: '-2px',
          right: '-2px',
          w: '20px',
          h: '20px',
          borderTop: '4px solid',
          borderRight: '4px solid',
          borderColor: 'blue.500',
          rounded: 'tr-lg'
        })} />
        <div className={css({
          position: 'absolute',
          bottom: '-2px',
          left: '-2px',
          w: '20px',
          h: '20px',
          borderBottom: '4px solid',
          borderLeft: '4px solid',
          borderColor: 'blue.500',
          rounded: 'bl-lg'
        })} />
        <div className={css({
          position: 'absolute',
          bottom: '-2px',
          right: '-2px',
          w: '20px',
          h: '20px',
          borderBottom: '4px solid',
          borderRight: '4px solid',
          borderColor: 'blue.500',
          rounded: 'br-lg'
        })} />
      </div>
      <div className={css({ 
        mt: 3, 
        textAlign: 'center', 
        color: 'neutral.600', 
        fontSize: 'sm' 
      })}>
        QR 코드를 카메라에 비춰주세요
      </div>
    </div>
  );
}



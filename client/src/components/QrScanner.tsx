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

  useEffect(() => {
    let stream: MediaStream | null = null;
    let rafId = 0;
    let detector: BarcodeDetector | null = null;

    async function setup() {
      try {
        const BarcodeDetectorCtor = window.BarcodeDetector as (typeof BarcodeDetector) | undefined;
        if (!BarcodeDetectorCtor) {
          setUnsupported(true);
          return;
        }
        detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const loop = async () => {
          if (!videoRef.current) return;
          try {
            const bitmaps = await detector!.detect(videoRef.current);
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
        onError?.(err);
        setUnsupported(true);
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
      <div className={css({ p: 4, bg: 'yellow.300', color: 'yellow.800', rounded: 'md', border: '1px solid', borderColor: 'yellow.600' })}>
        <p className={css({ mb: 2 })}>카메라 접근이 불가하거나 브라우저가 QR 감지를 지원하지 않습니다.</p>
        <input
          className={css({ px: 3, py: 2, rounded: 'md', border: '1px solid', borderColor: 'gray.300', bg: 'white' })}
          type="file"
          accept="image/*"
          onChange={() => onError?.(new Error('이미지 업로드 기반 QR 스캔은 미구현'))}
        />
      </div>
    );
  }

  return (
    <div>
      <video className={css({ w: 'full', maxW: '480px', rounded: 'lg', border: '1px solid', borderColor: 'gray.4', shadow: 'sm' })} ref={videoRef} playsInline />
    </div>
  );
}



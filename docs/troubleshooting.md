# 트러블슈팅

## WebSocket 연결 안 됨
- `.env`의 `VITE_WS_URL` 확인(프로토콜 `ws://` vs `wss://`)
- 방 `uuid` 파라미터 포함 여부 확인
- 네트워크, CORS, 프록시 설정 확인

## 오디오가 재생되지 않음
- 브라우저 오토플레이 정책으로 인해 사용자 제스처 필요
- `AudioContext` 미지원 브라우저인지 확인(iOS 구버전)
- 사운드 파일 경로 `/sounds/*.mp3` 유효성 확인

## QR 스캔 실패
- `BarcodeDetector` 지원 확인(사파리 17+/크롬 최신)
- 미지원 시 파일 업로드 폴백 메시지 확인

## 빌드 실패
- PandaCSS 코드젠 실패 → `npm run panda` 또는 `npm run build`
- TypeScript 버전/타입 충돌 → `node_modules` 정리 후 재설치

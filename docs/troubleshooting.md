# 트러블슈팅

## WebSocket 연결 안 됨
- `.env`의 `VITE_WS_URL` 확인(프로토콜 `ws://` vs `wss://`)
- 방 `uuid` 파라미터 포함 여부 확인
- 네트워크, CORS, 프록시 설정 확인

## 오디오가 재생되지 않음
- 브라우저 오토플레이 정책으로 인해 사용자 제스처 필요
- `AudioContext` 미지원 브라우저인지 확인(iOS 구버전)
- 사운드 파일 경로 `/sounds/*.mp3` 유효성 확인

### 상세 증상과 해결
- 첫 진입 시 재생 불가
  - 원인: 초기 렌더링 단계에서 `AudioContext`가 `suspended` 상태
  - 해결: 시작 버튼 클릭 시 `initializeAudio()`를 먼저 수행하여 `resume()` 및 사운드 로드 후 `start()` 실행
- 시작 버튼을 눌러도 가끔 두 번 재생됨
  - 원인: WebSocket 재연결 시 `message` 리스너가 중복으로 바인딩
  - 해결: `Metronome#setWebSocket`에서 기존 리스너 제거 후 재바인딩하도록 수정
- ‘오디오 준비’가 한 번에 동작하지 않음 (BPM 변경 시만 동작)
  - 원인: `metronomeRef`가 WebSocket 연결 이전에는 존재하지 않아 초기 조건 불만족
  - 해결: 메트로놈 인스턴스를 WebSocket과 독립적으로 선생성(마운트 시 1회), WebSocket은 이후 주입
- `decodeAudioData` 에러(null/타입 불일치)
  - 원인: 브라우저별 Promise/Callback 차이와 초기화 타이밍 이슈
  - 해결: 콜백/Promise 호환 래퍼로 감싸고, 디코딩 시점의 `AudioContext`를 로컬 변수로 고정해 중간 파괴/교체 감지
  - 또한 정적 경로를 `import.meta.env.BASE_URL` 기준으로 생성(`resolveAssetUrl`)하고, `fetch(..., { cache: 'force-cache' })`로 캐시 힌트 부여

### 체크리스트
- 시작 버튼 1회 클릭으로 초기화+재생이 되는가
- 로그 순서: initialize → AudioContext 생성 → resume → click/accent 로드 → 초기화 완료 → start
- iOS/Safari에서 사용자 제스처(버튼 클릭) 내에서 정상 동작하는가

## QR 스캔 실패
- `BarcodeDetector` 지원 확인(사파리 17+/크롬 최신)
- 미지원 시 파일 업로드 폴백 메시지 확인

## 빌드 실패
- PandaCSS 코드젠 실패 → `npm run panda` 또는 `npm run build`
- TypeScript 버전/타입 충돌 → `node_modules` 정리 후 재설치

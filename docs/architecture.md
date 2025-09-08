# 아키텍처

## 개요
프론트엔드는 React 19 + Vite 6 기반 SPA입니다. React Router v7로 라우팅하고, React Query v5로 서버 상태를 관리합니다. 스타일은 PandaCSS를 사용합니다.

백엔드는 Go 1.22 + Gin 기반 REST/WebSocket 서버이며 MongoDB를 사용합니다. 방별 메트로놈 상태를 서버에서 관리하고 클라이언트에 브로드캐스트합니다.

```
App
├─ routes.tsx (createBrowserRouter)
├─ pages/room/roomPage.tsx
│  ├─ hooks/useWebSocket.ts (WS 연결/재연결, send)
│  ├─ hooks/useMetronome.ts (Metronome 클래스와 상태 바인딩)
│  ├─ components/QrDisplay.tsx
│  └─ components/MetronomeControls.tsx
├─ apis/room.ts (POST /room)
├─ utils/http.ts (axios 인스턴스)
└─ utils/metronome.ts (오디오 스케줄링, 사운드, 동기화)
```

```
server/
├─ main.go (부트스트랩, graceful shutdown)
├─ routes/routes.go (CORS, /room, /ws, /health)
├─ api/
│  ├─ room.go (POST /room, GET /room/:uuid)
│  └─ websocket.go (GET /ws/:uuid 업그레이드)
├─ services/
│  ├─ room.go (방 등록/조회 유스케이스)
│  └─ websocket.go (메트로놈 상태/브로드캐스트/동기화 ticker)
├─ repository/room.go (Mongo 쿼리 및 인덱스)
├─ models/room.go (Room 스키마)
├─ database/database.go (Mongo 연결 관리)
└─ config/config.go (viper 기반 설정)
```

## 라우팅
- `/` 메인: 방 생성, QR 스캐너, 방 ID 직접 입력.
- `/room/:id` 방: QR 표시, 메트로놈 컨트롤, WebSocket 연결.

서버 라우팅
- `POST /room` 방 생성(201 `{ uuid }` 반환, 8자리 nanoid)
- `GET /room/:id` 방 조회(200 Room 문서, nanoid 검증)
- `GET /ws/:id` WebSocket 업그레이드(쿼리 `userId`)
- `GET /health` 헬스체크

## 실시간 동기화 흐름
1. 클라이언트가 WebSocket(`CONFIG.WS_URL`)에 `roomUuid`로 접속.
2. 서버는 `type: "metronomeState"` 메시지를 브로드캐스트.
3. 클라이언트 `Metronome`은 `serverTime`과 로컬 `Date.now()` 차이로 동기화 오프셋을 계산.
4. 오디오 예약은 Web Worker 타이머로 안정적으로 스케줄링.

서버 내부 흐름
1) `startMetronome` 수신 시 방 상태 생성/갱신, 즉시 브로드캐스트
2) 방별 ticker(기본 3초)가 주기적으로 최신 상태 재브로드캐스트(드리프트 보정)
3) 마지막 클라이언트가 떠나면 해당 방 상태와 ticker 정리

## 오디오 설계(utils/metronome.ts)
- AudioContext 생성, 클릭/강박 사운드 로드(`/sounds/click.mp3`, `/sounds/accent.mp3`).
- 서버 상태 수신 시 템포/박자/재생 상태를 반영.
- `requestStart/Stop/ChangeTempo/ChangeBeats`로 서버에 액션 전송.
- Tab BPM 기능: 사용자 탭 간격을 측정하여 평균 BPM 계산 (최근 4번 탭 기준).
- 자연스러운 BPM 변경: 박자 위치를 유지하면서 간격만 조정하는 알고리즘 구현.

## 상태 관리
- React Query: 방 생성 뮤테이션 성공 시 `QUERY_KEYS.ROOMS` 무효화.
- 로컬 UI 상태: `useMetronome`으로 미러링된 `isPlaying/tempo/beats`를 컴포넌트에 전달.

## 빌드/배포
- 프론트: Vite 빌드 산출물을 Vercel에 배포. `vercel.json`에서 SPA 재작성(`/index.html`) 설정.
- 백엔드: `server/docker-compose.yml`로 Mongo와 함께 실행하거나 컨테이너 이미지를 빌드해 배포.


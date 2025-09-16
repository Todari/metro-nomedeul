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
│  ├─ components/Header.tsx (상단 헤더)
│  ├─ components/QrDisplay.tsx (다크모드 QR 표시, 현재 주석 처리)
│  ├─ components/MetronomeControls.tsx (메트로놈 컨트롤 - 시작/정지, 상태 표시, 오디오 초기화)
│  ├─ components/SettingsBottomSheet.tsx (설정 바텀시트 - BPM/박자 조절)
│  ├─ components/BeatCard.tsx (전체 화면 박자 시각화)
│  ├─ components/ScrollPicker.tsx (BPM 선택 UI - 세로)
│  └─ components/HorizontalScrollPicker.tsx (박자 선택 UI - 가로)
├─ apis/room.ts (POST /room)
├─ utils/http.ts (axios 인스턴스)
└─ utils/metronome.ts (Web Audio API 사운드 생성, 오디오 스케줄링, 동기화)
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

### WebSocket 메시지 큐 시스템 (v2.4)
- **연결 상태 확인**: 메시지 전송 전 WebSocket이 `OPEN` 상태인지 확인
- **메시지 큐**: 연결이 준비되지 않았을 때 메시지를 큐에 저장
- **자동 전송**: 연결되면 큐에 저장된 메시지를 자동으로 전송
- **에러 복구**: 전송 실패 시 메시지를 큐에 다시 저장

#### 큐 관리 메커니즘
- **최대 큐 크기**: 50개 메시지로 제한하여 메모리 사용량 제어
- **메시지 유효 시간**: 30초가 지난 메시지는 자동으로 제거
- **중복 제거**: 같은 `action`의 메시지가 있으면 기존 것을 제거하고 최신 것만 유지
- **주기적 정리**: 10초마다 큐를 정리하여 오래된 메시지 제거
- **메시지 구조**: `{message, timestamp, id}` 형태로 메타데이터 포함

#### 메모리 최적화
- **자동 정리**: 메시지 추가 시마다 큐 정리 실행
- **크기 제한**: 큐가 가득 차면 오래된 메시지부터 제거
- **타이머 정리**: 컴포넌트 언마운트 시 정리 타이머 해제

### 서버 상태 동기화 개선
- **사용자 액션**: `requestStart/Stop/ChangeTempo/ChangeBeats`로 서버에 액션 전송
- **서버 상태 수신**: `handleServerState`에서 서버 상태를 안전하게 처리
- **오디오 초기화**: 서버 상태 변경 시에도 오디오가 준비되지 않으면 자동 초기화
- **상태 분리**: 사용자 액션과 서버 상태 변경을 구분하여 처리

서버 내부 흐름
1) `startMetronome` 수신 시 방 상태 생성/갱신, 즉시 브로드캐스트
2) 방별 ticker(기본 5초)가 주기적으로 최신 상태 재브로드캐스트(드리프트 보정)
3) 마지막 클라이언트가 떠나면 해당 방 상태와 ticker 정리

## 오디오 설계(utils/metronome.ts)
- **Web Audio API**: AudioContext 생성, 실시간 사운드 생성 (파일 로딩 불필요)
- **사운드 생성**: `createClickSound()` 메서드로 악센트(1200Hz)와 일반(800Hz) 비트 구분
- **서버 상태 수신**: `handleServerState`에서 템포/박자/재생 상태를 반영
- **서버 액션 전송**: `requestStart/Stop/ChangeTempo/ChangeBeats`로 서버에 액션 전송
- **Tab BPM 기능**: 사용자 탭 간격을 측정하여 평균 BPM 계산 (최근 4번 탭 기준)
- **자연스러운 BPM 변경**: 박자 위치를 유지하면서 간격만 조정하는 알고리즘 구현
- **고도화된 동기화**: 서버 중심 BPM 변경 처리, 동기화 임계값 최적화 (200ms)
- **안전장치**: 2박자 이상의 큰 차이는 무시하여 네트워크 오류 방지
- **재생 중 설정 변경 방지**: 재생 중에는 BPM/박자 변경 차단, 설정 버튼 클릭 시 자동 정지
- **Beat Callback**: `setOnBeat((beatIndex, beatsPerBar) => void)` 제공, UI는 이 콜백으로 엔진과 위상 동기화

## UI 컴포넌트 설계
- **Header**: 상단 고정 헤더 컴포넌트
- **BeatCard**: 전체 화면 박자 시각화 (w: full, h: full, Flexbox 중앙 정렬)
- **ScrollPicker**: 세로 스크롤 BPM 선택 (40-240, 7개 표시, 다크모드)
- **HorizontalScrollPicker**: 가로 스크롤 박자 선택 (2-8, 전체 너비, 다크모드)
- **MetronomeControls**: 메트로놈 컨트롤 (시작/정지, 현재 상태 표시, 오디오 초기화, 설정 버튼)
- **SettingsBottomSheet**: 설정 바텀시트 (BPM/박자 스크롤, 탭 템포 기능)
- **QrDisplay**: 다크모드 QR 코드 표시 (현재 주석 처리, 추후 복원 예정)
- **공통 기능**: 드래그, 터치, 휠 지원, easeOutCubic 애니메이션
- **반응형**: 컨테이너 크기에 따른 동적 중앙 정렬
- **실시간 동기화**: WebSocket을 통한 다중 클라이언트 상태 동기화
- **다크모드**: 일관된 색상 시스템 (오렌지 primary, neutral secondary)
- **레이아웃**: 전체 화면 높이 활용 (100dvh), Flexbox 기반 중앙 정렬
- **UI 분리**: 메인 화면과 설정 화면을 분리하여 더 깔끔한 사용자 경험 제공

## 상태 관리
- React Query: 방 생성 뮤테이션 성공 시 `QUERY_KEYS.ROOMS` 무효화.
- 로컬 UI 상태: `useMetronome`으로 미러링된 `isPlaying/tempo/beats`를 컴포넌트에 전달.

## 모바일 터치 이벤트 아키텍처 (v3.2)

### 이벤트 처리 전략
- **이중 이벤트 핸들러**: PC용 `onClick` + 모바일용 `onTouchStart`
- **이벤트 우선순위**: `onTouchStart`에서 `preventDefault()` 호출하여 중복 실행 방지
- **크로스 플랫폼 호환성**: PC와 모바일 모두에서 안정적인 사용자 경험 제공

### 컴포넌트 구조
```
SettingsBottomSheet
├── 오버레이 (onClick + onTouchStart)
├── 바텀시트 컨테이너
│   ├── 헤더
│   │   └── 닫기 버튼 (onClick + onTouchStart)
│   ├── 재생 중 경고 (조건부 렌더링)
│   │   └── 정지 후 설정 버튼 (onClick + onTouchStart)
│   └── 설정 컨트롤들
│       └── Tab 버튼 (onClick + onTouchStart)
```

### CSS 최적화 원칙
- **구조적 일관성**: ShareBottomSheet와 동일한 CSS 패턴 사용
- **단순화**: 복잡한 터치 최적화 설정 제거
- **반응형**: `insetX: 0` 등 간단한 CSS 속성 사용

### 디버깅 시스템
- **콘솔 로깅**: 각 이벤트 발생 시 구분된 로그 출력
- **이벤트 추적**: 클릭과 터치 이벤트를 별도로 추적
- **문제 진단**: 모바일에서 어떤 이벤트가 발생하는지 실시간 확인

### 적용 범위
- **SettingsBottomSheet**: 모든 인터랙티브 요소
- **ShareBottomSheet**: 기존 구조 유지 (정상 작동)
- **MetronomeControls**: 향후 적용 예정

## 스크롤 피커 성능 최적화 아키텍처 (v3.3)

### 가상화 시스템
- **렌더링 범위 계산**: `visibleRange` 메모이제이션으로 화면에 보이는 아이템만 계산
- **동적 패딩**: 상단/하단 패딩으로 자연스러운 스크롤 경험 제공
- **메모리 효율성**: DOM 노드 수를 95% 감소 (200개 → 8-10개)

### 메모이제이션 전략
- **값 목록 캐싱**: `values` 배열을 `useMemo`로 캐싱
- **선택 인덱스 캐싱**: `selectedIndex` 계산 결과 메모이제이션
- **중앙 오프셋 캐싱**: `centerOffset` 계산 결과 캐싱

### 디바운싱 시스템
- **onChange 제한**: 16ms(60fps) 간격으로 onChange 호출 제한
- **타이머 관리**: `onChangeTimeoutRef`로 타이머 생명주기 관리
- **메모리 누수 방지**: 컴포넌트 언마운트 시 타이머 정리

### GPU 가속 최적화
- **CSS Transform**: `translate3d(0, 0, 0)`로 하드웨어 가속 활성화
- **willChange 속성**: 브라우저 최적화 힌트 제공
- **레이어 분리**: GPU 레이어에서 애니메이션 처리

### 성능 모니터링
- **렌더링 최적화**: 불필요한 리렌더링 방지
- **메모리 관리**: 가비지 컬렉션 최적화
- **사용자 경험**: 60fps 부드러운 스크롤 달성

## 빌드/배포
- 프론트: Vite 빌드 산출물을 Vercel에 배포. `vercel.json`에서 SPA 재작성(`/index.html`) 설정.
- 백엔드: `server/docker-compose.yml`로 Mongo와 함께 실행하거나 컨테이너 이미지를 빌드해 배포.


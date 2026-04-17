# API 및 실시간 프로토콜 (REST + WS)

## REST API

- POST `${VITE_API_URL}/room`
  - 설명: 새 방을 생성하고 8자리 nanoid를 반환합니다. 분당 5회로 제한됩니다.
  - 응답(201):
    ```json
    { "uuid": "AbC123Xy" }
    ```

- GET `${VITE_API_URL}/room/:id`
  - 설명: 방 정보를 조회합니다. ID는 8자리 nanoid 형식이어야 합니다.
  - 응답(200):
    ```json
    {
      "id": "<cuid>",
      "roomId": "AbC123Xy",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
    ```
  - 에러(400): 잘못된 ID 형식
  - 에러(404): 방을 찾을 수 없음

## WebSocket

- 접속 URL: `${VITE_WS_URL}` (Socket.IO 기본 경로 `/socket.io`)
- Query 파라미터
  - `roomUuid`: 접속할 방 ID (필수)
  - `userId`: 클라이언트 식별자 (선택)

### 설계: 공동 제어(Shared Control)

방에 접속한 **모든 사용자가 동등하게** 재생/정지/BPM·박자 변경을 할 수 있습니다. 이는 밴드 멤버 누구든 즉시 조절할 수 있게 하려는 의도된 설계입니다. 권한/방장 개념은 없습니다.

### 서버 → 클라이언트 이벤트

- `initialState` / `metronomeState` / `beatSync`
  - 페이로드 공통 형태:
    ```json
    {
      "type": "metronomeState",
      "isPlaying": true,
      "tempo": 128,
      "beats": 4,
      "currentBeat": 0,
      "startTime": 1730000000000,
      "serverTime": 1730000000000,
      "roomUuid": "AbC123Xy"
    }
    ```
- `timeSyncResponse`: 클록 보정 응답. `{ "clientSendTime": <ms>, "serverTime": <ms> }`.
- `serverShutdown`: 서버 종료 직전 브로드캐스트. 클라이언트는 재연결 대기를 표시하는 데 사용할 수 있습니다.

### 클라이언트 → 서버 이벤트

| 이벤트 | 페이로드 |
|--------|----------|
| `startMetronome` | `{ tempo?: number, beats?: number }` |
| `stopMetronome` | `(none)` |
| `changeTempo` | `{ tempo: number }` |
| `changeBeats` | `{ beats: number }` |
| `requestSync` | `(none)` |
| `timeSyncRequest` | `{ clientSendTime: number }` |

- 서버는 이벤트마다 소켓당 token-bucket 기반 rate limit을 적용합니다(예: `changeTempo`는 초당 20회).
- `startMetronome`/`stopMetronome`는 서버 인메모리 상태를 변경하고 방의 모든 소켓에 `metronomeState`를 브로드캐스트합니다.
- `changeTempo`/`changeBeats`는 **재생 중이어도 위상을 유지한 채 값만 교체합니다** — 이전 구현처럼 재생을 정지시키지 않습니다.

### 방 정원/유지 시간

- 방당 최대 동시 접속: 20명.
- 마지막 접속자가 나간 뒤 10초의 유예가 지나면 서버 인메모리 상태를 제거합니다. 같은 방에 재접속이 발생하면 유예 타이머가 취소됩니다.
- DB의 방 레코드 자체는 24시간 후 자동 삭제됩니다.

## 에러/재연결
- 클라이언트 Socket.IO는 지수 백오프로 자동 재연결(최대 10회, 최대 30초 간격)합니다.
- 재연결 시 5라운드의 `timeSyncRequest`를 다시 수행하며, 이후 5분마다 주기적으로 재측정해 클록 드리프트를 보정합니다.
- 탭이 백그라운드 → 포그라운드로 전환되면 `requestSync`를 보내 서버 상태로 강제 재동기화합니다.
- `utils/http.ts` 인터셉터는 오류를 상위로 전파(추후 로깅 확장 권장).

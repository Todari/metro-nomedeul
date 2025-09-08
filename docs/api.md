# API 및 실시간 프로토콜 (REST + WS)

## REST API

- POST `${VITE_API_URL}/room`
  - 설명: 새 방을 생성하고 UUID를 반환합니다.
  - 응답(201):
    ```json
    { "uuid": "<room-uuid>" }
    ```

- GET `${VITE_API_URL}/room/:uuid`
  - 설명: 방 정보를 조회합니다.
  - 응답(200):
    ```json
    {
      "id": "<mongo-id>",
      "uuid": "<room-uuid>",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
    ```

## WebSocket

- 접속 URL: `${VITE_WS_URL}/:uuid?userId=client-<랜덤>`
- 수신 메시지: `type === "metronomeState"`

```json
{
  "type": "metronomeState",
  "isPlaying": true,
  "tempo": 128,
  "beats": 4,
  "startTime": 1730000000000,
  "serverTime": 1730000000000,
  "roomUuid": "<room-uuid>"
}
```

### 클라이언트 → 서버 액션
```json
{ "action": "startMetronome", "tempo": 120, "beats": 4 }
{ "action": "stopMetronome" }
{ "action": "changeTempo", "tempo": 132 }
{ "action": "changeBeats", "beats": 3 }
```

- 서버는 액션 처리 후 최신 `metronomeState`를 동일 방의 모든 클라이언트에 브로드캐스트합니다.

## 에러/재연결
- `useWebSocket`은 지수 백오프로 자동 재연결(최대 10초 간격).
- `utils/http.ts` 인터셉터는 오류를 상위로 전파(추후 로깅 확장 권장).


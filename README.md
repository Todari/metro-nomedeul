# 메트로놈들 서버 (metronomdeul Server)

메트로놈들은 합주/연습 시 여러 명이 동일한 BPM의 메트로놈을 동시에 듣고 조절할 수 있게 하는 서비스입니다. 본 저장소는 백엔드 서버로, 방 생성/참여 및 실시간 메트로놈 동기화를 제공합니다.

## 배경 및 목표

- 합주/연습 상황에서 구성원 모두가 동일한 템포를 유지하도록 돕는 실시간 메트로놈 공유
- 메인 페이지: 기능 소개 + [방 생성하기], [방 입장하기]
- 방 생성하기: 즉시 임의의 UUID로 방 생성
- 방 페이지 기능:
  - 방 입장용 QR (프론트에서 방 `uuid`로 직접 생성/표시)
  - 메트로놈 시작/정지 버튼
  - BPM(tempo) 및 박자(beats) 조절
- 방 입장하기: 카메라로 QR 스캔 → 해당 방으로 라우팅

## 아키텍처 개요

- REST API(Gin)로 방 생성/조회, 헬스체크
- WebSocket(Gorilla)로 방별 메트로놈 상태 실시간 브로드캐스트
- 서버는 일정 주기(기본 3초)로 동기화 신호를 보내 드리프트를 줄임
- 데이터 저장은 MongoDB(rooms 컬렉션), `uuid` 유니크 인덱스 자동 보장
- 종료 시 그레이스풀 셧다운(HTTP 서버 종료 → DB 연결 해제)

## 기술 스택

- **Language/Runtime**: Go 1.22
- **Web Framework**: Gin
- **Realtime**: Gorilla WebSocket
- **Database**: MongoDB (mongo-go-driver)
- **Config**: Viper (.env + 환경변수)
- **Container**: Docker, Docker Compose (MongoDB 8)

## 실행 방법

### 1) Docker Compose (권장)

개발용과 운영용 Compose 파일을 분리하여 제공합니다.

```bash
docker compose -f docker-compose.dev.yml up -d --build
# 상태 확인
docker compose -f docker-compose.dev.yml ps
# API 로그 보기
docker compose -f docker-compose.dev.yml logs -f api
```

운영용 실행 예시는 다음과 같습니다(실 서비스 환경에 맞게 변수/볼륨/네트워크를 조정하세요).

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

- API: `http://localhost:8080`
- MongoDB: `localhost:27017`

헬스 체크:

```bash
curl -s http://localhost:8080/health
```

기본 동작 확인 예시:

```bash
# 방 생성
curl -s -X POST http://localhost:8080/room

# 방 조회
curl -s http://localhost:8080/room/<UUID>

# (QR은 프론트에서 uuid로 직접 생성)
```

### 2) 로컬 실행

```bash
go mod tidy
go run main.go
```

서버 기본 포트는 `8080`입니다.

### 환경 변수

`.env` 또는 환경변수로 설정합니다. 기본값이 존재하므로 미설정 시 아래 값으로 동작합니다.

```env
PORT=8080
DATABASE_URL=mongodb://localhost:27017
DATABASE_NAME=metronomdeul
# 콤마(,)로 다중 오리진을 지원합니다. 예: https://app.example.com,https://staging.example.com
ALLOWED_ORIGIN=http://localhost:3000
JWT_SECRET=change_me
```

- `ALLOWED_ORIGIN` 미설정 시 개발 편의상 모든 오리진을 허용합니다. 운영 환경에서는 반드시 올바른 오리진을 지정하세요.

## API

### REST

- `GET /health` → 헬스체크: `{ status: "ok" }`
- `POST /room` → 방 생성: `{ uuid: string }`
- `GET /room/:uuid` → 방 조회: 방 문서 반환

에러 응답 규칙(요약):
- 잘못된 UUID 형식: 400 `{ error: "Invalid room UUID" }`
- 방을 찾지 못함: 404 `{ error: "Room not found" }`
- 서버 내부 오류: 500 `{ error: "Internal server error" }`

### WebSocket

- `GET /ws/:uuid?userId=<id>`
  - 같은 `:uuid`의 클라이언트끼리 상태를 공유
  - 새 접속 시 서버가 현재 상태 1회 송신
  - 서버는 CORS 기반 오리진 검사를 수행합니다(`ALLOWED_ORIGIN`).
  - 업그레이더 버퍼 제한(Read/WriteBufferSize 설정)으로 기본적인 자원 보호를 수행합니다.

#### 클라이언트 → 서버 액션

```json
{ "action": "startMetronome", "tempo": 120, "beats": 4 }
```

```json
{ "action": "stopMetronome" }
```

```json
{ "action": "changeTempo", "tempo": 132 }
```

```json
{ "action": "changeBeats", "beats": 3 }
```

#### 서버 → 클라이언트 브로드캐스트

```json
{
  "type": "metronomeState",
  "isPlaying": true,
  "tempo": 120,
  "beats": 4,
  "startTime": 1710000000000,
  "serverTime": 1710000000500,
  "roomUuid": "<uuid>"
}
```

## 디렉토리 구조

- `api/`: HTTP 핸들러 (`RoomHandler`, `WebSocketHandler`)
- `services/`: 도메인 로직 및 WebSocket 상태 관리
- `repository/`: MongoDB CRUD 및 인덱스 보장
- `models/`: DB 모델(`Room`)
- `config/`: Viper 기반 설정 로딩
- `database/`: MongoDB 커넥션 초기화/종료 (`ConnectDatabase`, `DisconnectDatabase`)
- `routes/`: 라우팅 및 CORS 설정

## 운영 및 보안 가이드

- **그레이스풀 셧다운**: SIGINT/SIGTERM 수신 시 HTTP 서버를 안전하게 종료하고 MongoDB 연결을 해제합니다.
- **CORS/Origin**: `ALLOWED_ORIGIN`으로 허용 오리진을 제어합니다(콤마로 다중 오리진). 운영에서는 반드시 제한을 적용하세요.
- **WebSocket**:
  - 오리진 검사 수행.
  - 업그레이더 버퍼 사이즈 설정(DoS/메모리 보호 보조). 필요 시 `SetReadLimit` 등 추가 제한을 고려하세요.
  - 방에 클라이언트가 없으면 해당 방의 메트로놈 리소스를 자동 정리합니다.
- **MongoDB**:
  - `rooms.uuid` 유니크 인덱스 자동 생성.
  - 운영에서는 인증/RBAC, 네트워크 접근 제어(VPC/방화벽), 적절한 연결 옵션(`retryWrites` 등)을 권장합니다.
  - 방 수명 만료 정책이 있다면 TTL 인덱스 도입 검토.
- **로깅/모니터링**:
  - 현재 기본 로깅(`log.Println`) 기반. 운영 수준의 구조화 로깅(JSON)과 레벨링, 트레이싱-ID, 메트릭(`/metrics`) 도입을 권장합니다.

## 개발 노트

- 서버는 `ALLOWED_ORIGIN`에 설정된 출처만 WebSocket 업그레이드를 허용합니다(미설정 시 전체 허용: 개발 전용).
- 방에 클라이언트가 없으면 해당 방의 메트로놈 리소스를 정리합니다.
- 동시성: 메트로놈 상태 접근 시 RWMutex를 사용합니다.

## 로드맵(제안)

- 인증/권한: 토큰 기반 방 입장, 액션 권한 제어
- 메시지 검증/제한: WebSocket 메시지 크기 제한, rate limit
- 메트릭/가시성: Prometheus `/metrics`, OpenTelemetry 추적
- 성능: 방별 클라이언트 인덱싱 최적화, 브로드캐스트 효율화

## 기여

1) 이슈 생성 → 2) 브랜치 생성 → 3) PR 생성 순으로 진행해 주세요.

## 문의

이슈 탭을 통해 질문/제안을 남겨 주세요.

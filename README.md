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

- REST API(Gin)로 방 생성/조회
- WebSocket(Gorilla)로 방별 메트로놈 상태 실시간 브로드캐스트
- 서버는 일정 주기(기본 3초)로 동기화 신호를 보내 드리프트를 줄임
- 데이터 저장은 MongoDB(rooms 컬렉션)

## 기술 스택

- **Language/Runtime**: Go 1.22
- **Web Framework**: Gin
- **Realtime**: Gorilla WebSocket
- **Database**: MongoDB (mongo-go-driver)
- **Config**: Viper(.env + 환경변수)
- **Container**: Docker, Docker Compose (MongoDB 8)

## 실행 방법

### 1) Docker Compose (권장)

```bash
docker compose up -d --build
# 상태 확인
docker compose ps
# 로그 보기
docker compose logs -f api
```

- API: `http://localhost:8080`
- MongoDB: `localhost:27017`

헬스 체크 예시:

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
ALLOWED_ORIGIN=http://localhost:3000
JWT_SECRET=change_me
```

## API

### REST

- `POST /room` → 방 생성: `{ uuid: string }`
- `GET /room/:uuid` → 방 조회: 방 문서 반환
  

### WebSocket

- `GET /ws/:uuid?userId=<id>`
  - 같은 `:uuid`의 클라이언트끼리 상태를 공유
  - 새 접속 시 서버가 현재 상태 1회 송신

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
- `repository/`: MongoDB CRUD
- `models/`: DB 모델(`Room`)
- `config/`: Viper 기반 설정 로딩
- `database/`: MongoDB 커넥션 초기화
- `routes/`: 라우팅 및 CORS 설정

## 개발 노트

- 서버는 `ALLOWED_ORIGIN`에 설정된 출처만 WebSocket 업그레이드를 허용합니다.
- 방에 클라이언트가 없으면 해당 방의 메트로놈 리소스를 정리합니다.
- 동시성: 메트로놈 상태 접근 시 RWMutex를 사용합니다.

## 기여

1) 이슈 생성 → 2) 브랜치 생성 → 3) PR 생성 순으로 진행해 주세요.

## 문의

이슈 탭을 통해 질문/제안을 남겨 주세요.

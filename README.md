# 메트로놈들 서버 (metro-nomedeul Server)

메트로놈들 서버는 여러 사용자가 동시에 동일한 메트로놈을 공유하며 실시간으로 음악 연습이나 합주를 할 수 있는 서비스의 백엔드입니다. 사용자들은 같은 방에 접속하여 동기화된 메트로놈을 함께 사용할 수 있습니다.

## 기술 스택

- **Backend**: Go
  - Web Framework: [Gin](https://github.com/gin-gonic/gin)
  - WebSocket: [Gorilla WebSocket](https://github.com/gorilla/websocket)
  - Database: MongoDB
  - MongoDB Driver: [mongo-go-driver](https://github.com/mongodb/mongo-go-driver)

## 주요 기능

- **실시간 메트로놈 공유**: WebSocket을 통해 여러 사용자가 동일한 메트로놈 설정(템포, 박자)을 공유합니다.
- **메트로놈 동기화**: 서버에서 주기적으로 동기화 신호를 보내 모든 클라이언트의 메트로놈이 정확하게 일치하도록 합니다.
- **방 관리**: 사용자들이 방을 생성하고 참여할 수 있으며, 각 방마다 독립적인 메트로놈을 운영합니다.
- **사용자 관리**: 사용자 연결 및 해제를 관리하고, 방에 남은 사용자가 없을 경우 자동으로 리소스를 정리합니다.

## 설치 및 실행

### 요구 사항

- Go 1.16 이상
- MongoDB

### 환경 변수 설정

`.env` 파일을 생성하고 다음과 같이 설정합니다:

```
SERVER_PORT=8000
DATABASE_URL=mongodb://localhost:27017
DATABASE_NAME=metronomedeul
ALLOWED_ORIGIN=http://localhost:3000
ENVIRONMENT=development
```

### 실행 방법

1. **의존성 설치**:

   ```bash
   go mod download
   ```

2. **서버 실행**:

   ```bash
   go run main.go
   ```

3. **서버 접속**: 서버는 기본적으로 `http://localhost:8000`에서 실행됩니다.

## API 엔드포인트

### REST API

- `POST /room`: 새로운 방 생성
- `GET /room/:uuid`: UUID로 방 정보 조회

### WebSocket

- `WS /ws/:uuid?userId=<userId>`: 방에 WebSocket 연결

## WebSocket 메시지 형식

### 클라이언트 → 서버

```json
{
  "action": "startMetronome",
  "tempo": 120,
  "beats": 4
}
```

```json
{
  "action": "stopMetronome"
}
```

```json
{
  "action": "changeTempo",
  "tempo": 140
}
```

```json
{
  "action": "changeBeats",
  "beats": 3
}
```

### 서버 → 클라이언트

```json
{
  "type": "metronomeState",
  "isPlaying": true,
  "tempo": 120,
  "beats": 4,
  "startTime": 1623456789000,
  "serverTime": 1623456789500,
  "roomUuid": "550e8400-e29b-41d4-a716-446655440000"
}
```

## 디렉토리 구조

- `api/`: API 핸들러
- `services/`: 비즈니스 로직 및 WebSocket 서비스
- `repository/`: 데이터베이스 접근 로직
- `models/`: 데이터베이스 모델
- `config/`: 설정 파일
- `database/`: 데이터베이스 연결 설정
- `routes/`: 라우팅 설정

## 기여 방법

1. 이슈를 생성합니다.
2. 이 저장소를 포크합니다.
3. 새로운 브랜치를 생성합니다. (`git checkout -b feature/#{이슈번호}`)
4. 변경 사항을 커밋합니다. (`git commit -am 'Add new feature'`)
5. 브랜치에 푸시합니다. (`git push origin feature/#{이슈번호}`)
6. Pull Request를 생성합니다.

## 문의

질문이나 제안 사항이 있으시면 [이슈](https://github.com/Todari/metro-nomedeul-server/issues) 페이지를 통해 문의해 주세요.

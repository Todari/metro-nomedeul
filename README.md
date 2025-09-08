# 메트로놈들 (Metro-nomedeul)

실시간으로 여러 사용자가 동일한 템포/박자에 맞춰 메트로놈을 동기화하여 연주할 수 있는 웹 애플리케이션입니다. 프론트엔드(React)와 백엔드(Go/Gin)가 단일 모노레포로 구성되어 있습니다.

## 폴더 구조
```
client/  # React + Vite + PandaCSS
server/  # Go 1.22 + Gin + MongoDB
docs/    # 전체 문서(아키텍처, API, 환경, 배포 등)
```

## 빠른 시작 (로컬)

### 1) 서버 실행 (Docker Compose)
```
cd server
docker compose up -d --build
```
- API: http://localhost:8080
- WS:  ws://localhost:8080/ws/:uuid

### 2) 클라이언트 실행 (Vite Dev Server)
```
cd client
npm i
npm run dev
```
- 기본 포트: http://localhost:5173

.env 설정은 [docs/environment.md](./docs/environment.md)를 참고하세요.

## 주요 기능
- 방 생성(POST /room) 및 QR 코드로 방 참여 링크 공유
- WebSocket을 통한 서버 주도 메트로놈 상태 브로드캐스트
- 클라이언트 오디오 스케줄링(웹 워커)과 서버 시각 기준 동기화
- 템포/박자 변경 및 시작/정지 제어

## 기술 스택
- 프론트: React 19, Vite, PandaCSS
- 백엔드: Go 1.22, Gin, Gorilla WebSocket, MongoDB
- 인프라: Vercel(프론트), Docker Compose(백엔드)

## 문서
- 전체 목차: [docs/README.md](./docs/README.md)
- 아키텍처: [docs/architecture.md](./docs/architecture.md)
- API/프로토콜: [docs/api.md](./docs/api.md)
- 환경 설정: [docs/environment.md](./docs/environment.md)
- 배포 가이드: [docs/deployment.md](./docs/deployment.md)

## 개발 가이드
- 브랜치/커밋 규칙, PR 템플릿 등은 [docs/collaboration.md](./docs/collaboration.md) 및 [docs/conventions.md](./docs/conventions.md) 참고
- 기능/프로토콜/환경 변경 시 반드시 관련 문서를 함께 갱신하세요

## 라이선스
프로젝트 루트의 LICENSE 파일을 참고하세요.

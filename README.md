# 메트로놈들 (Metro-nomedeul)

> 밴드 합주할 때, 모두가 같은 클릭을 듣고 싶다면?

**메트로놈들**은 여러 사람이 각자의 이어폰으로 **동시에 같은 메트로놈 클릭**을 들을 수 있는 실시간 동기화 웹앱입니다.

**사이트**: https://metronomdeul.site

### 이런 상황에서 써보세요

- 보컬이 이어폰 끼고 노래할 때 — 다른 멤버와 같은 클릭을 공유
- 드러머 박자 체크할 때 — 모두가 같은 기준으로 듣기
- 합주실에서 클릭 트랙 없이 연습할 때 — 폰만 있으면 OK

### 사용 방법

1. **방 만들기** — 사이트에 접속해서 "방 생성하기" 클릭
2. **공유하기** — QR 코드나 링크를 멤버들에게 공유
3. **함께 연주** — 템포/박자 설정 후 재생하면 모든 기기에서 동기화된 클릭이 재생됩니다

## 폴더 구조
```
apps/
  client/   # React 19 + Vite + PandaCSS
  server/   # NestJS + Prisma + PostgreSQL + Socket.IO
packages/
  shared/   # 공유 타입, 상수 (프론트/백 공용)
docs/       # 전체 문서(아키텍처, API, 환경, 배포 등)
```

## 빠른 시작 (로컬)

### 사전 요구사항
- Node.js 20+
- pnpm 9+
- Docker & Docker Compose (DB용)

### 1) 의존성 설치
```bash
pnpm install
```

### 2) DB 실행 (PostgreSQL)
```bash
docker compose up -d postgres
```

### 3) DB 마이그레이션
```bash
cd apps/server
cp .env.example .env
npx prisma migrate dev
cd ../..
```

### 4) 개발 서버 실행
```bash
# 전체 실행 (클라이언트 + 서버)
pnpm dev

# 또는 개별 실행
pnpm dev:client   # http://localhost:5173
pnpm dev:server   # http://localhost:3000
```

## 주요 기능
- **실시간 동기화** — 방에 접속한 모든 기기에서 동시에 같은 클릭이 재생됩니다
- **QR 코드 공유** — 방을 만들면 QR 코드가 생성되어 쉽게 공유할 수 있습니다
- **템포/박자 조절** — BPM과 박자(2~7박)를 자유롭게 변경할 수 있습니다
- **탭 템포** — 화면을 탭하여 원하는 템포를 직접 입력할 수 있습니다
- **시계 보정** — 서버 시간 기준 동기화로 기기 간 시차를 자동 보정합니다

## 기술 스택
- **프론트엔드**: React 19, Vite, PandaCSS, Socket.IO Client
- **백엔드**: NestJS, Prisma, PostgreSQL, Socket.IO
- **공유**: TypeScript 모노레포 (pnpm workspaces + Turborepo)
- **인프라**: Vercel(프론트), Docker Compose(백엔드)

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

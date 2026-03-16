# 메트로놈들 (Metro-nomedeul)

실시간으로 여러 사용자가 동일한 템포/박자에 맞춰 메트로놈을 동기화하여 연주할 수 있는 웹 애플리케이션입니다. TypeScript 모노레포(pnpm + Turborepo) 구조로 프론트엔드와 백엔드를 통합 관리합니다.

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
- 방 생성(POST /room) 및 QR 코드로 방 참여 링크 공유
- Socket.IO를 통한 서버 주도 메트로놈 상태 브로드캐스트
- Web Audio API 기반 정밀 오디오 스케줄링과 서버 시각 기준 동기화
- 템포/박자 변경 및 시작/정지 제어

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

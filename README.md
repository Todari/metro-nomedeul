# 메트로놈들

각자의 이어폰으로 같은 클릭을 듣는 실시간 합주 메트로놈입니다. 방을 만들고 QR이나 링크를
공유하면 여러 기기가 서버 시각을 기준으로 같은 박자를 재생합니다.

[![서비스](https://img.shields.io/badge/서비스-metronomdeul.site-f97316)](https://metronomdeul.site)
[![Deploy Server](https://github.com/Todari/metro-nomedeul/actions/workflows/deploy-server.yml/badge.svg)](https://github.com/Todari/metro-nomedeul/actions/workflows/deploy-server.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 해결하는 문제

같은 BPM 숫자를 맞추는 것만으로는 합주 중 실제 클릭 시점이 일치하지 않습니다. 네트워크
지연, 기기별 시계 차이, 브라우저 오디오 활성화 시점 때문에 시간이 지날수록 박자가 어긋날 수
있습니다. 메트로놈들은 서버 시간 보정과 Web Audio 선행 스케줄링을 결합해 이 차이를 줄입니다.

## 주요 기능

- 가입 없이 방을 만들고 QR 코드·초대 링크로 참여
- 방장의 재생·정지, BPM, 박자 변경을 모든 참여자에게 실시간 동기화
- 서버 시각 오프셋과 전송 지연을 반영한 재생 위치 보정
- JavaScript timer와 분리된 Web Audio API 기반 클릭 예약
- 연결이 끊긴 뒤 현재 방 상태로 복귀하는 재접속 흐름
- iOS 브라우저의 사용자 제스처·AudioContext 활성화 경합 대응
- 탭 템포와 2–7박자 설정

## 동작 구조

```text
React + Vite client
  ├─ Web Audio scheduler
  └─ Socket.IO client
            │
            ▼
NestJS + Socket.IO server
  ├─ room state / sync events
  └─ Prisma
            │
            ▼
       PostgreSQL
```

서버가 재생 상태와 기준 시각을 공유하고 클라이언트는 왕복 시간을 이용해 로컬 시계와의
오프셋을 추정합니다. 실제 클릭은 `AudioContext.currentTime` 기준으로 미리 예약해 이벤트 루프
지터가 오디오 타이밍으로 전파되는 것을 줄입니다.

## 저장소 구조

| 경로 | 역할 | 주요 기술 |
| --- | --- | --- |
| `apps/client` | 랜딩, 방 생성·참여, 메트로놈 UI | React 19, Vite, Panda CSS, Web Audio |
| `apps/server` | 방 상태와 실시간 동기화 API | NestJS, Socket.IO, Prisma |
| `packages/shared` | 클라이언트·서버 공유 계약 | TypeScript |
| `docs` | 아키텍처, API, 환경, 배포 문서 | Markdown |

## 로컬 실행

Node.js 20+, pnpm 9+, Docker가 필요합니다.

```bash
pnpm install
docker compose up -d postgres
cp apps/server/.env.example apps/server/.env
pnpm --filter @metro-nomedeul/server prisma:generate
pnpm --filter @metro-nomedeul/server prisma:migrate
pnpm dev
```

- 클라이언트: `http://localhost:5173`
- 서버: `http://localhost:3000`

주요 환경변수:

| 변수 | 역할 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 연결 문자열 |
| `ALLOWED_ORIGIN` | 서버가 허용할 클라이언트 origin |
| `VITE_API_URL` | 클라이언트 HTTP API 주소 |
| `VITE_WS_URL` | 클라이언트 Socket.IO 주소 |
| `SENTRY_DSN` | 선택적 서버 오류 추적 |

실제 값은 커밋하지 말고 `.env.example`을 복사한 로컬 `.env`에서 관리하세요.

## 검증

```bash
pnpm lint
pnpm build
pnpm --filter @metro-nomedeul/server test
```

프로토콜이나 환경 설정을 바꾸면 [`docs`](docs/README.md)의 관련 문서도 함께 갱신합니다.

## 배포

- 클라이언트: Vercel
- 서버: Docker Compose + GitHub Actions SSH 배포
- 프로덕션: [metronomdeul.site](https://metronomdeul.site)

## 보안

운영 환경변수와 배포 자격증명은 저장소 밖에서 관리합니다. 취약점은 공개 Issue 대신
[보안 정책](SECURITY.md)의 비공개 제보 경로를 이용해 주세요.

## 라이선스

[MIT](LICENSE)

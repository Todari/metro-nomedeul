# 배포 가이드 (프론트: Vercel / 백엔드: Docker)

## 프론트엔드 (Vercel)

- 정적 호스팅: Vite로 빌드된 산출물을 Vercel에 호스팅합니다.
- SPA 라우팅: `vercel.json`에서 모든 경로를 `/index.html`로 재작성합니다.

### 빌드 명령
```
npm run build
```
- `panda codegen && tsc -b && vite build`가 순차 실행됩니다.

### Vercel 설정
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- `vercel.json`(이미 포함):
```json
{
  "routes": [
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```

### 환경 변수
- `VITE_API_URL`
- `VITE_WS_URL`

프로젝트 Settings → Environment Variables에 추가하고, 적절한 환경(Production/Preview/Development)에 연결하세요.

## 백엔드 (Docker Compose)

### 로컬 실행
```
docker compose up -d --build
```
- API: `http://localhost:3000`
- WS: `ws://localhost:3000/socket.io`

### 주요 환경 변수 (apps/server/.env 또는 compose 변수)
```
PORT=3000
DATABASE_URL=postgresql://metronomdeul:metronomdeul@localhost:5432/metronomdeul
ALLOWED_ORIGIN=http://localhost:5173,http://localhost:3000,https://metronomdeul.site,https://www.metronomdeul.site
```

### 인스턴스 구성

현재 구현은 **단일 인스턴스 배포 전용**입니다. 방 상태(재생 여부, tempo, beats, 타이머)는 프로세스 메모리에 저장되므로 여러 인스턴스를 띄우면 같은 방에 접속한 클라이언트들끼리 상태 동기화가 깨집니다. 수평 확장이 필요해지면 Socket.IO redis-adapter + 상태 Redis 이관을 함께 도입해야 합니다.

### 운영 배포 가이드라인
- 컨테이너 이미지 빌드 후 오케스트레이션(K8s/Swarm/Compose)로 배포
- 로드밸런서/프록시에서 WS 업그레이드 헤더(`Connection`, `Upgrade`) 전달 보장
- `ALLOWED_ORIGIN`에 배포된 프론트 도메인을 반드시 포함
- Graceful shutdown: 프로세스는 `SIGTERM`에서 `serverShutdown`을 브로드캐스트한 뒤 타이머를 정리합니다. 오케스트레이터가 stop grace period를 10초 이상 주도록 설정하세요.

### Prisma 마이그레이션
- 스키마 변경 후 `npx prisma migrate dev --name <name>`로 마이그레이션을 생성합니다.
- 운영 적용은 `npx prisma migrate deploy`.

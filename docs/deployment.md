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
cd server
docker compose up -d --build
```
- API: `http://localhost:8080`
- WS: `ws://localhost:8080/ws/:uuid`

### 주요 환경 변수 (server/.env 또는 compose 변수)
```
PORT=8080
DATABASE_URL=mongodb://mongo:27017
DATABASE_NAME=metronomdeul
ALLOWED_ORIGIN=http://localhost:5173,http://localhost:3000,https://metronomdeul.site
JWT_SECRET=<set-strong-secret>
```

### 운영 배포 가이드라인
- 컨테이너 이미지 빌드 후 오케스트레이션(K8s/Swarm/Compose)로 배포
- 로드밸런서/프록시에서 WS 업그레이드 헤더(`Connection`, `Upgrade`) 전달 보장
- `ALLOWED_ORIGIN`에 배포된 프론트 도메인을 반드시 포함

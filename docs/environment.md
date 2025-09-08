# 환경 설정 (.env)

루트에 `.env`를 생성하고 서버/클라이언트 변수를 설정합니다.

## 클라이언트
```
VITE_API_URL=https://<api-host>
VITE_WS_URL=wss://<ws-host>/ws
```

- 로컬 예시
```
VITE_API_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080/ws
```

## 서버
```
PORT=8080
DATABASE_URL=mongodb://localhost:27017
DATABASE_NAME=metronomdeul
ALLOWED_ORIGIN=http://localhost:5173,http://localhost:3000,https://metronomdeul.site
JWT_SECRET=<set-strong-secret>
```

- Docker Compose 사용 시 `server/docker-compose.yml`의 기본값이 적용됩니다.

## 기타
- PandaCSS는 `panda codegen`으로 `styled-system/`을 생성합니다. `dev`, `build`, `postinstall` 스크립트에 포함되어 있습니다.
- SPA 라우팅은 `vercel.json`의 rewrite 설정으로 지원됩니다.

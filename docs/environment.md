# 환경 설정 (.env)

루트에 `.env`를 생성하고 서버/클라이언트 변수를 설정합니다.

## 클라이언트
```
VITE_API_URL=https://<api-host>
VITE_WS_URL=wss://<api-host>
```

- `VITE_WS_URL`에는 경로를 붙이지 않습니다. Socket.IO는 URL 경로를 네임스페이스로 해석하고 서버는 기본 네임스페이스(`/`)만 받으므로, `/ws`를 붙이면 `Invalid namespace`로 실시간 동기화가 전부 실패합니다.
- 프로덕션(Vercel): `VITE_API_URL=https://api.metronome.todari.dev`, `VITE_WS_URL=wss://api.metronome.todari.dev`. 값은 빌드 시 번들에 들어가므로 바꾼 뒤 재배포해야 반영됩니다.

- 로컬 예시
```
VITE_API_URL=http://localhost:3000
VITE_WS_URL=http://localhost:3000
```

## 서버
```
PORT=3000
DATABASE_URL=postgresql://metronomdeul:metronomdeul@localhost:5432/metronomdeul
ALLOWED_ORIGIN=http://localhost:5173,http://localhost:3000,https://metronome.todari.dev
```

- Docker Compose 사용 시 루트 `docker-compose.yml`의 기본값이 적용됩니다.

## 기타
- PandaCSS는 `panda codegen`으로 `styled-system/`을 생성합니다. `dev`, `build`, `postinstall` 스크립트에 포함되어 있습니다.
- SPA 라우팅은 `vercel.json`의 rewrite 설정으로 지원됩니다.



# 메트로놈들 (Metro-nomedeul)

메트로놈들은 사용자들이 함께 메트로놈을 공유하며 실시간으로 동일한 템포와 비트에 맞춰 연주할 수 있는 웹 서비스입니다.

## 기술 스택

React, TypeScript, Vite, WebSocket, React Query, PandaCSS

## 주요 기능

- **실시간 메트로놈 공유**: 사용자가 설정한 메트로놈 템포와 비트가 모든 참여자에게 실시간으로 공유됩니다.
- **동기화된 메트로놈**: 서버 시간을 기준으로 모든 클라이언트의 메트로놈이 정확하게 동기화됩니다.
- **템포 조절**: 40~240 BPM 사이에서 자유롭게 템포를 조절할 수 있습니다.
- **비트 설정**: 마디당 비트 수를 조절하여 다양한 박자에 맞춰 연주할 수 있습니다.
- **방 생성 및 참여**: 새로운 방을 생성하거나 기존 방에 참여하여 함께 연주할 수 있습니다.

## 설치 및 실행

### 요구 사항

- Node.js 20.15.1 이상
- npm 또는 yarn

### 설치

```sh
git clone https://github.com/yourusername/metro-nomedeul.git
cd metro-nomedeul
npm install
```

### 개발 서버 실행

```sh
npm run dev
```

### 빌드

```sh
npm run build
```

## 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 다음 변수를 설정하세요:

```
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:3000/ws
```

## 디렉토리 구조

- `src/apis`: API 요청 관련 코드
- `src/components`: 재사용 가능한 UI 컴포넌트
- `src/constants`: 상수 값 정의
- `src/hooks`: 커스텀 React 훅
- `src/pages`: 페이지 컴포넌트
- `src/types`: TypeScript 타입 정의
- `src/utils`: 유틸리티 함수
- `public/sounds`: 메트로놈 사운드 파일

## 사용 방법

1. 홈페이지에서 "방 생성하기" 버튼을 클릭하여 새로운 방을 생성합니다.
2. 생성된 방 URL을 공유하여 다른 사용자를 초대할 수 있습니다.
3. 메트로놈 컨트롤을 사용하여 템포와 비트를 조절합니다.
4. "메트로놈 시작" 버튼을 클릭하여 모든 참여자에게 동기화된 메트로놈을 시작합니다.

## 기여 방법

1. 이 저장소를 포크합니다.
2. 새로운 브랜치를 생성합니다. (`git checkout -b feature/amazing-feature`)
3. 변경 사항을 커밋합니다. (`git commit -m 'Add some amazing feature'`)
4. 브랜치에 푸시합니다. (`git push origin feature/amazing-feature`)
5. Pull Request를 생성합니다.

## 라이선스

MIT 라이선스에 따라 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 문의

질문이나 제안 사항이 있으시면 이슈 페이지를 통해 문의해 주세요.

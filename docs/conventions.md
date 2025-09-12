# 코드 컨벤션

## 일반
- TypeScript 사용, 명시적 타입 지향(노이즈 과다면 생략 허용).
- 의미 있는 변수/함수명 사용(축약 지양).
- Early return, 깊은 중첩 회피.

## React
- 함수 컴포넌트 + 훅스
- 훅 네이밍: `useXxx`
- 상태/이펙트 최소화, 의존성 배열 신중 관리
- 라우트 컴포넌트는 `pages/` 하위에 위치

## 스타일
- PandaCSS 유틸 사용: `css`, `vstack`, `hstack`, `container`
- 디자인 토큰 우선 사용(색상/간격 등)

## 네트워크
- REST: `utils/http.ts` 래퍼 사용
- WebSocket: `hooks/useWebSocket.ts` 사용(자동 재연결/`sendMessage`)

## 파일 구조
- `apis/`, `components/`, `hooks/`, `pages/`, `utils/`, `types/`
- 페이지 전용 UI는 해당 페이지 폴더 또는 `components/`로 승격
- 재사용 가능한 UI 컴포넌트는 `components/`에 위치 (ScrollPicker, HorizontalScrollPicker, BeatCard, Header 등)

## 색상 시스템
- **Primary**: 오렌지 계열 (orange.400, orange.600, orange.700, orange.800)
- **Secondary**: 중성 회색 계열 (neutral.300, neutral.600, neutral.700, neutral.800)
- **일관성**: gray 대신 neutral 사용 권장
- **다크모드**: 기본적으로 어두운 배경에 밝은 텍스트

## 린팅
- `npm run lint`
- ESLint(react-hooks, react-refresh) 설정을 준수

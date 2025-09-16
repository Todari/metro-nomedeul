# 트러블슈팅

## WebSocket 연결 안 됨
- `.env`의 `VITE_WS_URL` 확인(프로토콜 `ws://` vs `wss://`)
- 방 `uuid` 파라미터 포함 여부 확인
- 네트워크, CORS, 프록시 설정 확인

### WebSocket 연결 불안정 (v2.4 해결)
- **증상**: "WebSocket is already in CLOSING or CLOSED state" 오류
- **원인**: WebSocket 연결이 완전히 설정되기 전에 메시지 전송 시도
- **해결**: 메시지 큐 시스템으로 자동 해결됨
  - 연결이 준비되지 않았을 때 메시지를 큐에 저장
  - 연결되면 큐에 저장된 메시지를 자동으로 전송
  - 전송 실패 시 메시지를 큐에 다시 저장
- **확인 방법**: 콘솔에서 "WebSocket이 준비되지 않았습니다" 경고 메시지 확인

### 메시지 큐 관련 문제 (v2.4 해결)
- **증상**: 메시지가 누적되어 메모리 사용량이 증가
- **원인**: 큐에 제한이 없어서 메시지가 무한정 쌓임
- **해결**: 스마트 큐 관리 시스템으로 자동 해결됨
  - 최대 50개 메시지로 큐 크기 제한
  - 30초가 지난 오래된 메시지 자동 제거
  - 같은 액션의 중복 메시지 제거 (최신 것만 유지)
  - 10초마다 주기적 큐 정리
- **메모리 사용량**: 최대 약 1-2KB로 제한됨

## 오디오가 재생되지 않음
- 브라우저 오토플레이 정책으로 인해 사용자 제스처 필요
- `AudioContext` 미지원 브라우저인지 확인(iOS 구버전)
- Web Audio API 지원 여부 확인

### Web Audio API 기반 사운드 생성 (v3.0)
- **새로운 방식**: 오디오 파일 대신 Web Audio API로 실시간 사운드 생성
- **장점**: 파일 로딩 불필요, 네트워크 독립적, 즉시 재생 가능
- **구현**: `createClickSound()` 메서드로 악센트(1200Hz)와 일반(800Hz) 비트 구분

### 상세 증상과 해결
- 첫 진입 시 재생 불가
  - 원인: 초기 렌더링 단계에서 `AudioContext`가 `suspended` 상태
  - 해결: 시작 버튼 클릭 시 `initializeAudio()`를 먼저 수행하여 `resume()` 후 `start()` 실행
- 시작 버튼을 눌러도 가끔 두 번 재생됨
  - 원인: WebSocket 재연결 시 `message` 리스너가 중복으로 바인딩
  - 해결: `Metronome#setWebSocket`에서 기존 리스너 제거 후 재바인딩하도록 수정
- '오디오 초기화 실패' 오류
  - 원인: `AudioContext` 생성 실패 또는 `suspended` 상태
  - 해결: 재시도 로직 추가 (최대 3회), `resume()` 호출, 상태 확인
- 사운드 파일 관련 오류 (v3.0 이전)
  - 원인: `decodeAudioData` 에러, 브라우저별 Promise/Callback 차이
  - 해결: Web Audio API로 대체하여 파일 의존성 제거

### 체크리스트
- 시작 버튼 1회 클릭으로 초기화+재생이 되는가
- 로그 순서: initialize → AudioContext 생성 → resume → 초기화 완료 → start
- iOS/Safari에서 사용자 제스처(버튼 클릭) 내에서 정상 동작하는가

## BPM 변경 시 클라이언트 불일치 (v3.0 해결)
- **증상**: 재생 중 BPM을 변경하면 클라이언트 간 박자가 어긋남
- **원인**: 로컬 즉시 반영으로 인한 타이밍 차이
- **해결**: 서버 중심 BPM 변경 처리로 모든 클라이언트가 동시에 동기화
  - 서버에서 박자 위상을 정확히 계산하여 브로드캐스트
  - 클라이언트는 서버 응답을 기다린 후 동기화
  - 동기화 임계값 최적화 (200ms 이상에서만 동기화)
  - 안전장치: 2박자 이상의 큰 차이는 무시

## 재생 중 설정 변경 문제 (v3.1 해결)
- **증상**: 재생 중 BPM/박자 변경 시 클라이언트 간 불일치 지속 발생
- **원인**: 재생 중 설정 변경으로 인한 복잡한 동기화 문제
- **해결**: 재생 중 설정 변경 완전 차단
  - 재생 중에는 설정 UI 비활성화 (opacity 0.5, pointer-events: none)
  - 설정 버튼 클릭 시 자동으로 메트로놈 정지
  - 서버에서 재생 중 설정 변경 시 자동 정지 후 변경
  - 모든 클라이언트에서 동시에 정지되어 일관성 보장

### 동기화 관련 문제
- **과도한 동기화**: 동기화가 너무 자주 발생하여 박자가 어긋남
  - 해결: 동기화 빈도를 1초 → 5초로 조정
  - 임계값을 50ms → 200ms로 증가
- **네트워크 지연**: 클라이언트 간 네트워크 지연으로 인한 불일치
  - 해결: 서버에서 정확한 시작 시간 재계산
  - 클라이언트는 서버 시간을 기준으로 동기화

## QR 스캔 실패
- `BarcodeDetector` 지원 확인(사파리 17+/크롬 최신)
- 미지원 시 파일 업로드 폴백 메시지 확인

## 동기화 문제 (v2.4 해결)

### 시작/정지가 다른 클라이언트에 반영되지 않음
- **증상**: 한 클라이언트에서 시작/정지해도 다른 클라이언트에 반영되지 않음
- **원인**: 서버 상태 변경 시 오디오 초기화가 필요하지만 처리되지 않음
- **해결**: v2.4에서 자동 해결됨
  - 서버 상태 변경 시 오디오가 준비되지 않으면 자동 초기화
  - 사용자 액션과 서버 상태 변경을 구분하여 처리
  - 비동기 상태 처리를 통한 안전한 동기화

### BPM/박자 변경은 되지만 시작/정지가 안 됨
- **증상**: BPM과 박자 변경은 양쪽에 반영되지만 시작/정지는 안 됨
- **원인**: 서버에서 받은 시작/정지 상태를 제대로 처리하지 않음
- **해결**: v2.4에서 자동 해결됨
  - `startFromServer()`와 `stopFromServer()` 메서드 추가
  - 서버 상태 변경 시 WebSocket 메시지를 다시 보내지 않도록 처리
  - 오디오 초기화를 포함한 안전한 상태 변경

## 모바일 터치 이벤트 문제 (v3.2 해결)

### 증상
- **PC 환경**: 모든 버튼이 정상 작동
- **모바일 환경**: SettingsBottomSheet의 버튼들이 터치에 반응하지 않음
- **콘솔 로그**: 모바일에서 클릭 로그가 나타나지 않음

### 원인
1. **이벤트 처리 차이**: 모바일에서는 `onClick` 이벤트가 터치에 제대로 반응하지 않음
2. **CSS 설정 충돌**: `pointerEvents: 'none'` 설정이 터치 이벤트를 차단
3. **복잡한 터치 최적화**: 과도한 CSS 설정이 예상치 못한 충돌 발생

### 해결 방법
#### **1. 이중 이벤트 핸들러 적용**
```typescript
// PC용 onClick + 모바일용 onTouchStart
<Button 
  onClick={() => {
    console.log('버튼 클릭됨');
    onClose();
  }}
  onTouchStart={(e) => {
    console.log('버튼 터치됨');
    e.preventDefault();
    onClose();
  }}
>
```

#### **2. CSS 설정 단순화**
```typescript
// Before (문제)
<div className={css({ 
  pointerEvents: isPlaying ? 'none' : 'auto'  // ← 터치 이벤트 차단
})}>

// After (해결)
<div className={css({ 
  opacity: isPlaying ? 0.5 : 1  // ← 단순화
})}>
```

#### **3. 구조적 단순화**
- ShareBottomSheet와 동일한 구조 사용
- 복잡한 CSS 설정 제거
- 디버깅 로그 추가

### 적용된 컴포넌트
- **SettingsBottomSheet**: 오버레이, 닫기 버튼, Tab 버튼, 정지 후 설정 버튼
- **모든 버튼**: 이중 이벤트 핸들러로 PC/모바일 호환성 확

## 스크롤 피커 성능 문제 (v3.3 해결)

### 증상
- **스크롤 버벅임**: 스크롤할 때 끊어지는 느낌
- **메모리 사용량 증가**: 많은 BPM 값(40-240)에서 메모리 과다 사용
- **반응 지연**: 스크롤 입력에 대한 반응이 느림
- **모바일 성능 저하**: 저사양 모바일에서 특히 심각

### 원인
- **전체 렌더링**: 모든 아이템을 매번 렌더링 (200개)
- **복잡한 계산**: 각 아이템마다 opacity, scale 계산
- **불필요한 리렌더링**: handleMove에서 onChange 호출
- **CPU 기반 애니메이션**: GPU 가속 미활용

### 해결 방법
1. **가상화 적용**:
   ```typescript
   // 화면에 보이는 아이템만 렌더링
   const visibleRange = useMemo(() => {
     const visibleCount = Math.ceil(height / itemHeight) + 2;
     const currentIndex = Math.round(-offset / itemHeight);
     const startIndex = Math.max(0, currentIndex - Math.floor(visibleCount / 2));
     const endIndex = Math.min(values.length - 1, startIndex + visibleCount - 1);
     return { startIndex, endIndex, visibleCount };
   }, [height, itemHeight, offset, values.length]);
   ```

2. **메모이제이션 적용**:
   ```typescript
   // 값 목록 캐싱
   const values = useMemo(() => 
     Array.from({ length: Math.floor((max - min) / step) + 1 }, (_, i) => min + i * step).reverse(),
     [min, max, step]
   );
   ```

3. **디바운싱 구현**:
   ```typescript
   // onChange 호출을 60fps로 제한
   onChangeTimeoutRef.current = setTimeout(() => {
     // onChange 로직
   }, 16);
   ```

4. **GPU 가속 최적화**:
   ```typescript
   // CSS Transform 최적화
   transform: `scale(${scale}) translate3d(0, 0, 0)`,
   willChange: 'transform, opacity'
   ```

### 적용된 컴포넌트
- **ScrollPicker**: BPM 설정용 세로 스크롤 피커
- **HorizontalScrollPicker**: 박자 설정용 가로 스크롤 피커

### 검증 방법
1. **성능 테스트**: 브라우저 개발자 도구 Performance 탭에서 렌더링 성능 확인
2. **메모리 사용량**: Memory 탭에서 메모리 사용량 변화 확인
3. **스크롤 테스트**: 다양한 BPM 범위에서 스크롤 부드러움 확인
4. **모바일 테스트**: 저사양 모바일에서 성능 개선 확인

### 결과
- **렌더링 아이템 수**: 95% 감소 (200개 → 8-10개)
- **메모리 사용량**: 대폭 감소
- **스크롤 성능**: 부드러운 60fps 달성
- **사용자 경험**: 버벅임 없는 매끄러운 스크롤

## 빌드 실패
- PandaCSS 코드젠 실패 → `npm run panda` 또는 `npm run build`
- TypeScript 버전/타입 충돌 → `node_modules` 정리 후 재설치

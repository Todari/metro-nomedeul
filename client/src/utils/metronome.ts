/**
 * 안정적인 메트로놈 구현
 * requestAnimationFrame 기반으로 정확한 타이밍 제공
 * 중복 재생 방지 및 상태 관리 강화
 */

// 메트로놈 엔진: 오디오 초기화/사운드 스케줄/WS 동기화
export class Metronome {
  private audioContext: AudioContext | null = null;
  private isPlaying: boolean = false;
  private tempo: number = 120;
  // 템포 상태
  private currentTempo: number = 120;
  private beatsPerBar: number = 4;
  private beatCount: number = 0;
  
  // 오디오 관련
  private isAudioReady: boolean = false;
  private audioInitRetryCount: number = 0;
  private readonly maxAudioInitRetries: number = 3;
  
  // 타이밍 관련
  private startTime: number = 0; // wall-clock(ms) - 유지용
  private startAudioTimeSec: number = 0; // AudioContext 기준 시간(sec)
  private nextNoteTimeSec: number = 0; // 다음 노트 시간(sec, AudioContext 기준)
  private animationFrameId: number | null = null;
  private readonly scheduleAheadSec: number = 0.05; // 50ms 앞당겨 예약
  
  // WebSocket
  private websocket: WebSocket | null = null;
  private wsMessageHandler?: (event: MessageEvent<string>) => void;
  private sendMessage?: (message: unknown) => void;
  
  // 콜백
  private onTempoChange: ((tempo: number) => void) | null = null;
  private onBeatsChange: ((beats: number) => void) | null = null;
  private onPlayStateChange: ((isPlaying: boolean) => void) | null = null;
  private onBeat: ((beatIndex: number, beatsPerBar: number) => void) | null = null;
  
  // 탭 템포
  private tapTimes: number[] = [];
  private readonly maxTapTimes: number = 4;

  // 중복 실행 방지
  private isInitializing: boolean = false;
  private isStarting: boolean = false;
  
  // 자동 재생 설정
  private autoPlayEnabled: boolean = true;

  constructor(websocket: WebSocket | null = null) {
    this.websocket = websocket;
    this.setupWebSocket();
  }

  // 초기화 (사용자 상호작용 후 호출)
  public async initialize(): Promise<boolean> {
    if (this.isInitializing) {
      return false;
    }
    
    if (this.audioContext && this.audioContext.state === 'running') {
      return true;
    }
    
    this.isInitializing = true;

    try {
      // AudioContext 생성
      const AudioContextCtor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) {
        throw new Error('AudioContext not supported in this browser');
      }
      
      this.audioContext = new AudioContextCtor();
      
      // AudioContext가 suspended 상태인 경우 resume
      if (this.audioContext.state === 'suspended') {
        try {
          await this.audioContext.resume();
        } catch (resumeError) {
          throw new Error('AudioContext resume failed: ' + resumeError);
        }
      }
      
      // AudioContext 상태 확인
      if (this.audioContext.state !== 'running') {
        throw new Error(`AudioContext가 running 상태가 아닙니다. 현재 상태: ${this.audioContext.state}`);
      }

      this.isAudioReady = true;
      this.audioInitRetryCount = 0;
      return true;
    } catch (error) {
      this.audioContext = null;
      this.isAudioReady = false;
      
      // 재시도 로직
      if (this.audioInitRetryCount < this.maxAudioInitRetries) {
        this.audioInitRetryCount++;
        setTimeout(() => {
          this.initialize();
        }, 1000 * this.audioInitRetryCount); // 1초, 2초, 3초 후 재시도
      }
      
      return false;
    } finally {
      this.isInitializing = false;
    }
  }



  // WebSocket 설정
  private setupWebSocket() {
    // 기존 리스너 분리
    if (this.websocket && this.wsMessageHandler) {
      this.websocket.removeEventListener('message', this.wsMessageHandler as EventListener);
    }
    if (!this.websocket) return;

    this.wsMessageHandler = (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'metronomeState') {
          this.handleServerState(data);
        }
      } catch (error) {
        console.error('WebSocket 메시지 파싱 실패:', error);
      }
    };
    this.websocket.addEventListener('message', this.wsMessageHandler as EventListener);
  }

  public setWebSocket(ws: WebSocket | null) {
    this.websocket = ws;
    this.setupWebSocket();
  }

  public setSendMessage(sendMessage: ((message: unknown) => void) | null) {
    this.sendMessage = sendMessage || undefined;
  }

  // 서버 상태 처리
  public async handleServerState(state: {
    type: string;
    isPlaying: boolean;
    tempo: number;
    beats: number;
    startTime: number;
    serverTime: number;
    roomUuid: string;
  }) {
    // 서버 상태 수신

    // 템포 업데이트 (서버에서 받은 BPM 변경을 로컬에 적용)
    if (state.tempo && state.tempo !== this.tempo) {
      this.applyTempoChange(state.tempo);
    }

    // 박자 업데이트
    if (state.beats && state.beats !== this.beatsPerBar) {
      this.beatsPerBar = state.beats;
      this.onBeatsChange?.(state.beats);
    }

    // 서버에서 정지 상태를 받으면 로컬도 정지
    if (!state.isPlaying && this.isPlaying) {
      this.stopFromServer();
    }
    
    // 서버에서 재생 중이지만 로컬은 정지 상태인 경우 자동으로 시작 (설정에 따라)
    if (state.isPlaying && !this.isPlaying && this.autoPlayEnabled) {
      await this.startFromServer(state);
    }
    
    // 재생 중일 때도 주기적 동기화 처리 (박자 동기화) - 템포가 다를 때만
    if (state.isPlaying && this.isPlaying && state.tempo !== this.tempo) {
      this.syncWithServer(state);
    }
  }

  // 서버와 동기화 (재생 중일 때 주기적 동기화)
  private syncWithServer(serverState: {
    isPlaying: boolean;
    startTime: number;
    serverTime: number;
    tempo: number;
    beats: number;
  }) {
    if (!this.isPlaying || !this.audioContext) return;

    const now = Date.now();
    const nowAudio = this.audioContext.currentTime;
    
    // 서버와의 시간 차이 계산 (네트워크 지연 고려)
    const timeOffset = now - serverState.serverTime;
    const serverStartTime = serverState.startTime + timeOffset;
    
    // 서버 기준으로 현재 박자 위치 계산
    const elapsedMs = now - serverStartTime;
    const secondsPerBeat = 60.0 / serverState.tempo;
    const totalBeatsElapsed = elapsedMs / (secondsPerBeat * 1000);
    const currentBeatIndex = Math.floor(totalBeatsElapsed) % serverState.beats;
    
    // 서버와 동기화된 다음 박자 시간 계산
    const nextBeatInSequence = Math.ceil(totalBeatsElapsed);
    const nextBeatTimeMs = serverStartTime + (nextBeatInSequence * secondsPerBeat * 1000);
    const nextBeatTimeAudio = nowAudio + (nextBeatTimeMs - now) / 1000;
    
    // 동기화 임계값 계산 (더 큰 임계값으로 안정성 향상)
    const syncThreshold = Math.max(0.2, secondsPerBeat * 0.3); // 최소 200ms, BPM의 30%
    
    // 동기화 적용 (큰 차이가 있을 때만)
    const timeDiff = Math.abs(nextBeatTimeAudio - this.nextNoteTimeSec);
    if (timeDiff > syncThreshold) {
      // 안전장치: 너무 큰 차이는 무시 (네트워크 오류 등)
      const maxAllowedDiff = secondsPerBeat * 2; // 최대 2박자 차이까지만 허용
      if (timeDiff < maxAllowedDiff) {
        // 즉시 동기화 (부드러운 조정 제거)
        this.nextNoteTimeSec = Math.max(nextBeatTimeAudio, nowAudio + 0.001);
        this.beatCount = currentBeatIndex;
        
        // 서버와 동기화 (최적화)
      }
    }
  }

  // 서버 상태로 메트로놈 시작 (WebSocket 메시지 전송 안함)
  private async startFromServer(serverState: {
    isPlaying: boolean;
    startTime: number;
    serverTime: number;
  }) {
    if (this.isPlaying || this.isStarting) return;

    // 서버 상태로 자동 시작

    // AudioContext만 초기화 (파일 로딩 불필요)
    if (!this.audioContext) {
      const initialized = await this.initialize();
      if (!initialized) {
        return;
      }
    }

    // AudioContext가 suspended 상태인 경우 resume
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }

    // 서버와 동기화된 시작
    await this.start(serverState);
  }

  // 메트로놈 시작 (서버와 동기화된 시작)
  public async start(serverState?: {
    isPlaying: boolean;
    startTime: number;
    serverTime: number;
  }) {
    if (this.isStarting) {
      // 중복 시작 방지
      return;
    }

    if (this.isPlaying) {
      return;
    }

    this.isStarting = true;

    try {
      // AudioContext만 초기화 (파일 로딩 불필요)
      if (!this.audioContext) {
        const initialized = await this.initialize();
        if (!initialized) {
          return;
        }
      }

      // AudioContext가 suspended 상태인 경우 resume
      if (this.audioContext?.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.isPlaying = true;
      
      // AudioContext 시간을 먼저 설정
      this.startAudioTimeSec = this.audioContext!.currentTime;
      
      if (serverState && serverState.isPlaying) {
        // 서버와 동기화된 시작
        const clientTime = Date.now();
        const timeOffset = clientTime - serverState.serverTime;
        this.startTime = serverState.startTime + timeOffset;
        
        // 서버 시작 시간을 기준으로 현재 비트 계산
        const elapsedMs = clientTime - this.startTime;
        const secondsPerBeat = 60.0 / this.tempo;
        const elapsedBeats = elapsedMs / (secondsPerBeat * 1000);
        this.beatCount = Math.floor(elapsedBeats) % this.beatsPerBar;
        
        // 서버와 동기화된 다음 비트 시간 계산
        const nextBeatInServer = Math.ceil(elapsedBeats);
        const nextBeatTimeMs = this.startTime + (nextBeatInServer * secondsPerBeat * 1000);
        const nextBeatTimeClient = nextBeatTimeMs;
        const nextBeatTimeAudio = this.startAudioTimeSec + (nextBeatTimeClient - clientTime) / 1000;
        this.nextNoteTimeSec = Math.max(nextBeatTimeAudio, this.startAudioTimeSec + 0.001);
        
        // 서버와 동기화된 시작
      } else {
        // 일반 시작
        this.startTime = Date.now();
        this.beatCount = 0;
        this.nextNoteTimeSec = this.startAudioTimeSec + 0.001;
      }

      // 템포 초기화
      this.currentTempo = this.tempo;

      // 애니메이션 프레임 시작
      this.scheduleNextBeat();
      
      this.onPlayStateChange?.(true);
    } catch (error) {
    } finally {
      this.isStarting = false;
    }
  }

  // 메트로놈 정지
  public stop() {
    if (!this.isPlaying) return;

    this.isPlaying = false;
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    this.beatCount = 0;
    
    this.onPlayStateChange?.(false);
  }


  // 서버 상태로 메트로놈 정지 (WebSocket 메시지 전송 안함)
  private stopFromServer() {
    if (!this.isPlaying) return;

    this.isPlaying = false;
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    this.beatCount = 0;
    
    this.onPlayStateChange?.(false);
  }

  // 다음 비트 스케줄링
  private scheduleNextBeat() {
    if (!this.isPlaying || !this.audioContext) return;

    const nowAudio = this.audioContext.currentTime;
    // 현재 템포를 사용 (BPM 변경 시 즉시 반영)
    const secondsPerBeat = 60.0 / this.currentTempo;

    // schedule-ahead 윈도우 내의 모든 노트를 예약
    while (this.nextNoteTimeSec <= nowAudio + this.scheduleAheadSec) {
      this.scheduleNote(this.nextNoteTimeSec, this.beatCount);
      this.nextNoteTimeSec += secondsPerBeat;
      this.beatCount = (this.beatCount + 1) % this.beatsPerBar;
    }

    this.animationFrameId = requestAnimationFrame(() => this.scheduleNextBeat());
  }


  // 클릭 사운드 생성 (액센트/일반 비트 구분)
  private createClickSound(timeSec: number, beatNumber: number) {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    // 액센트 비트와 일반 비트 구분
    const isAccent = beatNumber === 0;
    const frequency = isAccent ? 1200 : 800;  // 액센트는 더 높은 주파수
    const volume = 1;      // 액센트는 더 큰 볼륨 (볼륨 증가)
    const duration = 0.05;                    // 짧은 클릭 소리
    
    // 톤 설정
    oscillator.frequency.setValueAtTime(frequency, timeSec);
    oscillator.type = 'sine';
    
    // 어택과 디케이로 클릭 소리 효과 (짧고 날카로운 소리)
    gainNode.gain.setValueAtTime(0, timeSec);
    gainNode.gain.linearRampToValueAtTime(volume, timeSec + 0.001);  // 빠른 어택
    gainNode.gain.exponentialRampToValueAtTime(0.01, timeSec + duration);  // 빠른 디케이
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.start(timeSec);
    oscillator.stop(timeSec + duration);
  }

  // 비트 재생
  private scheduleNote(timeSec: number, beatNumber: number) {
    if (!this.audioContext) return;

    // UI 동기화를 위해 즉시 비트 콜백 알림 (스케줄 직전)
    this.onBeat?.(beatNumber, this.beatsPerBar);

    // 생성된 사운드 사용
    this.createClickSound(timeSec, beatNumber);
  }

  // 서버에 시작 요청
  public requestStart(tempo: number = this.tempo, beats: number = this.beatsPerBar) {
    if (!this.sendMessage) {
      return;
    }
    
    this.sendMessage({
      action: "startMetronome",
      tempo: tempo,
      beats: beats
    });
  }

  // 서버에 정지 요청
  public requestStop() {
    if (!this.sendMessage) {
      return;
    }
    
    this.sendMessage({
      action: "stopMetronome"
    });
  }

  // 서버에 템포 변경 요청
  public requestChangeTempo(tempo: number) {
    this.applyTempoChange(tempo);
    
    if (!this.sendMessage) {
      return;
    }
    
    this.sendMessage({
      action: "changeTempo",
      tempo: tempo
    });
    
    setTimeout(() => {
      this.requestSync();
    }, 300);
  }

  public requestChangeBeats(beats: number) {
    this.applyBeatsChange(beats);
    if (!this.sendMessage) {
      return;
    }
    
    this.sendMessage({
      action: "changeBeats",
      beats: beats
    });
  }

  // 서버에 동기화 요청
  public requestSync() {
    if (!this.sendMessage) {
      return;
    }
    
    this.sendMessage({
      action: "requestSync"
    });
  }

  private applyTempoChange(newTempo: number) {
    if (typeof newTempo !== 'number' || !isFinite(newTempo) || newTempo <= 0) return;
    
    const oldTempo = this.tempo;
    const tempoChangeRatio = newTempo / oldTempo;
    
    // applyTempoChange 호출
    
    this.tempo = newTempo;
    this.currentTempo = newTempo;
    
    // 템포 변경 완료
    
    this.onTempoChange?.(this.tempo);

    if (this.isPlaying && this.audioContext) {
      const now = Date.now();
      const nowAudio = this.audioContext.currentTime;
      
      const oldSecondsPerBeat = 60.0 / oldTempo;
      const elapsedMs = now - this.startTime;
      const totalBeatsElapsed = elapsedMs / (oldSecondsPerBeat * 1000);
      const currentBeatIndex = Math.floor(totalBeatsElapsed) % this.beatsPerBar;
      
      const nextBeatInSequence = Math.ceil(totalBeatsElapsed);
      
      const oldNextBeatTimeMs = this.startTime + (nextBeatInSequence * oldSecondsPerBeat * 1000);
      const remainingMs = oldNextBeatTimeMs - now;
      const newRemainingMs = remainingMs * tempoChangeRatio;
      const nextBeatTimeAudio = nowAudio + newRemainingMs / 1000;
      
      this.nextNoteTimeSec = Math.max(nextBeatTimeAudio, nowAudio + 0.001);
      this.beatCount = currentBeatIndex;
      
      console.log('템포 변경 (고도화된 동기화):', {
        oldTempo,
        newTempo,
        tempoChangeRatio: tempoChangeRatio.toFixed(3),
        totalBeatsElapsed: totalBeatsElapsed.toFixed(3),
        currentBeatIndex,
        nextBeatInSequence,
        remainingMs: remainingMs.toFixed(0),
        newRemainingMs: newRemainingMs.toFixed(0),
        nextNoteTimeSec: this.nextNoteTimeSec.toFixed(3)
      });
      
      // BPM 변경 후 강제 동기화 요청 (안정적인 동기화)
      setTimeout(() => {
        this.requestSync();
      }, 500);
    }
  }


  private applyBeatsChange(newBeats: number) {
    if (typeof newBeats !== 'number' || !isFinite(newBeats) || newBeats <= 0) return;
    this.beatsPerBar = newBeats;
    this.onBeatsChange?.(this.beatsPerBar);
    if (this.isPlaying) {
      this.beatCount = this.beatCount % this.beatsPerBar;
    }
  }

  // 탭 템포
  public tapTempo(): number {
    const now = Date.now();
    this.tapTimes.push(now);
    
    // 최대 저장 개수 초과 시 오래된 것 제거
    if (this.tapTimes.length > this.maxTapTimes) {
      this.tapTimes.shift();
    }
    
    // 최소 2번은 탭해야 BPM 계산 가능
    if (this.tapTimes.length < 2) {
      return this.tempo;
    }
    
    // 최근 4번의 탭 간격으로 평균 BPM 계산
    const recentTaps = this.tapTimes.slice(-4);
    const intervals: number[] = [];
    
    for (let i = 1; i < recentTaps.length; i++) {
      intervals.push(recentTaps[i] - recentTaps[i - 1]);
    }
    
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const calculatedBPM = Math.round(60000 / avgInterval);
    const clampedBPM = Math.max(40, Math.min(240, calculatedBPM));
    
    return clampedBPM;
  }

  // 탭 기록 초기화
  public clearTapTimes() {
    this.tapTimes = [];
  }

  // 탭 기록 개수
  public getTapCount(): number {
    return this.tapTimes.length;
  }

  // 콜백 설정
  public setOnTempoChange(callback: (tempo: number) => void) {
    this.onTempoChange = callback;
  }

  public setOnBeatsChange(callback: (beats: number) => void) {
    this.onBeatsChange = callback;
  }

  public setOnPlayStateChange(callback: (isPlaying: boolean) => void) {
    this.onPlayStateChange = callback;
  }

  public setOnBeat(callback: (beatIndex: number, beatsPerBar: number) => void) {
    this.onBeat = callback;
  }

  // 상태 확인
  public isActive(): boolean {
    return this.isPlaying;
  }

  public getTempo(): number {
    return this.tempo;
  }

  public getBeats(): number {
    return this.beatsPerBar;
  }

  public getIsAudioReady(): boolean {
    return this.isAudioReady;
  }

  // 자동 재생 설정
  public setAutoPlayEnabled(enabled: boolean) {
    this.autoPlayEnabled = enabled;
  }

  public getAutoPlayEnabled(): boolean {
    return this.autoPlayEnabled;
  }

  // 정리
  public destroy() {
    this.stop();
    this.audioContext = null;
    this.websocket = null;
  }
}

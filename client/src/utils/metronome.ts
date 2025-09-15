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
  // 템포 글라이드용 상태
  private currentTempo: number = 120;
  private targetTempo: number = 120;
  private tempoGlideMs: number = 60; // 템포 변화에 걸리는 시간(ms)
  private tempoGlideStartTime: number = 0;
  private tempoGlideFrom: number = 120;
  private beatsPerBar: number = 4;
  private beatCount: number = 0;
  
  // 오디오 관련
  private clickSound: AudioBuffer | null = null;
  private accentSound: AudioBuffer | null = null;
  private isAudioReady: boolean = false;
  
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

  constructor(websocket: WebSocket | null = null) {
    this.websocket = websocket;
    this.setupWebSocket();
  }

  // 초기화 (사용자 상호작용 후 호출)
  public async initialize(): Promise<boolean> {
    console.log('Metronome.initialize() 호출됨');
    if (this.isInitializing) {
      console.log('이미 초기화 중입니다');
      return false;
    }
    this.isInitializing = true;

    try {
      console.log('AudioContext 생성 시작');
      // AudioContext 생성
      const AudioContextCtor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) {
        throw new Error('AudioContext not supported');
      }
      
      this.audioContext = new AudioContextCtor();
      console.log('AudioContext 생성 완료:', this.audioContext.state);
      
      // AudioContext가 suspended 상태인 경우 resume (iOS 사파리 대응: user gesture 내에서만 허용)
      if (this.audioContext && this.audioContext.state !== 'running') {
        console.log('AudioContext resume 시도');
        await this.audioContext.resume();
        console.log('AudioContext resume 완료:', this.audioContext.state);
      }

      // 사운드 로드
      console.log('사운드 로드 시작');
      await this.loadSounds();
      console.log('사운드 로드 완료');
      
      this.isAudioReady = true;
      console.log('Metronome 초기화 완료');
      return true;
    } catch (error) {
      console.error('Metronome 초기화 실패:', error);
      return false;
    } finally {
      this.isInitializing = false;
    }
  }

  // 사운드 로드
  private async loadSounds() {
    // 호출 시점의 AudioContext를 로컬 변수로 고정하여 중간에 교체/파괴되어도 안전하게 처리
    const ctx = this.audioContext;
    if (!ctx) throw new Error('AudioContext not initialized');

    // decodeAudioData는 브라우저에 따라 Promise/Callback 형태가 다를 수 있음. 안전 래퍼 적용
    const decode = (buffer: ArrayBuffer) => new Promise<AudioBuffer>((resolve, reject) => {
      try {
        const anyCtx = ctx as unknown as { decodeAudioData: (buf: ArrayBuffer, cb?: (b: AudioBuffer) => void, eb?: (e: unknown) => void) => void | Promise<AudioBuffer> };
        const maybePromise = anyCtx.decodeAudioData(buffer, (b) => resolve(b), (e) => reject(e));
        if (maybePromise && typeof (maybePromise as Promise<AudioBuffer>).then === 'function') {
          (maybePromise as Promise<AudioBuffer>).then(resolve).catch(reject);
        }
      } catch (err) {
        reject(err);
      }
    });

    try {
      console.log('클릭 사운드 로드 시작');
      const clickUrl = this.resolveAssetUrl('sounds/click.mp3');
      const clickResponse = await fetch(clickUrl, { cache: 'force-cache' });
      if (!clickResponse.ok) {
        throw new Error(`클릭 사운드 로드 실패: ${clickResponse.status}`);
      }
      const clickBuffer = await clickResponse.arrayBuffer();
      if (!this.audioContext || this.audioContext !== ctx) throw new Error('AudioContext changed or disposed during load (click)');
      this.clickSound = await decode(clickBuffer);
      console.log('클릭 사운드 로드 완료');

      console.log('액센트 사운드 로드 시작');
      const accentUrl = this.resolveAssetUrl('sounds/accent.mp3');
      const accentResponse = await fetch(accentUrl, { cache: 'force-cache' });
      if (!accentResponse.ok) {
        throw new Error(`액센트 사운드 로드 실패: ${accentResponse.status}`);
      }
      const accentBuffer = await accentResponse.arrayBuffer();
      if (!this.audioContext || this.audioContext !== ctx) throw new Error('AudioContext changed or disposed during load (accent)');
      this.accentSound = await decode(accentBuffer);
      console.log('액센트 사운드 로드 완료');

      console.log('사운드 로드 완료');
    } catch (error) {
      console.error('사운드 로드 실패:', error);
      throw error;
    }
  }

  // 정적 자산 URL 계산 (Vite BASE_URL 지원)
  private resolveAssetUrl(path: string): string {
    const clean = path.replace(/^\//, '');
    try {
      const base: string = ((import.meta as unknown as { env?: { BASE_URL?: string }}).env?.BASE_URL) ?? '/';
      const prefix = base.endsWith('/') ? base : base + '/';
      return prefix + clean;
    } catch {
      return '/' + clean;
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
    // 서버 상태 수신 (디버깅 로그는 과도한 스팸 방지를 위해 주석)
    // console.log('서버 상태 수신:', state);

    // 템포 업데이트
    if (state.tempo && state.tempo !== this.tempo) {
      this.tempo = state.tempo;
      this.onTempoChange?.(state.tempo);
    }

    // 박자 업데이트
    if (state.beats && state.beats !== this.beatsPerBar) {
      this.beatsPerBar = state.beats;
      this.onBeatsChange?.(state.beats);
    }

    // 재생 상태 변경
    if (state.isPlaying !== this.isPlaying) {
      if (state.isPlaying) {
        await this.startFromServer();
      } else {
        this.stopFromServer();
      }
    }
  }

  // 메트로놈 시작
  public async start() {
    if (this.isStarting) {
      // 중복 시작 방지
      console.warn('메트로놈 시작이 이미 진행 중입니다');
      return;
    }

    if (this.isPlaying) {
      console.warn('메트로놈이 이미 재생 중입니다');
      return;
    }

    this.isStarting = true;

    try {
      // 오디오가 준비되지 않은 경우 초기화
      if (!this.isAudioReady) {
        const initialized = await this.initialize();
        if (!initialized) {
          console.error('오디오 초기화 실패');
          return;
        }
      }

      // AudioContext가 suspended 상태인 경우 resume
      if (this.audioContext?.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.isPlaying = true;
      this.startTime = Date.now();
      this.beatCount = 0;

      // 다음 노트 시간 계산 (AudioContext 기준)
      // 템포 글라이드 초기화
      this.currentTempo = this.tempo;
      this.targetTempo = this.tempo;
      this.tempoGlideFrom = this.tempo;
      this.tempoGlideStartTime = this.startTime;

      this.startAudioTimeSec = this.audioContext!.currentTime;
      // 첫 박을 즉시 스케줄하기 위해 현재 시각으로 초기화
      this.nextNoteTimeSec = this.startAudioTimeSec + 0.001;

      // 애니메이션 프레임 시작
      this.scheduleNextBeat();
      
      this.onPlayStateChange?.(true);
      // console.log('메트로놈 시작');
    } catch (error) {
      console.error('메트로놈 시작 실패:', error);
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
    // console.log('메트로놈 정지');
  }

  // 서버 상태로 메트로놈 시작 (WebSocket 메시지 전송 안함)
  private async startFromServer() {
    if (this.isStarting) {
      console.warn('메트로놈 시작이 이미 진행 중입니다');
      return;
    }

    if (this.isPlaying) {
      console.warn('메트로놈이 이미 재생 중입니다');
      return;
    }

    this.isStarting = true;

    try {
      // 오디오가 준비되지 않은 경우 초기화
      if (!this.isAudioReady) {
        const initialized = await this.initialize();
        if (!initialized) {
          console.error('오디오 초기화 실패');
          return;
        }
      }

      // AudioContext가 suspended 상태인 경우 resume
      if (this.audioContext?.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.isPlaying = true;
      this.startTime = Date.now();
      this.beatCount = 0;

      // 다음 노트 시간 계산 (AudioContext 기준)
      // 템포 글라이드 초기화
      this.currentTempo = this.tempo;
      this.targetTempo = this.tempo;
      this.tempoGlideFrom = this.tempo;
      this.tempoGlideStartTime = this.startTime;

      this.startAudioTimeSec = this.audioContext!.currentTime;
      // 첫 박을 즉시 스케줄하기 위해 현재 시각으로 초기화
      this.nextNoteTimeSec = this.startAudioTimeSec + 0.001;

      // 애니메이션 프레임 시작
      this.scheduleNextBeat();
      
      this.onPlayStateChange?.(true);
      // console.log('메트로놈 시작 (서버 상태)');
    } catch (error) {
      console.error('메트로놈 시작 실패:', error);
    } finally {
      this.isStarting = false;
    }
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
    // console.log('메트로놈 정지 (서버 상태)');
  }

  // 다음 비트 스케줄링
  private scheduleNextBeat() {
    if (!this.isPlaying || !this.audioContext) return;

    const nowAudio = this.audioContext.currentTime;
    const effTempo = this.getEffectiveTempo(Date.now());
    const secondsPerBeat = 60.0 / effTempo;

    // schedule-ahead 윈도우 내의 모든 노트를 예약
    while (this.nextNoteTimeSec <= nowAudio + this.scheduleAheadSec) {
      this.scheduleNote(this.nextNoteTimeSec, this.beatCount);
      this.nextNoteTimeSec += secondsPerBeat;
      this.beatCount = (this.beatCount + 1) % this.beatsPerBar;
    }

    this.animationFrameId = requestAnimationFrame(() => this.scheduleNextBeat());
  }

  // 템포 글라이드 계산 (선형 보간)
  private getEffectiveTempo(nowMs: number): number {
    if (this.currentTempo === this.targetTempo) {
      return this.currentTempo;
    }
    const elapsed = nowMs - this.tempoGlideStartTime;
    const t = Math.max(0, Math.min(1, elapsed / this.tempoGlideMs));
    const next = this.tempoGlideFrom + (this.targetTempo - this.tempoGlideFrom) * t;
    this.currentTempo = next;
    if (t >= 1) {
      this.currentTempo = this.targetTempo;
    }
    return this.currentTempo;
  }

  // 비트 재생
  private scheduleNote(timeSec: number, beatNumber: number) {
    if (!this.audioContext || (!this.clickSound && !this.accentSound)) return;

    // UI 동기화를 위해 즉시 비트 콜백 알림 (스케줄 직전)
    this.onBeat?.(beatNumber, this.beatsPerBar);

    const source = this.audioContext.createBufferSource();
    const sound = beatNumber === 0 ? this.accentSound : this.clickSound;
    if (!sound) return;
    source.buffer = sound;

    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = beatNumber === 0 ? 1.0 : 0.8;
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    source.start(timeSec);
    source.stop(timeSec + 0.05);
  }

  // 서버에 시작 요청
  public requestStart(tempo: number = this.tempo, beats: number = this.beatsPerBar) {
    if (!this.sendMessage) {
      console.warn('sendMessage 함수가 설정되지 않았습니다.');
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
      console.warn('sendMessage 함수가 설정되지 않았습니다.');
      return;
    }
    
    this.sendMessage({
      action: "stopMetronome"
    });
  }

  // 서버에 템포 변경 요청
  public requestChangeTempo(tempo: number) {
    // 로컬에서도 즉시 반영하여 체감 지연 제거
    this.applyTempoChange(tempo);
    if (!this.sendMessage) {
      console.warn('sendMessage 함수가 설정되지 않았습니다.');
      return;
    }
    
    this.sendMessage({
      action: "changeTempo",
      tempo: tempo
    });
  }

  // 서버에 박자 변경 요청
  public requestChangeBeats(beats: number) {
    // 로컬 즉시 반영
    this.applyBeatsChange(beats);
    if (!this.sendMessage) {
      console.warn('sendMessage 함수가 설정되지 않았습니다.');
      return;
    }
    
    this.sendMessage({
      action: "changeBeats",
      beats: beats
    });
  }

  /**
   * 템포 변경을 로컬에 즉시 반영하고, 재생 중이면 위상 유지한 채 스케줄 재계산
   */
  private applyTempoChange(newTempo: number) {
    if (typeof newTempo !== 'number' || !isFinite(newTempo) || newTempo <= 0) return;
    this.tempo = newTempo; // 목표값 유지 (UI 반영)
    this.onTempoChange?.(this.tempo);

    // 글라이드 시작
    const now = Date.now();
    this.tempoGlideFrom = this.currentTempo;
    this.targetTempo = newTempo;
    this.tempoGlideStartTime = now;
    // nextNoteTime은 건드리지 않아 루프는 계속 돌며 점진적으로 beatInterval만 변화
  }

  /**
   * 박자 수 변경을 로컬에 즉시 반영하고, 재생 중이면 비트 카운터만 정리
   */
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
    
    console.log(`탭 BPM 계산: ${clampedBPM}`);
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

  // 정리
  public destroy() {
    this.stop();
    this.audioContext = null;
    this.websocket = null;
  }
}

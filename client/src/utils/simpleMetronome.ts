/**
 * 안정적인 메트로놈 구현
 * requestAnimationFrame 기반으로 정확한 타이밍 제공
 * 중복 재생 방지 및 상태 관리 강화
 */

export class Metronome {
  private audioContext: AudioContext | null = null;
  private isPlaying: boolean = false;
  private tempo: number = 120;
  private beatsPerBar: number = 4;
  private beatCount: number = 0;
  
  // 오디오 관련
  private clickSound: AudioBuffer | null = null;
  private accentSound: AudioBuffer | null = null;
  private isAudioReady: boolean = false;
  
  // 타이밍 관련
  private startTime: number = 0;
  private nextNoteTime: number = 0;
  private animationFrameId: number | null = null;
  
  // WebSocket
  private websocket: WebSocket | null = null;
  
  // 콜백
  private onTempoChange: ((tempo: number) => void) | null = null;
  private onBeatsChange: ((beats: number) => void) | null = null;
  private onPlayStateChange: ((isPlaying: boolean) => void) | null = null;
  
  // 탭 템포
  private tapTimes: number[] = [];
  private maxTapTimes: number = 4;

  // 중복 실행 방지
  private isInitializing: boolean = false;
  private isStarting: boolean = false;

  constructor(websocket: WebSocket | null = null) {
    this.websocket = websocket;
    this.setupWebSocket();
  }

  // 초기화 (사용자 상호작용 후 호출)
  public async initialize(): Promise<boolean> {
    if (this.isInitializing) return false;
    this.isInitializing = true;

    try {
      // AudioContext 생성
      const AudioContextCtor = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) {
        throw new Error('AudioContext not supported');
      }
      
      this.audioContext = new AudioContextCtor();
      
      // AudioContext가 suspended 상태인 경우 resume
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // 사운드 로드
      await this.loadSounds();
      
      this.isAudioReady = true;
      console.log('SimpleMetronome 초기화 완료');
      return true;
    } catch (error) {
      console.error('SimpleMetronome 초기화 실패:', error);
      return false;
    } finally {
      this.isInitializing = false;
    }
  }

  // 사운드 로드
  private async loadSounds() {
    if (!this.audioContext) throw new Error('AudioContext not initialized');

    try {
      // 클릭 사운드 로드
      const clickResponse = await fetch('/sounds/click.mp3');
      const clickBuffer = await clickResponse.arrayBuffer();
      this.clickSound = await this.audioContext.decodeAudioData(clickBuffer);

      // 액센트 사운드 로드
      const accentResponse = await fetch('/sounds/accent.mp3');
      const accentBuffer = await accentResponse.arrayBuffer();
      this.accentSound = await this.audioContext.decodeAudioData(accentBuffer);

      console.log('사운드 로드 완료');
    } catch (error) {
      console.error('사운드 로드 실패:', error);
      throw error;
    }
  }

  // WebSocket 설정
  private setupWebSocket() {
    if (!this.websocket) return;

    this.websocket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'metronomeState') {
          this.handleServerState(data);
        }
      } catch (error) {
        console.error('WebSocket 메시지 파싱 실패:', error);
      }
    });
  }

  // 서버 상태 처리
  private handleServerState(state: any) {
    console.log('서버 상태 수신:', state);

    // 템포 업데이트
    if (state.tempo && state.tempo !== this.tempo) {
      this.tempo = state.tempo;
      this.onTempoChange?.(this.tempo);
    }

    // 박자 업데이트
    if (state.beats && state.beats !== this.beatsPerBar) {
      this.beatsPerBar = state.beats;
      this.onBeatsChange?.(this.beatsPerBar);
    }

    // 재생 상태 변경
    if (state.isPlaying !== this.isPlaying) {
      if (state.isPlaying) {
        this.start();
      } else {
        this.stop();
      }
    }
  }

  // 메트로놈 시작
  public async start() {
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
      
      // 다음 노트 시간 계산
      const secondsPerBeat = 60.0 / this.tempo;
      this.nextNoteTime = this.startTime + (secondsPerBeat * 1000);

      // 애니메이션 프레임 시작
      this.scheduleNextBeat();
      
      this.onPlayStateChange?.(true);
      console.log('메트로놈 시작');
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
    console.log('메트로놈 정지');
  }

  // 다음 비트 스케줄링
  private scheduleNextBeat() {
    if (!this.isPlaying) return;

    const now = Date.now();
    const secondsPerBeat = 60.0 / this.tempo;
    const beatInterval = secondsPerBeat * 1000; // 밀리초

    // 다음 비트 시간이 되었는지 확인
    if (now >= this.nextNoteTime) {
      this.playBeat(this.beatCount);
      
      // 다음 비트 준비
      this.beatCount = (this.beatCount + 1) % this.beatsPerBar;
      this.nextNoteTime += beatInterval;
    }

    // 다음 프레임에서 계속 확인
    this.animationFrameId = requestAnimationFrame(() => this.scheduleNextBeat());
  }

  // 비트 재생
  private playBeat(beatNumber: number) {
    if (!this.audioContext || (!this.clickSound && !this.accentSound)) return;

    const source = this.audioContext.createBufferSource();
    const sound = beatNumber === 0 ? this.accentSound : this.clickSound;
    
    if (!sound) return;

    source.buffer = sound;
    
    // 게인 노드 생성
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = beatNumber === 0 ? 1.0 : 0.8;
    
    // 연결 및 재생
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    const currentTime = this.audioContext.currentTime;
    source.start(currentTime);
    source.stop(currentTime + 0.05);
  }

  // 서버에 시작 요청
  public requestStart(tempo: number = this.tempo, beats: number = this.beatsPerBar) {
    if (!this.websocket) return;
    
    this.websocket.send(JSON.stringify({
      action: "startMetronome",
      tempo: tempo,
      beats: beats
    }));
  }

  // 서버에 정지 요청
  public requestStop() {
    if (!this.websocket) return;
    
    this.websocket.send(JSON.stringify({
      action: "stopMetronome"
    }));
  }

  // 서버에 템포 변경 요청
  public requestChangeTempo(tempo: number) {
    if (!this.websocket) return;
    
    this.websocket.send(JSON.stringify({
      action: "changeTempo",
      tempo: tempo
    }));
  }

  // 서버에 박자 변경 요청
  public requestChangeBeats(beats: number) {
    if (!this.websocket) return;
    
    this.websocket.send(JSON.stringify({
      action: "changeBeats",
      beats: beats
    }));
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

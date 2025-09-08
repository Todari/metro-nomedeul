export class Metronome {
  private audioContext: AudioContext;
  private isPlaying: boolean = false;
  private tempo: number = 128;
  private startTime: number = 0;
  private nextNoteTime: number = 0;
  private noteLength: number = 0.05; // 소리 길이 (초)
  private scheduleAheadTime: number = 0.1; // 미리 예약할 시간 (초)
  private timerWorker: Worker | null = null;
  private serverTimeOffset: number = 0; // 서버와 클라이언트 시간 차이
  private websocket: WebSocket;
  private clickSound: AudioBuffer | null = null;
  private accentSound: AudioBuffer | null = null;
  private beatCount: number = 0;
  private beatsPerBar: number = 4; // 마디당 비트 수
  private onTempoChange: ((tempo: number) => void) | null = null;
  private onBeatsChange: ((beat: number) => void) | null = null;
  private onPlayStateChange: ((isPlaying: boolean) => void) | null = null;
  private tapTimes: number[] = []; // Tab 버튼 누른 시간들을 저장
  private maxTapTimes: number = 8; // 최대 저장할 탭 시간 수

  constructor(websocket: WebSocket) {
    const AudioContextCtor = ((window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext; }).AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!AudioContextCtor) {
      throw new Error('AudioContext is not supported');
    }
    this.audioContext = new AudioContextCtor();
    this.websocket = websocket;
    this.initWorker();
    this.loadSounds();
    
    // 웹소켓 메시지 처리
    this.websocket.addEventListener('message', (event: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(event.data) as {
          type?: string;
          isPlaying?: boolean;
          tempo?: number;
          beats?: number;
          startTime?: number;
          serverTime?: number;
          roomUuid?: string;
        };
        if (parsed && parsed.type === 'metronomeState') {
          this.handleMetronomeState({
            type: 'metronomeState',
            isPlaying: Boolean(parsed.isPlaying),
            tempo: Number(parsed.tempo ?? this.tempo),
            beats: Number(parsed.beats ?? this.beatsPerBar),
            startTime: Number(parsed.startTime ?? Date.now()),
            serverTime: Number(parsed.serverTime ?? Date.now()),
            roomUuid: String(parsed.roomUuid ?? ''),
          });
        }
      } catch {
        // ignore invalid json
      }
    });
  }

  // 웹 워커 초기화
  private initWorker() {
    // 인라인 워커 생성
    const workerBlob = new Blob([`
      let timerID = null;
      let interval = 100;
      
      self.onmessage = function(e) {
        if (e.data === "start") {
          timerID = setInterval(() => { self.postMessage("tick"); }, interval);
        } else if (e.data === "stop") {
          clearInterval(timerID);
          timerID = null;
        } else if (e.data.interval) {
          interval = e.data.interval;
          if (timerID) {
            clearInterval(timerID);
            timerID = setInterval(() => { self.postMessage("tick"); }, interval);
          }
        }
      };
    `], { type: 'application/javascript' });
    
    this.timerWorker = new Worker(URL.createObjectURL(workerBlob));
    this.timerWorker.onmessage = (e) => {
      if (e.data === "tick") {
        this.scheduler();
      }
    };
    this.timerWorker.postMessage({ interval: 25 }); // 25ms 간격으로 틱 생성
  }

  // 사운드 로드
  private async loadSounds() {
    try {
      // 일반 클릭 사운드 로드
      const clickResponse = await fetch('/sounds/click.mp3');
      const clickBuffer = await clickResponse.arrayBuffer();
      this.clickSound = await this.audioContext.decodeAudioData(clickBuffer);
      
      // 강조 클릭 사운드 로드
      const accentResponse = await fetch('/sounds/accent.mp3');
      const accentBuffer = await accentResponse.arrayBuffer();
      this.accentSound = await this.audioContext.decodeAudioData(accentBuffer);
      
      console.log('메트로놈 사운드 로드 완료');
    } catch (error) {
      console.error('사운드 로드 실패:', error);
    }
  }

  // 메트로놈 상태 처리
  private handleMetronomeState(state: { type: string; isPlaying: boolean; tempo: number; beats: number; startTime: number; serverTime: number; roomUuid: string; }) {
    console.log('메트로놈 상태 수신:', state);
    
    // 서버와 클라이언트 시간 차이 계산
    const clientTime = Date.now();
    this.serverTimeOffset = state.serverTime - clientTime;
    
    // 템포 업데이트
    if (this.tempo !== state.tempo) {
      this.tempo = state.tempo;
      if (this.onTempoChange) {
        this.onTempoChange(this.tempo);
      }
    }

    // 박자 업데이트
    if (typeof state.beats === 'number' && this.beatsPerBar !== state.beats) {
      this.beatsPerBar = state.beats;
      if (this.onBeatsChange) {
        this.onBeatsChange(this.beatsPerBar);
      }
    }
    
    // 재생 상태 변경
    if (this.isPlaying !== state.isPlaying) {
      if (state.isPlaying) {
        this.startMetronome(state.startTime);
      } else {
        this.stopMetronome();
      }
      
      if (this.onPlayStateChange) {
        this.onPlayStateChange(state.isPlaying);
      }
    } else if (state.isPlaying && this.startTime !== state.startTime) {
      // 시작 시간이 변경된 경우 (템포 변경 등)
      this.startMetronome(state.startTime);
    }
  }

  // 메트로놈 시작
  private startMetronome(serverStartTime: number) {
    this.isPlaying = true;
    this.startTime = serverStartTime - this.serverTimeOffset; // 서버 시간을 클라이언트 시간으로 변환
    
    // 다음 노트 시간 계산
    const secondsPerBeat = 60.0 / this.tempo;
    const currentTime = this.audioContext.currentTime;
    
    // 서버 시작 시간부터 현재까지 경과한 비트 수 계산
    const elapsedTime = (Date.now() - this.startTime) / 1000; // 초 단위로 변환
    const elapsedBeats = elapsedTime / secondsPerBeat;
    
    // 다음 비트 시간 계산 (자연스러운 박자 유지)
    this.beatCount = Math.floor(elapsedBeats) % this.beatsPerBar;
    this.nextNoteTime = currentTime + (Math.ceil(elapsedBeats) - elapsedBeats) * secondsPerBeat;
    
    // 스케줄러 시작
    this.timerWorker?.postMessage("start");
  }

  // 메트로놈 정지
  private stopMetronome() {
    this.isPlaying = false;
    this.timerWorker?.postMessage("stop");
  }

  // 노트 스케줄링
  private scheduler() {
    if (!this.isPlaying) return;
    
    const currentTime = this.audioContext.currentTime;
    const secondsPerBeat = 60.0 / this.tempo;
    
    // 현재 시간부터 scheduleAheadTime 이내에 재생해야 할 노트 스케줄링
    while (this.nextNoteTime < currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.nextNoteTime, this.beatCount);
      
      // 다음 비트 준비
      this.nextNoteTime += secondsPerBeat;
      this.beatCount = (this.beatCount + 1) % this.beatsPerBar;
    }
  }

  // 노트 스케줄링
  private scheduleNote(time: number, beatNumber: number) {
    // 소리 재생
    const source = this.audioContext.createBufferSource();
    source.buffer = beatNumber === 0 ? this.accentSound : this.clickSound;
    
    // 게인 노드 생성 (볼륨 조절용)
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = beatNumber === 0 ? 1.0 : 0.8; // 첫 비트는 더 강하게
    
    // 연결 및 재생
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    source.start(time);
    source.stop(time + this.noteLength);
  }

  // 메트로놈 시작 요청
  public requestStart(tempo: number = this.tempo, beats: number = this.beatsPerBar) {
    this.websocket.send(JSON.stringify({
      action: "startMetronome",
      tempo: tempo,
      beats: beats
    }));
  }

  // 메트로놈 정지 요청
  public requestStop() {
    this.websocket.send(JSON.stringify({
      action: "stopMetronome"
    }));
  }

  // 템포 변경 요청
  public requestChangeTempo(tempo: number) {
    this.websocket.send(JSON.stringify({
      action: "changeTempo",
      tempo: tempo
    }));
  }

  public requestChangeBeats(beats: number) {
    this.websocket.send(JSON.stringify({
      action: "changeBeats",
      beats: beats
    }));
  }

  // 템포 변경 콜백 설정
  public setOnTempoChange(callback: (tempo: number) => void) {
    this.onTempoChange = callback;
  }

  // 비트 변경 콜백 설정
  public setOnBeatsChange(callback: (beats: number) => void) {
    this.onBeatsChange = callback;
  }

  // 재생 상태 변경 콜백 설정
  public setOnPlayStateChange(callback: (isPlaying: boolean) => void) {
    this.onPlayStateChange = callback;
  }

  // 현재 템포 반환
  public getTempo(): number {
    return this.tempo;
  }

  public getBeats(): number {
    return this.beatsPerBar;
  }

  // 외부에서 박자를 직접 세팅해야 하는 경우를 대비
  public setBeats(beats: number) {
    this.beatsPerBar = beats;
    if (this.onBeatsChange) {
      this.onBeatsChange(this.beatsPerBar);
    }
  }

  // 현재 재생 상태 반환
  public isActive(): boolean {
    return this.isPlaying;
  }

  // Tab 버튼으로 BPM 설정
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
    
    // 평균 간격 계산 (밀리초)
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    
    // BPM 계산 (60000ms / 평균간격ms)
    const calculatedBPM = Math.round(60000 / avgInterval);
    
    // BPM 범위 제한 (40-240)
    const clampedBPM = Math.max(40, Math.min(240, calculatedBPM));
    
    console.log(`탭 BPM 계산: ${clampedBPM} (간격: ${avgInterval.toFixed(1)}ms)`);
    
    return clampedBPM;
  }

  // Tab 기록 초기화
  public clearTapTimes(): void {
    this.tapTimes = [];
  }

  // 현재 Tab 기록 개수 반환
  public getTapCount(): number {
    return this.tapTimes.length;
  }
}
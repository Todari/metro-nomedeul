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

  constructor(websocket: WebSocket) {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.websocket = websocket;
    this.initWorker();
    this.loadSounds();
    
    // 웹소켓 메시지 처리
    this.websocket.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'metronomeState') {
        this.handleMetronomeState(data);
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
  private handleMetronomeState(state: any) {
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
    
    // 다음 비트 시간 계산
    this.beatCount = Math.ceil(elapsedBeats) % this.beatsPerBar;
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

  // 현재 재생 상태 반환
  public isActive(): boolean {
    return this.isPlaying;
  }
}
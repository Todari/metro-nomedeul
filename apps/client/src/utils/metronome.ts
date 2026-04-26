import type { MetronomeState } from '@metro-nomedeul/shared';

export class Metronome {
  private audioContext: AudioContext | null = null;
  private isPlaying = false;
  private tempo = 120;
  private beatsPerBar = 4;
  private beatCount = 0;

  private isAudioReady = false;
  private isInitializing = false;
  private isStarting = false;

  private startTime = 0;
  private startAudioTimeSec = 0;
  private nextNoteTimeSec = 0;
  private animationFrameId: number | null = null;
  private readonly scheduleAheadSec = 0.05;

  private pendingSync: { nextNoteTimeSec: number; beatCount: number } | null =
    null;
  private pendingServerState: MetronomeState | null = null;
  private clockOffsetRef: { current: number } = { current: 0 };

  private onTempoChange: ((tempo: number) => void) | null = null;
  private onBeatsChange: ((beats: number) => void) | null = null;
  private onPlayStateChange: ((isPlaying: boolean) => void) | null = null;
  private onBeat: ((beatIndex: number, beatsPerBar: number) => void) | null =
    null;

  private tapTimes: number[] = [];
  private readonly maxTapTimes = 4;

  private lastBeatSyncTime = 0;
  private readonly minBeatSyncInterval = 50;
  private latestServerIsPlaying = false;

  private readonly attackTimeSec = 0.005;

  // AudioContext는 사용자 제스처 안에서만 안정적으로 resume 가능 → initialize()에서 lazy 생성

  private createAudioContext(): boolean {
    if (this.audioContext) return true;

    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return false;

      this.audioContext = new Ctor();
      return true;
    } catch {
      this.audioContext = null;
      return false;
    }
  }

  /**
   * iOS Safari/Chrome 안전성: AudioContext 생성, 무음 buffer 재생, resume() 호출을 모두 동기적으로 수행.
   * iOS Chrome (WKWebView)은 resume()만으론 audio engine이 unlock되지 않으므로 gesture 안에서
   * 실제로 음원을 한 번 재생해야 함. await 체인을 거치지 않고 user gesture 핸들러에서 곧바로 호출되어야
   * 함 — 그렇지 않으면 resume()이 영원히 pending. 글로벌 click 리스너의 capture phase에서 호출.
   */
  public primeAudioContextSync(): void {
    if (!this.audioContext) {
      this.createAudioContext();
    }
    if (!this.audioContext) return;

    // iOS Chrome (WKWebView) audio unlock: gesture 안에서 무음 1-sample buffer 재생
    try {
      const buffer = this.audioContext.createBuffer(1, 1, 22050);
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      source.start(0);
    } catch {
      // 일부 브라우저에서 createBuffer 거부할 수 있음 — 무시하고 resume만 시도
    }

    if (this.audioContext.state === 'suspended') {
      // fire-and-forget: 절대 await하지 말 것 (sync chain 깨짐)
      this.audioContext.resume().catch(() => {});
    }
  }

  public async initialize(): Promise<boolean> {
    if (this.isInitializing) return false;
    if (this.audioContext?.state === 'running') {
      this.isAudioReady = true;
      return true;
    }

    this.isInitializing = true;
    try {
      if (!this.audioContext && !this.createAudioContext()) return false;
      if (!this.audioContext) return false;

      if (this.audioContext.state === 'suspended') {
        try {
          // 모바일에서 일부 케이스 resume()이 영원히 pending 상태로 멈출 수 있어 timeout 방어
          await Promise.race([
            this.audioContext.resume(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('resume timeout')), 3000),
            ),
          ]);
        } catch {
          return false;
        }
        // resume()이 resolve되어도 모바일에서 사용자 제스처 없으면 suspended 유지
        if (this.audioContext.state === 'suspended') {
          return false;
        }
      }

      this.isAudioReady = true;
      return true;
    } finally {
      this.isInitializing = false;
    }
  }

  public async resumeIfSuspended(): Promise<void> {
    if (!this.audioContext) return;
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch {
        // 백그라운드에서 자동 suspend된 경우 사용자 제스처 없으면 실패할 수 있음 — 다음 제스처에서 재시도
      }
    }
  }

  public handleServerState(state: MetronomeState) {
    const isInitial = state.type === 'initialState';
    const isBeatSync = state.type === 'beatSync';

    // Only throttle beatSync messages, never throttle state changes
    if (isBeatSync) {
      const now = Date.now();
      if (now - this.lastBeatSyncTime < this.minBeatSyncInterval) return;
      this.lastBeatSyncTime = now;
    }

    // Track latest server play state for async start race condition
    this.latestServerIsPlaying = state.isPlaying;

    if (state.tempo && state.tempo !== this.tempo) {
      this.applyTempoChange(state.tempo);
    }
    if (state.beats && state.beats !== this.beatsPerBar) {
      this.beatsPerBar = state.beats;
      this.onBeatsChange?.(state.beats);
    }

    if (isInitial && !state.isPlaying) {
      if (state.tempo) {
        this.tempo = state.tempo;
        this.onTempoChange?.(state.tempo);
      }
      if (state.beats) {
        this.beatsPerBar = state.beats;
        this.onBeatsChange?.(state.beats);
      }
      return;
    }

    if (!state.isPlaying && (this.isPlaying || this.isStarting)) {
      this.isStarting = false;
      this.stopInternal();
      return;
    }

    if (state.isPlaying && !this.isPlaying) {
      this.startFromServer(state);
      return;
    }

    if (state.isPlaying && this.isPlaying) {
      if (isBeatSync) {
        this.syncBeatPrecisely(state);
      } else {
        const timeDiff = Math.abs(state.startTime - this.startTime);
        const beatInterval = (60.0 / state.tempo) * 1000;
        if (timeDiff > beatInterval || state.tempo !== this.tempo) {
          this.syncWithServer(state);
        }
      }
    }
  }

  private syncBeatPrecisely(serverState: MetronomeState) {
    if (!this.audioContext) return;

    const now = Date.now();
    const nowAudio = this.audioContext.currentTime;

    // Convert server timestamps to local time using clock offset
    const localStartTime = this.serverToLocal(serverState.startTime);
    const localServerTime = this.serverToLocal(serverState.serverTime);

    const serverElapsedMs = localServerTime - localStartTime;
    const transitDelayMs = now - localServerTime;
    const elapsedMs = Math.max(0, serverElapsedMs + transitDelayMs);

    const secondsPerBeat = 60.0 / serverState.tempo;
    const totalBeats = elapsedMs / (secondsPerBeat * 1000);

    const nextBeat = Math.ceil(totalBeats);
    const nextBeatMs = localStartTime + nextBeat * secondsPerBeat * 1000;
    const nextBeatAudio = nowAudio + (nextBeatMs - now) / 1000;

    const threshold = 0.010;
    const diff = Math.abs(nextBeatAudio - this.nextNoteTimeSec);

    if (diff > threshold) {
      this.pendingSync = {
        nextNoteTimeSec: Math.max(nextBeatAudio, nowAudio + 0.001),
        beatCount: nextBeat % serverState.beats,
      };
    }
  }

  private syncWithServer(serverState: MetronomeState) {
    if (!this.isPlaying || !this.audioContext) return;

    const now = Date.now();
    const nowAudio = this.audioContext.currentTime;

    const localStartTime = this.serverToLocal(serverState.startTime);
    const elapsedMs = now - localStartTime;
    if (elapsedMs < 0) return;

    const secondsPerBeat = 60.0 / serverState.tempo;
    const totalBeats = elapsedMs / (secondsPerBeat * 1000);

    const nextBeat = Math.ceil(totalBeats);
    const nextBeatMs = localStartTime + nextBeat * secondsPerBeat * 1000;
    const nextBeatAudio = nowAudio + (nextBeatMs - now) / 1000;

    const threshold = Math.max(0.2, secondsPerBeat * 0.3);
    const diff = Math.abs(nextBeatAudio - this.nextNoteTimeSec);
    const maxDiff = secondsPerBeat * 2;

    if (diff > threshold && diff < maxDiff) {
      this.pendingSync = {
        nextNoteTimeSec: Math.max(nextBeatAudio, nowAudio + 0.001),
        beatCount: nextBeat % serverState.beats,
      };
    }
  }

  private async startFromServer(serverState: MetronomeState) {
    if (this.isPlaying || this.isStarting) return;

    // 사용자 제스처 없이 AudioContext를 만들면 iOS Safari에서 영구 suspended로 오염됨 →
    // 컨텍스트가 아직 없으면 resume 시도하지 말고 pending에 저장, 다음 사용자 제스처에 처리
    if (!this.audioContext) {
      this.pendingServerState = serverState;
      return;
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume().catch(() => {});
    }

    // 모바일에서 사용자 제스처 없이 resume 실패 시, 상태만 저장
    if (this.audioContext.state !== 'running') {
      this.pendingServerState = serverState;
      return;
    }

    this.pendingServerState = null;
    await this.start(serverState);
  }

  /**
   * 사용자 제스처 후 호출하여 대기 중인 서버 상태로 재생 시작
   */
  public async resumeAfterGesture(): Promise<boolean> {
    if (this.isPlaying || this.isStarting) return false;
    if (!this.audioContext) return false;

    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch {
        return false;
      }
    }

    if (this.audioContext.state !== 'running') return false;

    this.isAudioReady = true;

    if (this.pendingServerState?.isPlaying) {
      const state = this.pendingServerState;
      this.pendingServerState = null;
      await this.start(state);
      return true;
    }

    return true;
  }

  public hasPendingPlayback(): boolean {
    return this.pendingServerState?.isPlaying === true;
  }

  public async start(serverState?: MetronomeState) {
    if (this.isStarting || this.isPlaying) return;
    this.isStarting = true;

    try {
      if (!this.audioContext) {
        if (!this.createAudioContext()) return;
      }
      if (!this.audioContext) return;

      await this.initialize();

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume().catch(() => {});
      }

      this.isPlaying = true;
      this.startAudioTimeSec = this.audioContext.currentTime;

      if (serverState?.isPlaying) {
        const clientTime = Date.now();
        this.startTime = this.serverToLocal(serverState.startTime);

        if (serverState.tempo) {
          this.tempo = serverState.tempo;
        }
        if (serverState.beats) {
          this.beatsPerBar = serverState.beats;
        }

        const elapsedMs = clientTime - this.startTime;
        const secondsPerBeat = 60.0 / this.tempo;
        const elapsedBeats = elapsedMs / (secondsPerBeat * 1000);

        const nextBeat = Math.ceil(elapsedBeats);
        this.beatCount = nextBeat % this.beatsPerBar;
        const nextBeatMs =
          this.startTime + nextBeat * secondsPerBeat * 1000;
        const nextBeatAudio =
          this.startAudioTimeSec + (nextBeatMs - clientTime) / 1000;
        this.nextNoteTimeSec = Math.max(
          nextBeatAudio,
          this.startAudioTimeSec + 0.001,
        );
      } else {
        this.startTime = Date.now();
        this.beatCount = 0;
        this.nextNoteTimeSec = this.startAudioTimeSec + 0.001;
      }

      this.scheduleNextBeat();
      this.onPlayStateChange?.(true);

      // If server sent stop while we were async starting, stop immediately
      if (!this.latestServerIsPlaying) {
        this.stopInternal();
      }
    } finally {
      this.isStarting = false;
    }
  }

  public stop() {
    this.stopInternal();
  }

  private stopInternal() {
    if (!this.isPlaying) return;

    this.isPlaying = false;
    this.pendingSync = null;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.beatCount = 0;
    this.onPlayStateChange?.(false);
  }

  private scheduleNextBeat() {
    if (!this.isPlaying || !this.audioContext) return;

    // 동기화 메서드의 보류 상태를 원자적으로 적용
    if (this.pendingSync) {
      this.nextNoteTimeSec = this.pendingSync.nextNoteTimeSec;
      this.beatCount = this.pendingSync.beatCount;
      this.pendingSync = null;
    }

    const nowAudio = this.audioContext.currentTime;
    const secondsPerBeat = 60.0 / this.tempo;
    const maxCatchupBeats = 2;

    // Skip accumulated missed beats (e.g., after tab was backgrounded)
    // so we don't flood the audio context with a burst of clicks.
    const behindSec = nowAudio - this.nextNoteTimeSec;
    if (behindSec > maxCatchupBeats * secondsPerBeat) {
      const skip = Math.floor(behindSec / secondsPerBeat);
      this.nextNoteTimeSec += skip * secondsPerBeat;
      this.beatCount = (this.beatCount + skip) % this.beatsPerBar;
    }

    while (this.nextNoteTimeSec <= nowAudio + this.scheduleAheadSec) {
      this.scheduleNote(this.nextNoteTimeSec, this.beatCount);
      this.nextNoteTimeSec += secondsPerBeat;
      this.beatCount = (this.beatCount + 1) % this.beatsPerBar;
    }

    this.animationFrameId = requestAnimationFrame(() =>
      this.scheduleNextBeat(),
    );
  }

  private scheduleNote(timeSec: number, beatNumber: number) {
    if (!this.audioContext) return;

    this.onBeat?.(beatNumber, this.beatsPerBar);
    this.createClickSound(timeSec, beatNumber);
  }

  private createClickSound(timeSec: number, beatNumber: number) {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    const isAccent = beatNumber === 0;
    const frequency = isAccent ? 1200 : 800;
    const duration = 0.05;

    oscillator.frequency.setValueAtTime(frequency, timeSec);
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0, timeSec);
    gainNode.gain.linearRampToValueAtTime(1, timeSec + this.attackTimeSec);
    gainNode.gain.exponentialRampToValueAtTime(0.01, timeSec + duration);

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.start(timeSec);
    oscillator.stop(timeSec + duration);
  }

  private applyTempoChange(newTempo: number) {
    if (!Number.isFinite(newTempo) || newTempo <= 0) return;

    const oldTempo = this.tempo;
    this.tempo = newTempo;
    this.onTempoChange?.(newTempo);

    if (this.isPlaying && this.audioContext) {
      const now = Date.now();
      const nowAudio = this.audioContext.currentTime;
      const oldSpb = 60.0 / oldTempo;
      const elapsedMs = now - this.startTime;
      const totalBeats = elapsedMs / (oldSpb * 1000);

      const nextBeat = Math.ceil(totalBeats);
      const ratio = newTempo / oldTempo;
      const oldNextMs = this.startTime + nextBeat * oldSpb * 1000;
      const remainMs = oldNextMs - now;
      const newRemainMs = remainMs / ratio;
      const nextAudio = nowAudio + newRemainMs / 1000;

      this.pendingSync = {
        nextNoteTimeSec: Math.max(nextAudio, nowAudio + 0.001),
        beatCount: nextBeat % this.beatsPerBar,
      };
    }
  }

  public tapTempo(): number {
    const now = Date.now();
    this.tapTimes.push(now);

    if (this.tapTimes.length > this.maxTapTimes) {
      this.tapTimes.shift();
    }

    if (this.tapTimes.length < 2) return this.tempo;

    const recent = this.tapTimes.slice(-4);
    const intervals: number[] = [];
    for (let i = 1; i < recent.length; i++) {
      intervals.push(recent[i] - recent[i - 1]);
    }

    const avg =
      intervals.reduce((sum, v) => sum + v, 0) / intervals.length;
    return Math.max(40, Math.min(240, Math.round(60000 / avg)));
  }

  public clearTapTimes() {
    this.tapTimes = [];
  }

  public getTapCount(): number {
    return this.tapTimes.length;
  }

  public setClockOffsetRef(ref: { current: number }) {
    this.clockOffsetRef = ref;
  }

  /** Convert server timestamp to local time using clock offset */
  private serverToLocal(serverTimeMs: number): number {
    return serverTimeMs - this.clockOffsetRef.current;
  }

  public setOnTempoChange(cb: (tempo: number) => void) {
    this.onTempoChange = cb;
  }
  public setOnBeatsChange(cb: (beats: number) => void) {
    this.onBeatsChange = cb;
  }
  public setOnPlayStateChange(cb: (isPlaying: boolean) => void) {
    this.onPlayStateChange = cb;
  }
  public setOnBeat(cb: (beatIndex: number, beatsPerBar: number) => void) {
    this.onBeat = cb;
  }

  public isActive() {
    return this.isPlaying;
  }
  public getTempo() {
    return this.tempo;
  }
  public getBeats() {
    return this.beatsPerBar;
  }
  public getIsAudioReady() {
    return this.isAudioReady;
  }

  public destroy() {
    this.stopInternal();
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }
}

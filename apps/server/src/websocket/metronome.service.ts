import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import {
  MetronomeState,
  MetronomeMessageType,
  DEFAULT_TEMPO,
  DEFAULT_BEATS,
  WS_EVENTS,
  WS_CONFIG,
} from '@metro-nomedeul/shared';

interface RoomSyncTimers {
  generalTimer: ReturnType<typeof setInterval> | null;
  beatTimer: ReturnType<typeof setTimeout> | null;
  beatCount: number;
}

@Injectable()
export class MetronomeService implements OnModuleDestroy {
  private readonly logger = new Logger(MetronomeService.name);

  private metronomeStates = new Map<string, MetronomeState>();
  private syncTimers = new Map<string, RoomSyncTimers>();

  private server: Server | null = null;

  setServer(server: Server) {
    this.server = server;
  }

  onModuleDestroy() {
    this.logger.log('MetronomeService shutting down — clearing all timers');
    this.cleanupAll();
  }

  getState(roomUuid: string): MetronomeState | undefined {
    return this.metronomeStates.get(roomUuid);
  }

  sendInitialState(client: Socket, roomUuid: string) {
    const state = this.metronomeStates.get(roomUuid);

    const initialState: MetronomeState = state
      ? {
          ...state,
          serverTime: Date.now(),
          type: 'initialState',
        }
      : {
          isPlaying: false,
          tempo: DEFAULT_TEMPO,
          beats: DEFAULT_BEATS,
          currentBeat: 0,
          startTime: 0,
          serverTime: Date.now(),
          roomUuid,
          type: 'initialState',
        };

    client.emit(WS_EVENTS.INITIAL_STATE, initialState);
    this.logger.log(`Initial state sent to ${client.id} (room: ${roomUuid})`);
  }

  startMetronome(roomUuid: string, tempo?: number, beats?: number) {
    const existing = this.metronomeStates.get(roomUuid);

    // Client's explicit value wins, fall back to existing state, then default
    const effectiveTempo = tempo ?? existing?.tempo ?? DEFAULT_TEMPO;
    const effectiveBeats = beats ?? existing?.beats ?? DEFAULT_BEATS;

    // Already playing with a running timer: just rebroadcast current state
    if (existing?.isPlaying && this.syncTimers.has(roomUuid)) {
      this.logger.log(
        `Metronome already playing for room=${roomUuid}, broadcasting current state`,
      );
      this.broadcastMetronomeState(roomUuid);
      return;
    }

    this.logger.log(
      `Start metronome: room=${roomUuid}, tempo=${effectiveTempo}, beats=${effectiveBeats}`,
    );

    this.stopSyncTimers(roomUuid);

    const now = Date.now();

    const state: MetronomeState = {
      isPlaying: true,
      tempo: effectiveTempo,
      beats: effectiveBeats,
      currentBeat: 0,
      startTime: now,
      serverTime: now,
      roomUuid,
      type: 'metronomeState',
    };

    this.metronomeStates.set(roomUuid, state);
    this.broadcastMetronomeState(roomUuid);
    this.startSyncTimers(roomUuid, effectiveTempo);
  }

  stopMetronome(roomUuid: string) {
    this.logger.log(`Stop metronome: room=${roomUuid}`);

    const state = this.metronomeStates.get(roomUuid);
    if (!state) return;

    state.isPlaying = false;
    state.serverTime = Date.now();

    this.stopSyncTimers(roomUuid);
    this.broadcastMetronomeState(roomUuid);
  }

  changeTempo(roomUuid: string, tempo: number) {
    this.logger.log(`Change tempo: room=${roomUuid}, tempo=${tempo}`);

    const state = this.metronomeStates.get(roomUuid);
    if (!state) return;

    const oldTempo = state.tempo;
    state.tempo = tempo;
    state.serverTime = Date.now();

    if (state.isPlaying && oldTempo > 0) {
      // Preserve phase: recompute startTime so the fractional beat position stays the same
      const oldBeatIntervalMs = 60_000 / oldTempo;
      const newBeatIntervalMs = 60_000 / tempo;
      const elapsedMs = state.serverTime - state.startTime;
      const fractionalBeats = elapsedMs / oldBeatIntervalMs;
      state.startTime = state.serverTime - fractionalBeats * newBeatIntervalMs;

      // Restart beat timer at new interval
      this.restartBeatTimer(roomUuid, tempo);
    }

    this.broadcastMetronomeState(roomUuid);
  }

  changeBeats(roomUuid: string, beats: number) {
    this.logger.log(`Change beats: room=${roomUuid}, beats=${beats}`);

    const state = this.metronomeStates.get(roomUuid);
    if (!state) return;

    state.beats = beats;
    state.serverTime = Date.now();

    // Re-modulo beatCount in case it exceeds the new beats value
    const timers = this.syncTimers.get(roomUuid);
    if (timers) {
      timers.beatCount = timers.beatCount % beats;
    }

    this.broadcastMetronomeState(roomUuid);
  }

  requestSync(roomUuid: string) {
    this.broadcastMetronomeState(roomUuid);
  }

  cleanupRoom(roomUuid: string) {
    this.logger.log(`Cleanup room: ${roomUuid}`);
    this.stopSyncTimers(roomUuid);
    this.metronomeStates.delete(roomUuid);
  }

  /**
   * Stops all timers and clears state for every room. Used on graceful shutdown.
   */
  cleanupAll() {
    for (const roomUuid of this.syncTimers.keys()) {
      this.stopSyncTimers(roomUuid);
    }
    this.metronomeStates.clear();
  }

  private broadcastMetronomeState(roomUuid: string) {
    const state = this.metronomeStates.get(roomUuid);
    if (!state || !this.server) return;

    state.serverTime = Date.now();
    this.server
      .to(roomUuid)
      .emit(WS_EVENTS.METRONOME_STATE, { ...state, type: 'metronomeState' });
  }

  private broadcastBeatSync(roomUuid: string) {
    const state = this.metronomeStates.get(roomUuid);
    if (!state || !this.server) return;

    const timers = this.syncTimers.get(roomUuid);
    const currentBeat = timers ? timers.beatCount : 0;

    const beatSync: MetronomeState = {
      ...state,
      currentBeat,
      serverTime: Date.now(),
      type: 'beatSync' as MetronomeMessageType,
    };

    this.server.to(roomUuid).emit(WS_EVENTS.BEAT_SYNC, beatSync);

    // Advance beat count
    if (timers) {
      timers.beatCount = (timers.beatCount + 1) % state.beats;
    }
  }

  private startSyncTimers(roomUuid: string, tempo: number) {
    this.stopSyncTimers(roomUuid);

    const beatIntervalMs = 60_000 / tempo;

    const generalTimer = setInterval(() => {
      const state = this.metronomeStates.get(roomUuid);
      if (!state?.isPlaying) {
        this.stopSyncTimers(roomUuid);
      }
    }, WS_CONFIG.GENERAL_SYNC_INTERVAL_MS);

    const timers: RoomSyncTimers = {
      generalTimer,
      beatTimer: null,
      beatCount: 0,
    };
    this.syncTimers.set(roomUuid, timers);

    // Self-correcting beat timer using setTimeout
    const state = this.metronomeStates.get(roomUuid);
    if (!state) return;

    const scheduleNextBeat = (expectedTime: number) => {
      const currentState = this.metronomeStates.get(roomUuid);
      if (!currentState?.isPlaying) {
        this.stopSyncTimers(roomUuid);
        return;
      }

      this.broadcastBeatSync(roomUuid);

      const currentTempo = currentState.tempo;
      const currentBeatIntervalMs = 60_000 / currentTempo;
      const nextExpected = expectedTime + currentBeatIntervalMs;
      const drift = Date.now() - expectedTime;
      const delay = Math.max(1, currentBeatIntervalMs - drift);

      const currentTimers = this.syncTimers.get(roomUuid);
      if (currentTimers) {
        currentTimers.beatTimer = setTimeout(
          () => scheduleNextBeat(nextExpected),
          delay,
        );
      }
    };

    // Immediately send first beat, then schedule next
    scheduleNextBeat(Date.now());
  }

  /**
   * Restarts the beat timer aligned to the state's current startTime + tempo.
   * Keeps beatCount consistent with the already-broadcast phase.
   */
  private restartBeatTimer(roomUuid: string, tempo: number) {
    const timers = this.syncTimers.get(roomUuid);
    const state = this.metronomeStates.get(roomUuid);
    if (!timers || !state) return;

    if (timers.beatTimer) {
      clearTimeout(timers.beatTimer);
      timers.beatTimer = null;
    }

    const beatIntervalMs = 60_000 / tempo;
    const elapsedMs = Date.now() - state.startTime;
    const beatsSinceStart = elapsedMs / beatIntervalMs;
    const nextBeatIndex = Math.ceil(beatsSinceStart);
    const nextBeatAt = state.startTime + nextBeatIndex * beatIntervalMs;
    const delay = Math.max(1, nextBeatAt - Date.now());

    // Align beatCount to next beat's position within the bar
    timers.beatCount = nextBeatIndex % state.beats;

    const scheduleNextBeat = (expectedTime: number) => {
      const currentState = this.metronomeStates.get(roomUuid);
      if (!currentState?.isPlaying) {
        this.stopSyncTimers(roomUuid);
        return;
      }

      this.broadcastBeatSync(roomUuid);

      const currentTempo = currentState.tempo;
      const currentBeatIntervalMs = 60_000 / currentTempo;
      const nextExpected = expectedTime + currentBeatIntervalMs;
      const drift = Date.now() - expectedTime;
      const d = Math.max(1, currentBeatIntervalMs - drift);

      const currentTimers = this.syncTimers.get(roomUuid);
      if (currentTimers) {
        currentTimers.beatTimer = setTimeout(
          () => scheduleNextBeat(nextExpected),
          d,
        );
      }
    };

    timers.beatTimer = setTimeout(() => scheduleNextBeat(nextBeatAt), delay);
  }

  private stopSyncTimers(roomUuid: string) {
    const timers = this.syncTimers.get(roomUuid);
    if (!timers) return;

    if (timers.generalTimer) clearInterval(timers.generalTimer);
    if (timers.beatTimer) clearTimeout(timers.beatTimer);

    this.syncTimers.delete(roomUuid);
  }
}

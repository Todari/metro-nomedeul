import { Injectable, Logger } from '@nestjs/common';
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
export class MetronomeService {
  private readonly logger = new Logger(MetronomeService.name);

  private metronomeStates = new Map<string, MetronomeState>();
  private syncTimers = new Map<string, RoomSyncTimers>();

  private server: Server | null = null;

  setServer(server: Server) {
    this.server = server;
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

  startMetronome(roomUuid: string, tempo: number, beats: number) {
    const existing = this.metronomeStates.get(roomUuid);

    // 이미 재생 중이고 타이머도 존재하면 현재 상태만 브로드캐스트
    if (existing?.isPlaying && this.syncTimers.has(roomUuid)) {
      this.logger.log(
        `Metronome already playing for room=${roomUuid}, broadcasting current state`,
      );
      this.broadcastMetronomeState(roomUuid);
      return;
    }

    this.logger.log(
      `Start metronome: room=${roomUuid}, tempo=${tempo}, beats=${beats}`,
    );

    this.stopSyncTimers(roomUuid);

    const now = Date.now();

    const state: MetronomeState = {
      isPlaying: true,
      tempo: existing?.tempo ?? tempo,
      beats: existing?.beats ?? beats,
      currentBeat: 0,
      startTime: now,
      serverTime: now,
      roomUuid,
      type: 'metronomeState',
    };

    this.metronomeStates.set(roomUuid, state);
    this.broadcastMetronomeState(roomUuid);
    this.startSyncTimers(roomUuid, tempo);
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

    if (state.isPlaying) {
      state.isPlaying = false;
      this.stopSyncTimers(roomUuid);
    }

    state.tempo = tempo;
    state.serverTime = Date.now();

    this.broadcastMetronomeState(roomUuid);
  }

  changeBeats(roomUuid: string, beats: number) {
    this.logger.log(`Change beats: room=${roomUuid}, beats=${beats}`);

    const state = this.metronomeStates.get(roomUuid);
    if (!state) return;

    if (state.isPlaying) {
      state.isPlaying = false;
      this.stopSyncTimers(roomUuid);
    }

    state.beats = beats;
    state.serverTime = Date.now();

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

      const nextExpected = expectedTime + beatIntervalMs;
      const drift = Date.now() - expectedTime;
      const delay = Math.max(1, beatIntervalMs - drift);

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

  private stopSyncTimers(roomUuid: string) {
    const timers = this.syncTimers.get(roomUuid);
    if (!timers) return;

    if (timers.generalTimer) clearInterval(timers.generalTimer);
    if (timers.beatTimer) clearTimeout(timers.beatTimer);

    this.syncTimers.delete(roomUuid);
  }
}

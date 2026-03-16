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
  beatTimer: ReturnType<typeof setInterval> | null;
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
          startTime: 0,
          serverTime: Date.now(),
          roomUuid,
          type: 'initialState',
        };

    client.emit(WS_EVENTS.INITIAL_STATE, initialState);
    this.logger.log(`Initial state sent to ${client.id} (room: ${roomUuid})`);
  }

  startMetronome(roomUuid: string, tempo: number, beats: number) {
    this.logger.log(
      `Start metronome: room=${roomUuid}, tempo=${tempo}, beats=${beats}`,
    );

    this.stopSyncTimers(roomUuid);

    const now = Date.now();
    const existing = this.metronomeStates.get(roomUuid);

    const state: MetronomeState = {
      isPlaying: true,
      tempo: existing?.tempo ?? tempo,
      beats: existing?.beats ?? beats,
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

    const beatSync: MetronomeState = {
      ...state,
      serverTime: Date.now(),
      type: 'beatSync' as MetronomeMessageType,
    };

    this.server.to(roomUuid).emit(WS_EVENTS.BEAT_SYNC, beatSync);
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

    const beatTimer = setInterval(() => {
      const state = this.metronomeStates.get(roomUuid);
      if (!state?.isPlaying) {
        this.stopSyncTimers(roomUuid);
        return;
      }
      this.broadcastBeatSync(roomUuid);
    }, beatIntervalMs);

    this.syncTimers.set(roomUuid, { generalTimer, beatTimer });
  }

  private stopSyncTimers(roomUuid: string) {
    const timers = this.syncTimers.get(roomUuid);
    if (!timers) return;

    if (timers.generalTimer) clearInterval(timers.generalTimer);
    if (timers.beatTimer) clearInterval(timers.beatTimer);

    this.syncTimers.delete(roomUuid);
  }
}
